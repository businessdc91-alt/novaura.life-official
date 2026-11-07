// novaura_relay.rs — Headless Sovereign WAN Relay, Room Roster & NAT Hole-Punching Server
// Fortified Production Grade Architecture:
// - Non-blocking asynchronous bounded queues per session (eliminates head-of-line blocking DoS)
// - Packets up to 16 MB (files of any size travel in chunks); every buffered byte
//   counts against one memory budget, and a broadcast shares one copy between recipients
// - Connection concurrency limits (global max + per-IP ceiling)
// - Room capacity caps & token-bucket rate limiting
// - Socket-derived WAN IP enforcement (anti-reflection & peer poisoning defense)
// - Strict sender ID ownership & anti-spoofing enforcement
// - Zero-knowledge forwarding for E2EE envelopes
// - Short-lived TURN credentials for calls, when a TURN server shares this relay's secret
// - Always-on archive of signed listings, replayed to nodes that were offline (archive.rs)

mod archive;

use base64::Engine as _;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex};

// ---- Hardened Limits & Operational Parameters -------------------------------
pub const MAX_LINE_BYTES: usize = 16 * 1024 * 1024;  // 16 MB per packet; files of any size go in chunks
pub const MAX_GLOBAL_CONNS: usize = 2048;            // Global server connection cap
pub const MAX_CONNS_PER_IP: usize = 4;               // Max sockets per remote IP
pub const MAX_ROOM_PEERS: usize = 128;               // Max members per swarm room
pub const RATE_LIMIT_BURST: u32 = 30;                // Max burst packet allowance
pub const RATE_LIMIT_REFILL_PER_SEC: f64 = 15.0;     // Token refill rate per second
pub const BYTE_RATE_BURST: f64 = 64.0 * 1024.0 * 1024.0;  // Bytes a socket may send at once...
pub const BYTE_RATE_PER_SEC: f64 = 16.0 * 1024.0 * 1024.0; // ...then per second (reading pauses; nothing is dropped)
pub const CLIENT_QUEUE_CAPACITY: usize = 128;        // Bounded outbound mpsc capacity
pub const CLIENT_QUEUE_BYTES: usize = 96 * 1024 * 1024;   // Outbound backlog per socket before packets to it are dropped
pub const REPLAY_BACKLOG_BYTES: usize = 8 * 1024 * 1024;  // An archive replay waits while the socket has this much queued
pub const DEFAULT_MEMORY_BUDGET_MB: usize = 1536;    // All buffered packet bytes at once (NOVAURA_RELAY_MEMORY_MB)
pub const MEMORY_WAIT_SECS: u64 = 30;                // A reader waits this long for budget before giving up
pub const CLIENT_WRITE_TIMEOUT_SECS: u64 = 5;        // Outbound socket write timeout, plus the time...
pub const MIN_RECEIVE_BYTES_PER_SEC: u64 = 64 * 1024; // ...a receiver this slow needs for the packet
pub const DEFAULT_TURN_TTL_SECS: u64 = 86_400;       // TURN credential lifetime
pub const ARCHIVE_SYNC_INTERVAL_MS: u64 = 30_000;    // Min gap between catch-up syncs per socket

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RelayPacket {
    pub id: String,
    pub sender_id: String,
    pub sender_name: String,
    #[serde(default)]
    pub sender_pubkey: Option<String>,
    #[serde(default)]
    pub recipient_id: Option<String>,
    pub packet_type: String,
    pub payload: serde_json::Value,
    #[serde(default)]
    pub signature: Option<String>,
    pub timestamp_ms: u64,
}

struct TokenBucket {
    tokens: f64,
    last_update_ms: u64,
}

impl TokenBucket {
    fn new() -> Self {
        Self {
            tokens: RATE_LIMIT_BURST as f64,
            last_update_ms: current_timestamp_ms(),
        }
    }

