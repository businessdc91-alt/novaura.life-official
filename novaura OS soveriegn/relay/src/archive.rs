// archive.rs — Always-on listing store, so nodes that were offline when something
// was published still see it.
//
// - Only publisher-signed packets are offered here (checked by the caller).
// - A listing stays owned by the identity that first published it; only that
//   identity can replace it, and only with a newer packet.
// - The original signed packet is kept verbatim, so every node re-verifies the
//   publisher's signature itself on replay. The relay vouches for nothing.
// - Storage is an append-only JSON-lines file, compacted on startup.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::path::PathBuf;

/// Packet types the relay keeps for late joiners.
pub const ARCHIVED_TYPES: &[&str] = &["MESH_MARKETPLACE_LISTING"];
pub const MAX_ENTRY_BYTES: usize = 16 * 1024;
pub const MAX_ENTRIES: usize = 5000;
pub const MAX_ENTRIES_PER_OWNER: usize = 200;
const MAX_FUTURE_SKEW_MS: u64 = 5 * 60 * 1000;
const FILE_NAME: &str = "archive.jsonl";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Entry {
    pub key: String,
    pub owner: String,
    /// Relay clock, strictly increasing: the sync cursor.
    pub archived_ms: u64,
    /// Publisher's packet timestamp: decides which version is newer.
    pub timestamp_ms: u64,
    pub packet: serde_json::Value,
}

pub struct Archive {
    entries: HashMap<String, Entry>,
    owner_counts: HashMap<String, usize>,
    last_archived_ms: u64,
    file: Option<PathBuf>,
}

/// `<type>|<listing id>`, or None when the packet names no usable listing ID.
pub fn key_for(packet_type: &str, payload: &serde_json::Value) -> Option<String> {
    if !ARCHIVED_TYPES.contains(&packet_type) {
        return None;
    }
    let id = payload.get("listing")?.get("id")?.as_str()?;
    let valid = !id.is_empty() && id.len() <= 128 && id.chars().all(|c| c.is_ascii_graphic());
    valid.then(|| format!("{}|{}", packet_type, id))
}

impl Archive {
    /// Opens the store in `dir` (created if missing). Without a directory the
    /// archive lives in memory only and is lost on restart.
    pub fn open(dir: Option<PathBuf>) -> Self {
        let mut archive = Self {
            entries: HashMap::new(),
            owner_counts: HashMap::new(),
            last_archived_ms: 0,
            file: dir.map(|d| d.join(FILE_NAME)),
        };
        let Some(path) = archive.file.clone() else { return archive };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut lines = 0usize;
        if let Ok(f) = std::fs::File::open(&path) {
            for line in std::io::BufReader::new(f).lines().map_while(Result::ok) {
                lines += 1;
                if let Ok(entry) = serde_json::from_str::<Entry>(&line) {
                    archive.apply_loaded(entry);
                }
            }
        }
        // Superseded versions pile up in an append-only file; rewrite it when
        // most of its lines are dead.
        if lines > archive.entries.len() * 2 + 100 {
            if let Err(e) = archive.compact() {
                eprintln!("[Archive] Compaction failed: {}", e);
            }
        }
        archive
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_persistent(&self) -> bool {
        self.file.is_some()
    }

    fn apply_loaded(&mut self, entry: Entry) {
        self.last_archived_ms = self.last_archived_ms.max(entry.archived_ms);
        match self.entries.get(&entry.key) {
            Some(old) if old.owner != entry.owner || old.timestamp_ms >= entry.timestamp_ms => return,
            Some(_) => {}
            None => *self.owner_counts.entry(entry.owner.clone()).or_insert(0) += 1,
        }
        self.entries.insert(entry.key.clone(), entry);
    }

    /// Stores a publisher-signed packet. `raw_len` is its size on the wire.
    pub fn offer(
        &mut self,
        packet_type: &str,
        owner: &str,
        timestamp_ms: u64,
        packet: serde_json::Value,
        raw_len: usize,
        now_ms: u64,
    ) -> Result<(), &'static str> {
        if raw_len > MAX_ENTRY_BYTES {
            return Err("too large");
        }
        if timestamp_ms > now_ms + MAX_FUTURE_SKEW_MS {
            return Err("timestamp in the future");
        }
        let payload = packet.get("payload").cloned().unwrap_or_default();
        let key = key_for(packet_type, &payload).ok_or("no listing id")?;
        match self.entries.get(&key) {
            Some(old) if old.owner != owner => return Err("listing owned by another publisher"),
            Some(old) if old.timestamp_ms >= timestamp_ms => return Err("not newer"),
            Some(_) => {}
            None => {
                if self.entries.len() >= MAX_ENTRIES {
                    return Err("archive full");
                }
                if self.owner_counts.get(owner).copied().unwrap_or(0) >= MAX_ENTRIES_PER_OWNER {
                    return Err("publisher limit reached");
                }
            }
        }

        self.last_archived_ms = now_ms.max(self.last_archived_ms + 1);
        let entry = Entry {
            key: key.clone(),
            owner: owner.to_string(),
            archived_ms: self.last_archived_ms,
            timestamp_ms,
            packet,
        };
        if let Some(path) = &self.file {
            let line = serde_json::to_string(&entry).unwrap_or_default();
            let written = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .and_then(|mut f| writeln!(f, "{}", line));
            if let Err(e) = written {
                eprintln!("[Archive] Could not persist {}: {}", key, e);
            }
        }
        if !self.entries.contains_key(&key) {
            *self.owner_counts.entry(owner.to_string()).or_insert(0) += 1;
        }
        self.entries.insert(key, entry);
        Ok(())
    }

