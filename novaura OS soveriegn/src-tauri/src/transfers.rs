//! transfers.rs — Files received over the mesh are written straight to disk, piece
//! by piece, so a transfer of any size never sits in memory. The mesh layer
//! (src/services/meshTransfers.js) decrypts each piece and hands it here with its
//! offset. Finishing checks the length and SHA-256 of the whole file before the
//! partial file gets its real name. No Tauri types here, so it is unit tested.

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

/// Partial files live here (inside the received folder) until they check out.
pub const PARTIAL_DIR: &str = ".partial";
const MAX_NAME_CHARS: usize = 150;

struct Incoming {
    dir: PathBuf,
    part: PathBuf,
    name: String,
    size: u64,
    file: File,
}

static OPEN: LazyLock<Mutex<HashMap<String, Incoming>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Transfer ids come from the sender, so only a plain shape is accepted (it names a file).
pub fn valid_id(id: &str) -> bool {
    (8..=80).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// A file name the sender chose, made safe to create on Windows: no folders,
/// no reserved characters or device names, no trailing dots or spaces.
pub fn safe_file_name(name: &str) -> String {
    let last = name.rsplit(['/', '\\']).next().unwrap_or("");
    let cleaned: String = last
        .chars()
        .filter(|c| !c.is_control() && !matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
        .collect();
    let mut cleaned = cleaned.trim().trim_end_matches(['.', ' ']).to_string();
    if cleaned.is_empty() || cleaned.chars().all(|c| c == '.') {
        cleaned = "received-file".to_string();
    }
    let stem_upper = cleaned.split('.').next().unwrap_or("").to_ascii_uppercase();
    let reserved = matches!(stem_upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem_upper.starts_with("COM") || stem_upper.starts_with("LPT"))
            && stem_upper.len() == 4
            && stem_upper.as_bytes()[3].is_ascii_digit());
    if reserved {
        cleaned.insert(0, '_');
    }
    if cleaned.chars().count() > MAX_NAME_CHARS {
        let (stem, ext) = split_ext(&cleaned);
        let keep = MAX_NAME_CHARS.saturating_sub(ext.chars().count()).max(1);
        cleaned = format!("{}{}", stem.chars().take(keep).collect::<String>(), ext);
    }
    cleaned
}

/// "report.final.pdf" -> ("report.final", ".pdf"); "README" -> ("README", "").
fn split_ext(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(i) if i > 0 && name.len() - i <= 16 => (&name[..i], &name[i..]),
        _ => (name, ""),
    }
}

/// `dir/name`, or `dir/name (2).ext` and so on when that is taken.
pub fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = split_ext(name);
    (2..)
        .map(|n| dir.join(format!("{} ({}){}", stem, n, ext)))
        .find(|p| !p.exists())
        .unwrap_or(first)
}

fn part_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(PARTIAL_DIR).join(format!("{}.part", id))
}

/// Opens (or reopens, to resume) the partial file for a transfer into `dir`.
/// Returns how many bytes are already there.
pub fn open(dir: &Path, id: &str, name: &str, size: u64) -> Result<u64, String> {
    if !valid_id(id) {
        return Err("Invalid transfer id.".to_string());
    }
    let part = part_path(dir, id);
    fs::create_dir_all(part.parent().unwrap_or(dir)).map_err(|e| format!("Could not create {}: {}", dir.display(), e))?;
    let file = OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .truncate(false)
        .open(&part)
        .map_err(|e| format!("Could not open the partial file: {}", e))?;
    let have = file.metadata().map(|m| m.len()).unwrap_or(0).min(size);
    let incoming = Incoming { dir: dir.to_path_buf(), part, name: safe_file_name(name), size, file };
    OPEN.lock().map_err(|_| "Transfer table is unavailable.".to_string())?.insert(id.to_string(), incoming);
    Ok(have)
}

/// Writes one decrypted piece at its offset.
pub fn write(id: &str, offset: u64, bytes: &[u8]) -> Result<(), String> {
    let mut open = OPEN.lock().map_err(|_| "Transfer table is unavailable.".to_string())?;
    let incoming = open.get_mut(id).ok_or("This transfer is not open.")?;
    let end = offset.checked_add(bytes.len() as u64).ok_or("Offset out of range.")?;
    if end > incoming.size {
        return Err("A piece reaches past the announced file size.".to_string());
    }
    incoming.file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
    incoming.file.write_all(bytes).map_err(|e| format!("Could not write to disk: {}", e))
}

/// SHA-256 of a file, read in 4 MB blocks.
pub fn hash_file(path: &Path) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 4 * 1024 * 1024];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect())
}

/// Checks the finished file against the sender's SHA-256 and gives it its real
/// name in the received folder. A file that doesn't match is deleted.
pub fn finish(id: &str, sha256_hex: &str) -> Result<PathBuf, String> {
    let incoming = OPEN
        .lock()
        .map_err(|_| "Transfer table is unavailable.".to_string())?
        .remove(id)
        .ok_or("This transfer is not open.")?;
    let Incoming { dir, part, name, size, file } = incoming;
    file.sync_all().map_err(|e| e.to_string())?;
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    drop(file);
    if len != size {
        return Err(format!("The file is incomplete ({} of {} bytes).", len, size));
    }
    let actual = hash_file(&part).map_err(|e| e.to_string())?;
    if !actual.eq_ignore_ascii_case(sha256_hex.trim()) {
        let _ = fs::remove_file(&part);
        return Err("The file arrived damaged (its checksum doesn't match). Ask the sender to send it again.".to_string());
    }
    let target = unique_path(&dir, &name);
    fs::rename(&part, &target).map_err(|e| format!("Could not save {}: {}", target.display(), e))?;
    mark_from_internet(&target);
    Ok(target)
}