    fn check_and_consume(&mut self) -> bool {
        let now = current_timestamp_ms();
        let elapsed_sec = (now.saturating_sub(self.last_update_ms)) as f64 / 1000.0;
        self.last_update_ms = now;
        self.tokens = (self.tokens + elapsed_sec * RATE_LIMIT_REFILL_PER_SEC).min(RATE_LIMIT_BURST as f64);
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Bytes per socket: a burst, then a steady rate. Over it the reader pauses, so
/// TCP slows the sender down instead of the relay dropping its packets.
struct ByteBucket {
    tokens: f64,
    last_update_ms: u64,
}

impl ByteBucket {
    fn new() -> Self {
        Self { tokens: BYTE_RATE_BURST, last_update_ms: current_timestamp_ms() }
    }

    /// Charges `n` bytes and returns how long to pause before reading on.
    fn take(&mut self, n: usize) -> Duration {
        let now = current_timestamp_ms();
        let elapsed_sec = now.saturating_sub(self.last_update_ms) as f64 / 1000.0;
        self.last_update_ms = now;
        self.tokens = (self.tokens + elapsed_sec * BYTE_RATE_PER_SEC).min(BYTE_RATE_BURST) - n as f64;
        if self.tokens >= 0.0 {
            Duration::ZERO
        } else {
            Duration::from_secs_f64(-self.tokens / BYTE_RATE_PER_SEC)
        }
    }
}

/// Every packet byte the relay holds (lines being read, packets waiting in
/// queues) counts against one budget, so big packets can't exhaust memory.
struct MemoryBudget {
    used: AtomicUsize,
    limit: usize,
}

impl MemoryBudget {
    fn new(limit: usize) -> Self {
        Self { used: AtomicUsize::new(0), limit }
    }

    fn from_env() -> Self {
        let mb = std::env::var("NOVAURA_RELAY_MEMORY_MB")
            .ok()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .filter(|&mb| mb >= 64)
            .unwrap_or(DEFAULT_MEMORY_BUDGET_MB);
        Self::new(mb * 1024 * 1024)
    }

    fn try_reserve(&self, n: usize) -> bool {
        let mut cur = self.used.load(Ordering::Relaxed);
        loop {
            if cur + n > self.limit {
                return false;
            }
            match self.used.compare_exchange_weak(cur, cur + n, Ordering::AcqRel, Ordering::Relaxed) {
                Ok(_) => return true,
                Err(actual) => cur = actual,
            }
        }
    }

    fn release(&self, n: usize) {
        self.used.fetch_sub(n, Ordering::AcqRel);
    }
}

/// One outbound line. A broadcast shares a single Frame between all of its
/// recipients; its bytes go back to the budget when the last one has it written.
struct Frame {
    line: String,
    reserved: usize,
    budget: Option<Arc<MemoryBudget>>,
}

impl Frame {
    /// Lines the relay writes itself (rosters, errors, archive items).
    fn unmetered(line: String) -> Arc<Frame> {
        Arc::new(Frame { line, reserved: 0, budget: None })
    }
}

impl Drop for Frame {
    fn drop(&mut self) {
        if let Some(budget) = &self.budget {
            budget.release(self.reserved);
        }
    }
}

/// A socket's outbound queue, bounded by packet count and by bytes.
#[derive(Clone)]
struct Outbox {
    tx: mpsc::Sender<Arc<Frame>>,
    queued: Arc<AtomicUsize>,
}

impl Outbox {
    /// Queues without waiting; false when the socket is too far behind.
    fn offer(&self, frame: &Arc<Frame>) -> bool {
        let n = frame.line.len();
        if self.queued.load(Ordering::Relaxed) + n > CLIENT_QUEUE_BYTES {
            return false;
        }
        self.queued.fetch_add(n, Ordering::Relaxed);
        if self.tx.try_send(Arc::clone(frame)).is_err() {
            self.queued.fetch_sub(n, Ordering::Relaxed);
            return false;
        }
        true
    }

    /// Queues once the socket's backlog is under `max_backlog` bytes (paces a replay).
    async fn send(&self, frame: Arc<Frame>, max_backlog: usize) -> bool {
        while self.queued.load(Ordering::Relaxed) > max_backlog {
            if self.tx.is_closed() {
                return false;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let n = frame.line.len();
        self.queued.fetch_add(n, Ordering::Relaxed);
        if self.tx.send(frame).await.is_err() {
            self.queued.fetch_sub(n, Ordering::Relaxed);
            return false;
        }
        true
    }
}

/// The line being read from a socket. Its bytes count against the memory budget
/// as they arrive, and move with the line when it is forwarded.
struct LineBuf {
    bytes: Vec<u8>,
    reserved: usize,
    budget: Arc<MemoryBudget>,
}

impl LineBuf {
    fn new(budget: Arc<MemoryBudget>) -> Self {
        Self { bytes: Vec::new(), reserved: 0, budget }
    }

    fn clear(&mut self) {
        self.bytes.clear();
        self.budget.release(std::mem::take(&mut self.reserved));
    }

    /// Hands the line, and its share of the budget, to an outbound frame.
    fn take_frame(&mut self) -> Arc<Frame> {
        let mut bytes = std::mem::take(&mut self.bytes);
        if bytes.last() != Some(&b'\n') {
            bytes.push(b'\n');
        }
        Arc::new(Frame {
            line: String::from_utf8(bytes).unwrap_or_default(),
            reserved: std::mem::take(&mut self.reserved),
            budget: Some(Arc::clone(&self.budget)),
        })
    }
}

impl Drop for LineBuf {
    fn drop(&mut self) {
        self.budget.release(self.reserved);
    }
}

struct ClientSession {
    pub node_id: Option<String>,
    pub node_name: Option<String>,
    pub room: String,
    pub ip: IpAddr,
    pub tcp_port: u16,
    pub outbox: Outbox,
}

struct RelayState {
    pub sessions: HashMap<SocketAddr, ClientSession>,
    pub ip_counts: HashMap<IpAddr, usize>,
}

type SharedState = Arc<Mutex<RelayState>>;

/// TURN server sharing a secret with this relay (coturn `use-auth-secret`).
/// Configured from the environment; without it the relay hands out no TURN
/// credentials and calls fall back to STUN only.
struct TurnConfig {
    secret: String,
    urls: Vec<String>,
    ttl_secs: u64,
}

impl TurnConfig {
    fn from_env() -> Option<Self> {
        let secret = std::env::var("NOVAURA_TURN_SECRET").ok()?.trim().to_string();
        let urls: Vec<String> = std::env::var("NOVAURA_TURN_URLS")
            .ok()?
            .split(',')
            .map(|u| u.trim().to_string())
            .filter(|u| u.starts_with("turn:") || u.starts_with("turns:"))
            .collect();
        if secret.is_empty() || urls.is_empty() {
            return None;
        }
        let ttl_secs = std::env::var("NOVAURA_TURN_TTL_SECS")
            .ok()
            .and_then(|t| t.trim().parse::<u64>().ok())
            .filter(|&t| t >= 600)
            .unwrap_or(DEFAULT_TURN_TTL_SECS);
        Some(Self { secret, urls, ttl_secs })
    }
}

/// TURN REST API credentials: the username carries its own expiry, and the
/// password is base64(HMAC-SHA1(secret, username)), which coturn recomputes.
fn turn_credential(secret: &str, username: &str) -> String {
    let mut mac = Hmac::<Sha1>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(username.as_bytes());
    base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

fn turn_payload(cfg: &TurnConfig, node_id: &str, now_secs: u64) -> serde_json::Value {
    let expires = now_secs + cfg.ttl_secs;
    let user: String = node_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(48)
        .collect();
    let username = format!("{}:{}", expires, if user.is_empty() { "nova" } else { &user });
    serde_json::json!({
        "urls": cfg.urls,
        "credential": turn_credential(&cfg.secret, &username),
        "username": username,
        "ttl_secs": cfg.ttl_secs,
        "expires_at_ms": expires * 1000,
    })
}

static SUPERVISOR_SEQ: AtomicU64 = AtomicU64::new(0);

/// One newline-terminated packet from the relay itself to `recipient`.
fn supervisor_line(recipient: &str, packet_type: &str, payload: serde_json::Value) -> String {
    let now = current_timestamp_ms();
    let pkt = RelayPacket {
        id: format!("sup_{}_{}", now, SUPERVISOR_SEQ.fetch_add(1, Ordering::Relaxed)),
        sender_id: "relay_supervisor".to_string(),
        sender_name: "NovAura Universe Relay".to_string(),
        sender_pubkey: None,
        recipient_id: Some(recipient.to_string()),
        packet_type: packet_type.to_string(),
        payload,
        signature: None,
        timestamp_ms: now,
    };
    format!("{}\n", serde_json::to_string(&pkt).unwrap_or_default())
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn is_safe_peer_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            !v4.is_multicast() && !v4.is_broadcast() && !v4.is_link_local()
        }
        IpAddr::V6(v6) => {
            !v6.is_multicast()
        }
    }
}

fn is_reserved_sender_id(id: &str) -> bool {
    let lower = id.trim().to_lowercase();
    lower == "relay_supervisor"
        || lower == "system"
        || lower == "kernel"
        || lower == "admin"
        || lower.starts_with("relay_")
}

fn hex_to_bytes<const N: usize>(hex: &str) -> Option<[u8; N]> {
    let clean = hex.trim().trim_start_matches("0x");
    if clean.len() != N * 2 || !clean.is_ascii() {
        return None;
    }
    let mut out = [0u8; N];
    for i in 0..N {
        out[i] = u8::from_str_radix(&clean[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

/// Application packets are signed by the sender's identity key and carry
/// `sender_id = did:nova:<full public key hex>`. That differs from the hardware
/// node ID the socket registered with, so the relay accepts it only when the
/// DID is exactly bound to the attached public key and the Ed25519 signature
/// over the canonical packet string verifies. The payload stays opaque.
fn identity_signature_valid(packet: &RelayPacket) -> bool {
    let pub_hex = match packet.sender_pubkey.as_deref() {
        Some(pk) => pk.trim().trim_start_matches("0x").to_ascii_lowercase(),
        None => return false,
    };
    let did = packet.sender_id.trim();
    let did_hex = match did.strip_prefix("did:nova:") {
        Some(rest) => rest.trim_start_matches("0x").to_ascii_lowercase(),
        None => return false,
    };
    if did_hex != pub_hex {
        return false;
    }
    let (pub_bytes, sig_bytes) = match (
        hex_to_bytes::<32>(&pub_hex),
        packet.signature.as_deref().and_then(hex_to_bytes::<64>),
    ) {
        (Some(p), Some(sig)) => (p, sig),
        _ => return false,
    };
    let key = match VerifyingKey::from_bytes(&pub_bytes) {
        Ok(k) => k,
        Err(_) => return false,
    };
    let payload_str = serde_json::to_string(&packet.payload).unwrap_or_default();
    let canonical = format!("{}:{}:{}:{}", packet.packet_type, packet.sender_id, packet.timestamp_ms, payload_str);
    key.verify(canonical.as_bytes(), &Signature::from_bytes(&sig_bytes)).is_ok()
}

/// Reads one newline-terminated line of at most `max_bytes` into `line`. Bytes stay
/// raw until the caller checks the whole line, so a character split across two
/// reads arrives intact. When the memory budget is used up, reading waits for it.
async fn read_bounded_line<R: tokio::io::AsyncBufRead + Unpin>(
    reader: &mut R,
    line: &mut LineBuf,
    max_bytes: usize,
) -> std::io::Result<usize> {
    line.clear();
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            return Ok(line.bytes.len());
        }
        let (chunk_len, complete) = match available.iter().position(|&b| b == b'\n') {
            Some(pos) => (pos + 1, true),
            None => (available.len(), false),
        };
        if line.bytes.len() + chunk_len > max_bytes {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("LINE_TOO_LARGE: packet over the {} MB limit.", max_bytes / (1024 * 1024)),
            ));
        }
        let mut waited_ms = 0;
        while !line.budget.try_reserve(chunk_len) {
            if waited_ms >= MEMORY_WAIT_SECS * 1000 {
                return Err(std::io::Error::new(std::io::ErrorKind::OutOfMemory, "RELAY_BUSY: packet memory budget in use."));
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
            waited_ms += 50;
        }
        line.reserved += chunk_len;
        line.bytes.extend_from_slice(&reader.fill_buf().await?[..chunk_len]);
        reader.consume(chunk_len);
        if complete {
            return Ok(line.bytes.len());
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut port: u16 = 43889;
    let mut data_dir: Option<std::path::PathBuf> = std::env::var("NOVAURA_DATA_DIR")
        .ok()
        .filter(|d| !d.trim().is_empty())
        .map(std::path::PathBuf::from);

    let args: Vec<String> = std::env::args().collect();
    for i in 1..args.len() {
        if args[i] == "--port" && i + 1 < args.len() {
            if let Ok(p) = args[i + 1].parse::<u16>() {
                port = p;
            }
        }
        if args[i] == "--data-dir" && i + 1 < args.len() {
            data_dir = Some(std::path::PathBuf::from(&args[i + 1]));
        }
    }

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;
    println!("═════════════════════════════════════════════════════════════════════");
    println!("  NovAura Sovereign OS — Fortified Headless WAN Relay v2.0.0        ");
    println!("  Listening on TCP: {}                                              ", addr);
    println!("  Bounded Non-Blocking MPSC Queues • 16 MB Packets • Zero DoS        ");
    println!("  Socket-Derived WAN IPs • Anti-Spoofing • In-Memory Roster Only    ");
    println!("═════════════════════════════════════════════════════════════════════");

    let turn: Arc<Option<TurnConfig>> = Arc::new(TurnConfig::from_env());
    match turn.as_ref() {
        Some(cfg) => println!("  TURN credentials: {} (valid {}h)", cfg.urls.join(", "), cfg.ttl_secs / 3600),
        None => println!("  TURN credentials: off (set NOVAURA_TURN_SECRET and NOVAURA_TURN_URLS)"),
    }

    let archive = Arc::new(Mutex::new(archive::Archive::open(data_dir.clone())));
    {
        let a = archive.lock().await;
        match &data_dir {
            Some(dir) if a.is_persistent() => println!("  Listing archive: {} stored in {}", a.len(), dir.display()),
            _ => println!("  Listing archive: memory only (set NOVAURA_DATA_DIR or --data-dir to keep it)"),
        }
    }

    let shared_state: SharedState = Arc::new(Mutex::new(RelayState {
        sessions: HashMap::new(),
        ip_counts: HashMap::new(),
    }));

    let memory = Arc::new(MemoryBudget::from_env());
    println!("  Packets up to {} MB; {} MB of memory for packets in flight (NOVAURA_RELAY_MEMORY_MB)",
        MAX_LINE_BYTES / (1024 * 1024), memory.limit / (1024 * 1024));

    loop {
        // A failed accept (e.g. out of file descriptors) must not stop the relay.
        let (stream, peer_addr) = match listener.accept().await {
            Ok(conn) => conn,
            Err(e) => {
                eprintln!("[Relay Warning] accept failed: {}", e);
                tokio::time::sleep(Duration::from_millis(200)).await;
                continue;
            }
        };
        let peer_ip = peer_addr.ip();
        let state_clone = Arc::clone(&shared_state);
        let turn = Arc::clone(&turn);
        let archive = Arc::clone(&archive);
        let budget = Arc::clone(&memory);

        // 1. Connection Limits & Concurrency Preflight
        {
            let mut state = state_clone.lock().await;
            if state.sessions.len() >= MAX_GLOBAL_CONNS {
                eprintln!("[Relay Warning] Global connection ceiling ({}) reached. Rejecting {}", MAX_GLOBAL_CONNS, peer_addr);
                drop(stream);
                continue;
            }

            let ip_count = state.ip_counts.entry(peer_ip).or_insert(0);
            if *ip_count >= MAX_CONNS_PER_IP {
                eprintln!("[Relay Warning] IP connection limit ({}) exceeded for {}. Rejecting.", MAX_CONNS_PER_IP, peer_ip);
                drop(stream);
                continue;
            }
            *ip_count += 1;
        }

        tokio::spawn(async move {
            let (reader, mut writer) = stream.into_split();
            let (tx, mut rx) = mpsc::channel::<Arc<Frame>>(CLIENT_QUEUE_CAPACITY);
            let outbox = Outbox { tx, queued: Arc::new(AtomicUsize::new(0)) };
            let writer_queued = Arc::clone(&outbox.queued);

            // 2. Dedicated Writer Task with Strict Timeout (Never blocks global state)
            let writer_handle = tokio::spawn(async move {
                while let Some(frame) = rx.recv().await {
                    let len = frame.line.len();
                    // A slow link (a phone hotspot) gets the time a large packet needs.
                    let write_res = tokio::time::timeout(
                        Duration::from_secs(CLIENT_WRITE_TIMEOUT_SECS + len as u64 / MIN_RECEIVE_BYTES_PER_SEC),
                        writer.write_all(frame.line.as_bytes())
                    ).await;
                    writer_queued.fetch_sub(len, Ordering::Relaxed);
                    drop(frame);
                    if write_res.is_err() || write_res.unwrap().is_err() {
                        break; // Connection stalled or failed
                    }
                }
                let _ = writer.shutdown().await;
            });

            // Register session in state
            {
                let mut state = state_clone.lock().await;
                state.sessions.insert(peer_addr, ClientSession {
                    node_id: None,
                    node_name: None,
                    room: "general".to_string(),
                    ip: peer_ip,
                    tcp_port: 43889,
                    outbox: outbox.clone(),
                });
            }

            println!("[Relay] New connection from {}", peer_addr);

            let mut buf_reader = BufReader::new(reader);
            let mut line = LineBuf::new(Arc::clone(&budget));
            let mut rate_limiter = TokenBucket::new();
            let mut byte_limiter = ByteBucket::new();
            let mut last_sync_ms: u64 = 0;

            // 3. Inbound Reader Loop, packets up to MAX_LINE_BYTES
            loop {
                let n = match read_bounded_line(&mut buf_reader, &mut line, MAX_LINE_BYTES).await {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(e) => {
                        eprintln!("[Relay] Closing {}: {}", peer_addr, e);
                        break;
                    }
                };

                // A sender over its byte rate waits here; TCP slows it down.
                let pause = byte_limiter.take(n);
                if !pause.is_zero() {
                    tokio::time::sleep(pause).await;
                }

                let trimmed = std::str::from_utf8(&line.bytes).map(str::trim).unwrap_or("");
                if trimmed.is_empty() {
                    line.clear();
                    continue;
                }

                // Rate limiting check
                if !rate_limiter.check_and_consume() {
                    eprintln!("[Relay] Rate limit exceeded by {}. Throttling packet.", peer_addr);
                    line.clear();
                    continue;
                }

                let packet: RelayPacket = match serde_json::from_str(trimmed) {
                    Ok(p) => p,
                    Err(_) => {
                        line.clear();
                        continue;
                    }
                };

                // Security Check 1: Disallow client packets claiming reserved sender IDs
                if is_reserved_sender_id(&packet.sender_id) {
                    eprintln!("[Relay Security] Blocked forged packet with reserved sender_id '{}' from {}", packet.sender_id, peer_addr);
                    line.clear();
                    continue;
                }

                // 4. Process Registration or Room Change
                if packet.packet_type == "MESH_REGISTER" || packet.packet_type == "MESH_JOIN_ROOM" {
                    let target_room = packet.payload.get("room")
                        .and_then(|r| r.as_str())
                        .unwrap_or("general")
                        .to_string();

                    // Security Check 2: NEVER trust client payload for WAN IP!
                    // WAN IP is strictly taken from the authenticated TCP socket.
                    let authentic_wan_ip = peer_ip.to_string();

                    let extracted_port = packet.payload.get("tcp_port")
                        .and_then(|p| p.as_u64())
                        .map(|p| p as u16)
                        .filter(|&p| p >= 1024)
                        .unwrap_or(43889);

                    let mut roster_peers = Vec::new();
                    let mut peers_to_notify = Vec::new();
                    let mut reg_error: Option<String> = None;

                    {
                        let mut state = state_clone.lock().await;

                        // Security Check 3: Prevent Node ID Hijacking
                        for (&other_addr, s) in state.sessions.iter() {
                            if other_addr != peer_addr && s.node_id.as_deref() == Some(&packet.sender_id) {
                                reg_error = Some(format!("NODE_ID_IN_USE: Active connection already registered for node '{}'", packet.sender_id));
                                break;
                            }
                        }

                        // Security Check 4: Room Capacity Cap
                        if reg_error.is_none() {
                            let room_count = state.sessions.values().filter(|s| s.room == target_room).count();
                            if room_count >= MAX_ROOM_PEERS {
                                reg_error = Some(format!("ROOM_FULL: Room '{}' reached maximum capacity of {} peers.", target_room, MAX_ROOM_PEERS));
                            }
                        }

                        if let Some(err_msg) = reg_error {
                            let err_pkt = RelayPacket {
                                id: format!("err_{}", current_timestamp_ms()),
                                sender_id: "relay_supervisor".to_string(),
                                sender_name: "NovAura Universe Relay".to_string(),
                                sender_pubkey: None,
                                recipient_id: Some(packet.sender_id.clone()),
                                packet_type: "MESH_ERROR".to_string(),
                                payload: serde_json::json!({
                                    "code": "REGISTRATION_FAILED",
                                    "reason": err_msg,
                                }),
                                signature: None,
                                timestamp_ms: current_timestamp_ms(),
                            };
                            if let Ok(err_json) = serde_json::to_string(&err_pkt) {
                                outbox.offer(&Frame::unmetered(format!("{}\n", err_json)));
                            }
                            line.clear();
                            continue;
                        }

                        // Register authentic node identity
                        if let Some(session) = state.sessions.get_mut(&peer_addr) {
                            session.node_id = Some(packet.sender_id.clone());
                            session.node_name = Some(packet.sender_name.clone());
                            session.room = target_room.clone();
                            session.ip = peer_ip;
                            session.tcp_port = extracted_port;
                        }

                        // Gather existing peers in this room
                        for (&addr, s) in state.sessions.iter() {
                            if addr != peer_addr && s.room == target_room {
                                if let (Some(nid), Some(nname)) = (&s.node_id, &s.node_name) {
                                    if is_safe_peer_ip(s.ip) {
                                        roster_peers.push(serde_json::json!({
                                            "id": nid,
                                            "name": nname,
                                            "address": format!("{}:{}", s.ip, s.tcp_port),
                                            "wan_ip": s.ip.to_string(),
                                            "tcp_port": s.tcp_port,
                                            "peer_type": "ROOM_SWARM",
                                            "room": s.room,
                                            "last_seen_ms": current_timestamp_ms(),
                                            "is_connected": true,
                                        }));
                                        peers_to_notify.push(s.outbox.clone());
                                    }
                                }
                            }
                        }
                    }

                    println!("[Relay] Node '{}' ({}) joined Room #{}. Active peers: {}", 
                        packet.sender_name, packet.sender_id, target_room, roster_peers.len());

                    // Send MESH_ROOM_ROSTER to the joining node
                    let roster_pkt = RelayPacket {
                        id: format!("roster_{}", current_timestamp_ms()),
                        sender_id: "relay_supervisor".to_string(),
                        sender_name: "NovAura Universe Relay".to_string(),
                        sender_pubkey: None,
                        recipient_id: Some(packet.sender_id.clone()),
                        packet_type: "MESH_ROOM_ROSTER".to_string(),
                        payload: serde_json::json!({
                            "room": target_room,
                            "peers": roster_peers,
                            "active_count": roster_peers.len() + 1,
                        }),
                        signature: None,
                        timestamp_ms: current_timestamp_ms(),
                    };

                    if let Ok(roster_json) = serde_json::to_string(&roster_pkt) {
                        outbox.offer(&Frame::unmetered(format!("{}\n", roster_json)));
                    }

                    // Broadcast MESH_PEER_JOINED_ROOM to existing peers in the room
                    if is_safe_peer_ip(peer_ip) {
                        let join_pkt = RelayPacket {
                            id: format!("join_{}", current_timestamp_ms()),
                            sender_id: "relay_supervisor".to_string(),
                            sender_name: "NovAura Universe Relay".to_string(),
                            sender_pubkey: None,
                            recipient_id: Some("*".to_string()),
                            packet_type: "MESH_PEER_JOINED_ROOM".to_string(),
                            payload: serde_json::json!({
                                "room": target_room,
                                "peer": {
                                    "id": packet.sender_id,
                                    "name": packet.sender_name,
                                    "address": format!("{}:{}", authentic_wan_ip, extracted_port),
                                    "wan_ip": authentic_wan_ip,
                                    "tcp_port": extracted_port,
                                    "peer_type": "ROOM_SWARM",
                                    "room": target_room,
                                    "last_seen_ms": current_timestamp_ms(),
                                    "is_connected": true,
                                }
                            }),
                            signature: None,
                            timestamp_ms: current_timestamp_ms(),
                        };

                        if let Ok(join_json) = serde_json::to_string(&join_pkt) {
                            let join_frame = Frame::unmetered(format!("{}\n", join_json));
                            for peer in peers_to_notify {
                                peer.offer(&join_frame);
                            }
                        }
                    }

                    line.clear();
                    continue;
                }

                // 5. TURN credentials for this registered node. Answered by the relay
                //    itself and never forwarded.
                if packet.packet_type == "MESH_TURN_REQUEST" {
                    let registered_id = {
                        let state = state_clone.lock().await;
                        state.sessions.get(&peer_addr).and_then(|s| s.node_id.clone())
                    };
                    if let (Some(cfg), Some(node_id)) = (turn.as_ref().as_ref(), registered_id) {
                        let now_ms = current_timestamp_ms();
                        let reply = RelayPacket {
                            id: format!("turn_{}", now_ms),
                            sender_id: "relay_supervisor".to_string(),
                            sender_name: "NovAura Universe Relay".to_string(),
                            sender_pubkey: None,
                            recipient_id: Some(node_id.clone()),
                            packet_type: "MESH_TURN_CREDENTIALS".to_string(),
                            payload: turn_payload(cfg, &node_id, now_ms / 1000),
                            signature: None,
                            timestamp_ms: now_ms,
                        };
                        if let Ok(reply_json) = serde_json::to_string(&reply) {
                            outbox.offer(&Frame::unmetered(format!("{}\n", reply_json)));
                        }
                    }
                    line.clear();
                    continue;
                }

                // 6. Catch-up for a node that was offline: every archived listing newer
                //    than its cursor (original signed packets, oldest first), then a
                //    done marker carrying the new cursor. Never forwarded.
                if packet.packet_type == "MESH_ARCHIVE_SYNC" {
                    let registered_id = {
                        let state = state_clone.lock().await;
                        state.sessions.get(&peer_addr).and_then(|s| s.node_id.clone())
                    };
                    let now_ms = current_timestamp_ms();
                    if let Some(node_id) = registered_id {
                        if now_ms.saturating_sub(last_sync_ms) >= ARCHIVE_SYNC_INTERVAL_MS {
                            last_sync_ms = now_ms;
                            let since = packet.payload.get("since_ms").and_then(|v| v.as_u64()).unwrap_or(0);
                            let entries = archive.lock().await.since(since);
                            let (mut until, mut sent) = (since, 0usize);
                            for entry in entries {
                                let item = serde_json::json!({ "packet": entry.packet, "archived_ms": entry.archived_ms });
                                // Awaiting send (not offer) paces the replay to the socket.
                                let frame = Frame::unmetered(supervisor_line(&node_id, "MESH_ARCHIVE_ITEM", item));
                                if !outbox.send(frame, REPLAY_BACKLOG_BYTES).await {
                                    break;
                                }
                                until = entry.archived_ms;
                                sent += 1;
                            }
                            let done = serde_json::json!({ "until_ms": until, "count": sent });
                            outbox.send(Frame::unmetered(supervisor_line(&node_id, "MESH_ARCHIVE_DONE", done)), REPLAY_BACKLOG_BYTES).await;
                        }
                    }
                    line.clear();
                    continue;
                }

                // 7. Route Regular Packets
                let mut target_senders: Vec<Outbox> = Vec::new();
                let mut accepted = false;

                {
                    let state = state_clone.lock().await;

                    // Security Check 5: Anti-Spoofing enforcement
                    // Ensure the sender_id matches the authenticated registered identity for this socket
                    if let Some(session) = state.sessions.get(&peer_addr) {
                        if let Some(ref registered_id) = session.node_id {
                            if registered_id != &packet.sender_id && !identity_signature_valid(&packet) {
                                eprintln!("[Relay Security] Impersonation attempt: socket {} (id: {}) tried sending as '{}'. Dropped.",
                                    peer_addr, registered_id, packet.sender_id);
                                line.clear();
                                continue;
                            }
                        } else {
                            eprintln!("[Relay Security] Unregistered node tried to send packet from {}. Dropped.", peer_addr);
                            line.clear();
                            continue;
                        }
                        accepted = true;

                        let sender_room = &session.room;

                        if let Some(ref target_id) = packet.recipient_id {
                            if target_id == "*" {
                                // Broadcast strictly within the same room
                                for (&addr, s) in state.sessions.iter() {
                                    if addr != peer_addr && &s.room == sender_room {
                                        target_senders.push(s.outbox.clone());
                                    }
                                }
                            } else {
                                // Directed routing: deliver strictly to the session owning this node_id
                                for (&_addr, s) in state.sessions.iter() {
                                    if s.node_id.as_ref() == Some(target_id) {
                                        target_senders.push(s.outbox.clone());
                                        break;
                                    }
                                }
                            }
                        } else {
                            // Unspecified recipient = room broadcast
                            for (&addr, s) in state.sessions.iter() {
                                if addr != peer_addr && &s.room == sender_room {
                                    target_senders.push(s.outbox.clone());
                                }
                            }
                        }
                    }
                } // Lock released immediately! Zero blocking on I/O.

                // Keep publisher-signed listings for nodes that are offline right now.
                if accepted
                    && archive::ARCHIVED_TYPES.contains(&packet.packet_type.as_str())
                    && identity_signature_valid(&packet)
                {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        let stored = archive.lock().await.offer(
                            &packet.packet_type,
                            &packet.sender_id,
                            packet.timestamp_ms,
                            value,
                            trimmed.len(),
                            current_timestamp_ms(),
                        );
                        if let Err(reason) = stored {
                            eprintln!("[Archive] Listing from {} not stored: {}", peer_addr, reason);
                        }
                    }
                }

                // One copy of the packet, shared by every recipient's queue.
                if !target_senders.is_empty() {
                    let frame = line.take_frame();
                    for target in target_senders {
                        target.offer(&frame);
                    }
                }

                line.clear();
            }

            // 8. Client Disconnect Cleanup & Roster Notification
            let (departed_id, departed_room, peers_to_notify) = {
                let mut state = state_clone.lock().await;
                // Decrement IP count
                if let Some(count) = state.ip_counts.get_mut(&peer_ip) {
                    if *count > 1 {
                        *count -= 1;
                    } else {
                        state.ip_counts.remove(&peer_ip);
                    }
                }

                if let Some(session) = state.sessions.remove(&peer_addr) {
                    let mut list = Vec::new();
                    for (&addr, s) in state.sessions.iter() {
                        if addr != peer_addr && s.room == session.room {
                            list.push(s.outbox.clone());
                        }
                    }
                    (session.node_id, session.room, list)
                } else {
                    (None, "general".to_string(), Vec::new())
                }
            };

            writer_handle.abort(); // Terminate outbound queue writer

            if let Some(ref nid) = departed_id {
                println!("[Relay] Node '{}' disconnected from Room #{}", nid, departed_room);
                let leave_pkt = RelayPacket {
                    id: format!("leave_{}", current_timestamp_ms()),
                    sender_id: "relay_supervisor".to_string(),
                    sender_name: "NovAura Universe Relay".to_string(),
                    sender_pubkey: None,
                    recipient_id: Some("*".to_string()),
                    packet_type: "MESH_PEER_LEFT_ROOM".to_string(),
                    payload: serde_json::json!({
                        "room": departed_room,
                        "node_id": nid,
                    }),
                    signature: None,
                    timestamp_ms: current_timestamp_ms(),
                };

                if let Ok(leave_json) = serde_json::to_string(&leave_pkt) {
                    let leave_frame = Frame::unmetered(format!("{}\n", leave_json));
                    for peer in peers_to_notify {
                        peer.offer(&leave_frame);
                    }
                }
            } else {
                println!("[Relay] Anonymous connection closed for {}", peer_addr);
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turn_credential_matches_rest_api_formula() {
        // From Python: base64(hmac.new(b"north-star", b"1700000000:NODE-ab12", sha1).digest())
        assert_eq!(turn_credential("north-star", "1700000000:NODE-ab12"), "SmCOayHLNUv1XsiELbORw/2rmEU=");
    }

    #[test]
    fn turn_payload_carries_expiry_and_clean_user() {
        let cfg = TurnConfig {
            secret: "north-star".to_string(),
            urls: vec!["turn:203.0.113.7:3478?transport=udp".to_string()],
            ttl_secs: 3600,
        };
        let p = turn_payload(&cfg, "NODE-ab12:<x>", 1_699_996_400);
        assert_eq!(p["username"], "1700000000:NODE-ab12x");
        assert_eq!(p["expires_at_ms"], 1_700_000_000_000u64);
        assert_eq!(p["credential"], turn_credential("north-star", "1700000000:NODE-ab12x"));
        assert_eq!(p["urls"][0], "turn:203.0.113.7:3478?transport=udp");
    }

    #[tokio::test]
    async fn reads_a_large_line_with_characters_split_across_reads() {
        // A 6 MB packet full of 4-byte characters, read through a 7-byte buffer, so
        // characters straddle every read boundary.
        let text = format!("{{\"x\":\"{}\"}}", "🜂".repeat(1_500_000));
        let wire = format!("{}\nnext\n", text);
        let mut reader = BufReader::with_capacity(7, wire.as_bytes());
        let budget = Arc::new(MemoryBudget::new(64 * 1024 * 1024));
        let mut line = LineBuf::new(Arc::clone(&budget));
        let n = read_bounded_line(&mut reader, &mut line, MAX_LINE_BYTES).await.unwrap();
        assert_eq!(n, text.len() + 1);
        assert_eq!(std::str::from_utf8(&line.bytes).unwrap().trim(), text);
        assert_eq!(budget.used.load(Ordering::Relaxed), n);
        read_bounded_line(&mut reader, &mut line, MAX_LINE_BYTES).await.unwrap();
        assert_eq!(line.bytes, b"next\n");
        drop(line);
        assert_eq!(budget.used.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn rejects_a_line_over_the_limit() {
        let wire = vec![b'a'; 2048];
        let mut reader = BufReader::with_capacity(256, &wire[..]);
        let budget = Arc::new(MemoryBudget::new(1024 * 1024));
        let mut line = LineBuf::new(Arc::clone(&budget));
        assert!(read_bounded_line(&mut reader, &mut line, 1024).await.is_err());
        line.clear();
        assert_eq!(budget.used.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn a_shared_frame_returns_its_bytes_when_every_recipient_is_done() {
        let budget = Arc::new(MemoryBudget::new(1024 * 1024));
        let mut reader = BufReader::new(&b"{\"hello\":1}\n"[..]);
        let mut line = LineBuf::new(Arc::clone(&budget));
        read_bounded_line(&mut reader, &mut line, MAX_LINE_BYTES).await.unwrap();
        let frame = line.take_frame();
        assert_eq!(line.reserved, 0);
        let (tx_a, mut rx_a) = mpsc::channel(4);
        let (tx_b, mut rx_b) = mpsc::channel(4);
        let a = Outbox { tx: tx_a, queued: Arc::new(AtomicUsize::new(0)) };
        let b = Outbox { tx: tx_b, queued: Arc::new(AtomicUsize::new(0)) };
        assert!(a.offer(&frame) && b.offer(&frame));
        drop(frame);
        assert_eq!(budget.used.load(Ordering::Relaxed), 12);
        let got_a = rx_a.recv().await.unwrap();
        let got_b = rx_b.recv().await.unwrap();
        assert!(Arc::ptr_eq(&got_a, &got_b));
        assert_eq!(got_a.line, "{\"hello\":1}\n");
        drop(got_a);
        assert_eq!(budget.used.load(Ordering::Relaxed), 12);
        drop(got_b);
        drop(line);
        assert_eq!(budget.used.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn outbox_refuses_more_than_its_byte_backlog() {
        let (tx, _rx) = mpsc::channel(CLIENT_QUEUE_CAPACITY);
        let outbox = Outbox { tx, queued: Arc::new(AtomicUsize::new(0)) };
        let big = Frame::unmetered("x".repeat(MAX_LINE_BYTES));
        let fits = CLIENT_QUEUE_BYTES / MAX_LINE_BYTES;
        for _ in 0..fits {
            assert!(outbox.offer(&big));
        }
        assert!(!outbox.offer(&big));
    }

    #[test]
    fn byte_bucket_pauses_instead_of_dropping() {
        let mut bucket = ByteBucket::new();
        assert!(bucket.take(BYTE_RATE_BURST as usize).is_zero());
        let pause = bucket.take(BYTE_RATE_PER_SEC as usize);
        assert!(pause >= Duration::from_millis(900) && pause <= Duration::from_millis(1100));
    }
}