    /// Everything archived after `since_ms`, oldest first.
    pub fn since(&self, since_ms: u64) -> Vec<Entry> {
        let mut out: Vec<Entry> = self.entries.values().filter(|e| e.archived_ms > since_ms).cloned().collect();
        out.sort_by_key(|e| e.archived_ms);
        out
    }

    fn compact(&self) -> std::io::Result<()> {
        let Some(path) = &self.file else { return Ok(()) };
        let tmp = path.with_extension("jsonl.tmp");
        {
            let mut f = std::io::BufWriter::new(std::fs::File::create(&tmp)?);
            for entry in self.since(0) {
                writeln!(f, "{}", serde_json::to_string(&entry).unwrap_or_default())?;
            }
            f.flush()?;
        }
        std::fs::rename(&tmp, path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const T: &str = "MESH_MARKETPLACE_LISTING";

    fn pkt(id: &str, title: &str) -> serde_json::Value {
        json!({ "packet_type": T, "payload": { "listing": { "id": id, "title": title } } })
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("novaura_archive_{}_{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn owner_binding_and_newer_only() {
        let mut a = Archive::open(None);
        assert!(a.offer(T, "did:a", 100, pkt("pub_1", "v1"), 50, 1000).is_ok());
        assert_eq!(a.offer(T, "did:b", 200, pkt("pub_1", "hijack"), 50, 1001), Err("listing owned by another publisher"));
        assert_eq!(a.offer(T, "did:a", 100, pkt("pub_1", "same"), 50, 1002), Err("not newer"));
        assert!(a.offer(T, "did:a", 150, pkt("pub_1", "v2"), 50, 1003).is_ok());
        let all = a.since(0);
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].packet["payload"]["listing"]["title"], "v2");
    }

    #[test]
    fn rejects_bad_input() {
        let mut a = Archive::open(None);
        assert_eq!(a.offer(T, "did:a", 1, pkt("pub_1", "x"), MAX_ENTRY_BYTES + 1, 1000), Err("too large"));
        assert_eq!(a.offer(T, "did:a", 10_000_000, pkt("pub_1", "x"), 10, 1000), Err("timestamp in the future"));
        assert_eq!(a.offer(T, "did:a", 1, pkt("", "x"), 10, 1000), Err("no listing id"));
        assert_eq!(a.offer("MESH_MAIL", "did:a", 1, pkt("pub_1", "x"), 10, 1000), Err("no listing id"));
    }

    #[test]
    fn per_owner_cap() {
        let mut a = Archive::open(None);
        for i in 0..MAX_ENTRIES_PER_OWNER {
            assert!(a.offer(T, "did:a", 1, pkt(&format!("pub_{}", i), "x"), 10, 1000).is_ok());
        }
        assert_eq!(a.offer(T, "did:a", 1, pkt("pub_over", "x"), 10, 1000), Err("publisher limit reached"));
        // Updating an existing listing is still allowed at the cap.
        assert!(a.offer(T, "did:a", 2, pkt("pub_0", "y"), 10, 1000).is_ok());
    }

    #[test]
    fn cursor_is_strictly_increasing() {
        let mut a = Archive::open(None);
        a.offer(T, "did:a", 1, pkt("pub_1", "x"), 10, 5000).unwrap();
        a.offer(T, "did:a", 1, pkt("pub_2", "x"), 10, 5000).unwrap();
        let all = a.since(0);
        assert!(all[1].archived_ms > all[0].archived_ms);
        assert_eq!(a.since(all[0].archived_ms).len(), 1);
    }

    #[test]
    fn survives_restart_and_compacts() {
        let dir = temp_dir("restart");
        {
            let mut a = Archive::open(Some(dir.clone()));
            for v in 0..150u64 {
                a.offer(T, "did:a", v + 1, pkt("pub_1", &format!("v{}", v)), 10, 1000 + v).unwrap();
            }
            a.offer(T, "did:b", 1, pkt("pub_2", "other"), 10, 2000).unwrap();
        }
        let path = dir.join(FILE_NAME);
        assert_eq!(std::fs::read_to_string(&path).unwrap().lines().count(), 151);

        let mut a = Archive::open(Some(dir.clone()));
        assert_eq!(a.len(), 2);
        assert_eq!(a.since(0)[0].packet["payload"]["listing"]["title"], "v149");
        assert_eq!(std::fs::read_to_string(&path).unwrap().lines().count(), 2, "compacted on open");
        // Ownership and the cursor survive the restart.
        assert_eq!(a.offer(T, "did:b", 999, pkt("pub_1", "hijack"), 10, 3000), Err("listing owned by another publisher"));
        a.offer(T, "did:a", 999, pkt("pub_3", "new"), 10, 10).unwrap();
        assert!(a.since(0).last().unwrap().archived_ms > 2000);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
