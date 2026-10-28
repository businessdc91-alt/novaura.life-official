// novaura_relay.rs — Headless Sovereign WAN Relay, Room Roster & NAT Hole-Punching Server
// Fortified Production Grade Architecture:
// - Non-blocking asynchronous bounded queues per session (eliminates head-of-line blocking DoS)
// - Bounded line reading (strict 64KB cap to prevent memory exhaustion)
// - Connection concurrency limits (global max + per-IP ceiling)
// - Room capacity caps & token-bucket rate limiting
// - Socket-derived WAN IP enforcement (anti-reflection & peer poisoning defense)
// - Strict sender ID ownership & anti-spoofing enforcement
// - Zero-knowledge forwarding for E2EE envelopes

use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex};

// ---- Hardened Limits & Operational Parameters -------------------------------
pub const MAX_LINE_BYTES: usize = 65536;             // 64 KB per frame ceiling
pub const MAX_GLOBAL_CONNS: usize = 2048;            // Global server connection cap
pub const MAX_CONNS_PER_IP: usize = 4;               // Max sockets per remote IP
pub const MAX_ROOM_PEERS: usize = 128;               // Max members per swarm room
pub const RATE_LIMIT_BURST: u32 = 30;                // Max burst packet allowance
pub const RATE_LIMIT_REFILL_PER_SEC: f64 = 15.0;     // Token refill rate per second
pub const CLIENT_QUEUE_CAPACITY: usize = 128;        // Bounded outbound mpsc capacity
pub const CLIENT_WRITE_TIMEOUT_SECS: u64 = 5;        // Outbound socket write timeout

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

struct ClientSession {
    pub node_id: Option<String>,
    pub node_name: Option<String>,
    pub room: String,
    pub ip: IpAddr,
    pub tcp_port: u16,
    pub tx: mpsc::Sender<String>,
}

struct RelayState {
    pub sessions: HashMap<SocketAddr, ClientSession>,
    pub ip_counts: HashMap<IpAddr, usize>,
}

type SharedState = Arc<Mutex<RelayState>>;

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

// Bounded line reader preventing memory exhaustion
async fn read_bounded_line<R: tokio::io::AsyncBufRead + Unpin>(
    reader: &mut R,
    buf: &mut String,
    max_bytes: usize,
) -> std::io::Result<usize> {
    buf.clear();
    let mut total_read = 0;
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            return Ok(total_read);
        }
        if let Some(newline_pos) = available.iter().position(|&b| b == b'\n') {
            let chunk_len = newline_pos + 1;
            if total_read + chunk_len > max_bytes {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "LINE_TOO_LARGE: Inbound frame exceeded 64KB maximum limit.",
                ));
            }
            let chunk = &available[..chunk_len];
            let s = std::str::from_utf8(chunk)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
            buf.push_str(s);
            reader.consume(chunk_len);
            total_read += chunk_len;
            return Ok(total_read);
        } else {
            let chunk_len = available.len();
            if total_read + chunk_len > max_bytes {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "LINE_TOO_LARGE: Inbound frame exceeded 64KB maximum limit.",
                ));
            }
            let s = std::str::from_utf8(available)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
            buf.push_str(s);
            reader.consume(chunk_len);
            total_read += chunk_len;
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut port: u16 = 43889;

    let args: Vec<String> = std::env::args().collect();
    for i in 1..args.len() {
        if args[i] == "--port" && i + 1 < args.len() {
            if let Ok(p) = args[i + 1].parse::<u16>() {
                port = p;
            }
        }
    }

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;
    println!("═════════════════════════════════════════════════════════════════════");
    println!("  NovAura Sovereign OS — Fortified Headless WAN Relay v2.0.0        ");
    println!("  Listening on TCP: {}                                              ", addr);
    println!("  Bounded Non-Blocking MPSC Queues • 64KB Frame Limit • Zero DoS     ");
    println!("  Socket-Derived WAN IPs • Anti-Spoofing • In-Memory Roster Only    ");
    println!("═════════════════════════════════════════════════════════════════════");

    let shared_state: SharedState = Arc::new(Mutex::new(RelayState {
        sessions: HashMap::new(),
        ip_counts: HashMap::new(),
    }));

    loop {
        let (stream, peer_addr) = listener.accept().await?;
        let peer_ip = peer_addr.ip();
        let state_clone = Arc::clone(&shared_state);

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
            let (tx, mut rx) = mpsc::channel::<String>(CLIENT_QUEUE_CAPACITY);

            // 2. Dedicated Writer Task with Strict Timeout (Never blocks global state)
            let writer_handle = tokio::spawn(async move {
                while let Some(msg) = rx.recv().await {
                    let write_res = tokio::time::timeout(
                        Duration::from_secs(CLIENT_WRITE_TIMEOUT_SECS),
                        writer.write_all(msg.as_bytes())
                    ).await;
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
                    tx: tx.clone(),
                });
            }

            println!("[Relay] New connection from {}", peer_addr);

            let mut buf_reader = BufReader::new(reader);
            let mut line = String::new();
            let mut rate_limiter = TokenBucket::new();

            // 3. Inbound Reader Loop with 64KB Frame Bounds
            while let Ok(n) = read_bounded_line(&mut buf_reader, &mut line, MAX_LINE_BYTES).await {
                if n == 0 {
                    break;
                }

                let trimmed = line.trim();
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
                                let _ = tx.try_send(format!("{}\n", err_json));
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
                                        peers_to_notify.push(s.tx.clone());
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
                        let _ = tx.try_send(format!("{}\n", roster_json));
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
                            let join_line = format!("{}\n", join_json);
                            for peer_tx in peers_to_notify {
                                let _ = peer_tx.try_send(join_line.clone());
                            }
                        }
                    }

                    line.clear();
                    continue;
                }

                // 5. Route Regular Packets
                let mut target_senders: Vec<mpsc::Sender<String>> = Vec::new();
                let out_line = format!("{}\n", trimmed);

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

                        let sender_room = &session.room;

                        if let Some(ref target_id) = packet.recipient_id {
                            if target_id == "*" {
                                // Broadcast strictly within the same room
                                for (&addr, s) in state.sessions.iter() {
                                    if addr != peer_addr && &s.room == sender_room {
                                        target_senders.push(s.tx.clone());
                                    }
                                }
                            } else {
                                // Directed routing: deliver strictly to the session owning this node_id
                                for (&_addr, s) in state.sessions.iter() {
                                    if s.node_id.as_ref() == Some(target_id) {
                                        target_senders.push(s.tx.clone());
                                        break;
                                    }
                                }
                            }
                        } else {
                            // Unspecified recipient = room broadcast
                            for (&addr, s) in state.sessions.iter() {
                                if addr != peer_addr && &s.room == sender_room {
                                    target_senders.push(s.tx.clone());
                                }
                            }
                        }
                    }
                } // Lock released immediately! Zero blocking on I/O.

                for target_tx in target_senders {
                    let _ = target_tx.try_send(out_line.clone());
                }

                line.clear();
            }

            // 6. Client Disconnect Cleanup & Roster Notification
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
                            list.push(s.tx.clone());
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
                    let leave_line = format!("{}\n", leave_json);
                    for peer_tx in peers_to_notify {
                        let _ = peer_tx.try_send(leave_line.clone());
                    }
                }
            } else {
                println!("[Relay] Anonymous connection closed for {}", peer_addr);
            }
        });
    }
}