/// Marks a received file as coming from the internet (Mark of the Web, zone 3),
/// as a browser does, so Windows SmartScreen and Office warn before a stranger's
/// program or macro runs. A drive that can't hold the mark (FAT32) just skips it.
#[cfg(target_os = "windows")]
fn mark_from_internet(path: &Path) {
    let mut stream = path.as_os_str().to_owned();
    stream.push(":Zone.Identifier");
    if let Err(e) = fs::write(PathBuf::from(stream), "[ZoneTransfer]\r\nZoneId=3\r\n") {
        log::warn!("[Transfers] Could not mark {} as downloaded: {}", path.display(), e);
    }
}

#[cfg(not(target_os = "windows"))]
fn mark_from_internet(_path: &Path) {}

/// Stops a transfer and deletes its partial file.
pub fn cancel(dir: &Path, id: &str) -> Result<(), String> {
    if !valid_id(id) {
        return Err("Invalid transfer id.".to_string());
    }
    let open = OPEN.lock().map_err(|_| "Transfer table is unavailable.".to_string())?.remove(id);
    let part = open.map(|i| i.part).unwrap_or_else(|| part_path(dir, id));
    match fs::remove_file(&part) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// True when `path` is inside `dir` (both resolved), so "show in folder" can't be
/// pointed anywhere else.
pub fn is_inside(dir: &Path, path: &Path) -> bool {
    match (dir.canonicalize(), path.canonicalize()) {
        (Ok(d), Ok(p)) => p.starts_with(d),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nv-xfer-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn names_are_made_safe() {
        assert_eq!(safe_file_name("..\\..\\Windows\\evil.exe"), "evil.exe");
        assert_eq!(safe_file_name("a/b/c<d>:e?.txt"), "cde.txt");
        assert_eq!(safe_file_name("CON.txt"), "_CON.txt");
        assert_eq!(safe_file_name("com1"), "_com1");
        assert_eq!(safe_file_name("computer.txt"), "computer.txt");
        assert_eq!(safe_file_name("notes. . "), "notes");
        assert_eq!(safe_file_name("..."), "received-file");
        assert_eq!(safe_file_name(""), "received-file");
        let long = format!("{}.zip", "x".repeat(400));
        let safe = safe_file_name(&long);
        assert_eq!(safe.chars().count(), MAX_NAME_CHARS);
        assert!(safe.ends_with(".zip"));
        assert!(!valid_id("../../x") && !valid_id("short") && valid_id("xf_0123456789abcdef"));
    }

    #[test]
    fn receives_out_of_order_resumes_and_checks_the_hash() {
        let dir = temp_dir("ok");
        let data: Vec<u8> = (0..10_000u32).map(|i| (i % 251) as u8).collect();
        let sha: String = Sha256::digest(&data).iter().map(|b| format!("{:02x}", b)).collect();
        assert_eq!(open(&dir, "xf_test_one", "project.zip", data.len() as u64).unwrap(), 0);
        write("xf_test_one", 4096, &data[4096..8192]).unwrap();
        write("xf_test_one", 0, &data[..4096]).unwrap();
        // Reopen (a resume): the bytes written so far are reported.
        assert_eq!(open(&dir, "xf_test_one", "project.zip", data.len() as u64).unwrap(), 8192);
        assert!(write("xf_test_one", 8192, &data[8192..]).is_ok());
        assert!(write("xf_test_one", 9_999, &[1, 2]).is_err(), "past the end");
        fs::write(dir.join("project.zip"), b"already here").unwrap();
        let saved = finish("xf_test_one", &sha.to_uppercase()).unwrap();
        assert_eq!(saved, dir.join("project (2).zip"));
        assert_eq!(fs::read(&saved).unwrap(), data);
        assert!(!part_path(&dir, "xf_test_one").exists());
        assert!(is_inside(&dir, &saved));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_damaged_or_short_file_is_refused() {
        let dir = temp_dir("bad");
        open(&dir, "xf_test_bad", "a.bin", 8).unwrap();
        write("xf_test_bad", 0, b"abcd").unwrap();
        assert!(finish("xf_test_bad", "00").unwrap_err().contains("incomplete"));
        open(&dir, "xf_test_bad", "a.bin", 8).unwrap();
        write("xf_test_bad", 4, b"efgh").unwrap();
        assert!(finish("xf_test_bad", &"0".repeat(64)).unwrap_err().contains("damaged"));
        assert!(!part_path(&dir, "xf_test_bad").exists());
        open(&dir, "xf_test_bad", "a.bin", 8).unwrap();
        cancel(&dir, "xf_test_bad").unwrap();
        assert!(!part_path(&dir, "xf_test_bad").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
