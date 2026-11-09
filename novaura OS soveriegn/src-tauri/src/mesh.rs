// mesh.rs — Sovereign Physical P2P Mesh Network Engine
// Direct Machine-to-Machine networking over LAN (UDP Beaconing + TCP Framing)
// and WAN (STUN Public IP Resolution + Direct Hole-Punching + Headless WAN Relay Routing)

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream, UdpSocket};
use tokio::sync::{mpsc, RwLock};

pub const DEFAULT_UDP_BEACON_PORT: u16 = 43888;
pub const DEFAULT_TCP_LISTEN_PORT: u16 = 43889;
pub const DEFAULT_PUBLIC_RELAY: &str = "relay.novaura.life:43889";

/// Packet types the relay may replay from its archive (see relay/src/archive.rs).
const ARCHIVE_REPLAY_TYPES: &[&str] = &["MESH_MARKETPLACE_LISTING"];

/// The relay chosen in the Peering window, kept across restarts. An empty file
/// means the user turned the relay off; no file means the default relay.
fn relay_setting_path() -> std::path::PathBuf {
    crate::get_app_data_dir().join("mesh_relay.txt")
}

fn load_relay_setting() -> Option<String> {
    match std::fs::read_to_string(relay_setting_path()) {
        Ok(saved) => Some(saved.trim().to_string()).filter(|s| !s.is_empty()),
        Err(_) => Some(DEFAULT_PUBLIC_RELAY.to_string()),
    }
}

fn save_relay_setting(relay_address: &Option<String>) {
    let path = relay_setting_path();
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Err(e) = std::fs::write(&path, relay_address.as_deref().unwrap_or("").trim()) {
        log::warn!("[SovereignMesh] Could not save the relay setting: {}", e);
    }
}
/// One packet at most; files of any size travel as a series of chunk packets.
pub const MAX_PACKET_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_PEERS_PER_ROOM: usize = 100;
pub const MAX_CONCURRENT_SOCKETS_PER_IP: usize = 8;
pub const RELAY_OUTBOUND_QUEUE: usize = 256;
/// Unsent bytes allowed in the relay tunnel before a send waits, so a big upload
/// paces itself to the link instead of piling up in memory.
pub const RELAY_BACKLOG_BYTES: usize = 16 * 1024 * 1024;
/// How long a send waits for room in the tunnel before reporting failure.
pub const RELAY_SEND_WAIT_SECS: u64 = 180;
/// An inbound connection with no bytes at all for this long is closed.
pub const INBOUND_IDLE_SECS: u64 = 30;
/// After the idle grace, a packet still arriving must average this rate, so a
/// socket that drips a byte at a time is closed instead of held open forever.
pub const MIN_INBOUND_BYTES_PER_SEC: usize = 16 * 1024;
/// Inbound LAN sockets at once, from every address together.
pub const MAX_INBOUND_SOCKETS: usize = 64;
/// Bytes all inbound LAN sockets may buffer at once. A socket whose packet would
/// go over it is closed, so many half-sent packets can't exhaust memory.
pub const INBOUND_MEMORY_BUDGET: usize = 512 * 1024 * 1024;
/// Peers learned from LAN beacons at once.
pub const MAX_LAN_PEERS: usize = 256;
/// Packet IDs remembered for duplicate detection. Each is kept for the drift
/// window, after which a replay fails the timestamp check anyway.
pub const MAX_SEEN_PACKETS: usize = 200_000;
/// Packets and beacons more than this far from the local clock are dropped.
pub const MAX_CLOCK_DRIFT_MS: u64 = 300_000;
pub const DIRECT_CONNECT_TIMEOUT_SECS: u64 = 3;

static PACKET_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
static INBOUND_BUFFERED: AtomicUsize = AtomicUsize::new(0);

fn take_inbound_budget(n: usize) -> bool {
    let mut used = INBOUND_BUFFERED.load(Ordering::SeqCst);
    loop {
        if used + n > INBOUND_MEMORY_BUDGET {
            return false;
        }
        match INBOUND_BUFFERED.compare_exchange_weak(used, used + n, Ordering::SeqCst, Ordering::SeqCst) {
            Ok(_) => return true,
            Err(actual) => used = actual,
        }
    }
}

fn give_inbound_budget(n: usize) {
    if n > 0 {
        INBOUND_BUFFERED.fetch_sub(n, Ordering::SeqCst);
    }
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Routing ID of an identity key: NODE- and the first 128 bits of SHA-256 of the
/// raw public key (src/services/meshNodeIds.js and the relay compute the same).
/// Only the key's holder can register it with a relay or sign a beacon for it.
pub fn node_id_for_pubkey(pub_bytes: &[u8; 32]) -> String {
    let digest = Sha256::digest(pub_bytes);
    let mut id = String::from("NODE-");
    for b in &digest[..16] {
        id.push_str(&format!("{:02X}", b));
    }
    id
}

pub fn node_id_for_pub_hex(pub_hex: &str) -> Option<String> {
    hex_to_32_bytes(pub_hex).map(|b| node_id_for_pubkey(&b))
}

fn verify_hex_signature(pub_hex: &str, message: &str, sig_hex: &str) -> bool {
    let (Some(pub_bytes), Some(sig_bytes)) = (hex_to_32_bytes(pub_hex), hex_to_64_bytes(sig_hex)) else {
        return false;
    };
    let Ok(key) = VerifyingKey::from_bytes(&pub_bytes) else { return false };
    key.verify(message.as_bytes(), &Signature::from_bytes(&sig_bytes)).is_ok()
}

/// What a relay login signs: the relay's one-time challenge and the ID claimed.
pub fn relay_register_message(nonce: &str, node_id: &str) -> String {
    format!("NOVA-RELAY-REGISTER-v1\n{}\n{}", nonce, node_id)
}

/// What a LAN beacon signs, for each ID it announces.
fn beacon_message(node_id: &str, node_name: &str, tcp_port: u16, timestamp_ms: u64) -> String {
    format!("NOVA-BEACON-v2\n{}\n{}\n{}\n{}", node_id, node_name, tcp_port, timestamp_ms)
}

/// Names shown to peers: printable, at most 48 characters.
fn clean_node_name(name: &str) -> String {
    name.chars().filter(|c| !c.is_control()).take(48).collect::<String>().trim().to_string()
}

/// Packet IDs go into the signed string, so they may not hold separators.
fn is_valid_packet_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

/// A key this node answers for: the profile's identity, and on the team node the
/// beta feedback inbox as an alias. Each one's routing ID comes from its key.
#[derive(Clone)]
struct NodeKey {
    signing: SigningKey,
    pub_hex: String,
    node_id: String,
}

impl NodeKey {
    fn from_secret_hex(hex: &str) -> Option<Self> {
        let signing = SigningKey::from_bytes(&hex_to_32_bytes(hex)?);
        let pub_bytes = signing.verifying_key().to_bytes();
        Some(Self { node_id: node_id_for_pubkey(&pub_bytes), pub_hex: to_hex(&pub_bytes), signing })
    }

    fn sign_hex(&self, message: &str) -> String {
        to_hex(&self.signing.sign(message.as_bytes()).to_bytes())
    }
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn hex_to_32_bytes(hex: &str) -> Option<[u8; 32]> {
    let clean = hex.trim().trim_start_matches("0x");
    if clean.len() != 64 {
        return None;
    }
    let mut bytes = [0u8; 32];
    for i in 0..32 {
        bytes[i] = u8::from_str_radix(&clean[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(bytes)
}

fn hex_to_64_bytes(hex: &str) -> Option<[u8; 64]> {
    let clean = hex.trim().trim_start_matches("0x");
    if clean.len() != 128 {
        return None;
    }
    let mut bytes = [0u8; 64];
    for i in 0..64 {
        bytes[i] = u8::from_str_radix(&clean[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(bytes)
}

fn decode_b64url_sig(s: &str) -> Option<[u8; 64]> {
    let clean = s.trim().trim_end_matches('=');
    let bytes = URL_SAFE_NO_PAD.decode(clean).ok()?;
    if bytes.len() == 64 {
        let mut arr = [0u8; 64];
        arr.copy_from_slice(&bytes);
        Some(arr)
    } else {
        None
    }
}

pub fn is_safe_peer_address(addr_str: &str) -> bool {
    let sock: SocketAddr = match addr_str.parse() {
        Ok(s) => s,
        Err(_) => return false,
    };

    let ip = sock.ip();
    if ip.is_unspecified() {
        return false;
    }

    match ip {
        IpAddr::V4(v4) => {
            if v4.is_loopback() || v4.is_broadcast() || v4.is_multicast() || v4.is_link_local() {
                return false;
            }
            if sock.port() == 0 {
                return false;
            }
            true
        }
        IpAddr::V6(v6) => {
            if v6.is_loopback() || v6.is_multicast() || v6.is_unspecified() {
                return false;
            }
            if sock.port() == 0 {
                return false;
            }
            true
        }
    }
}

/// The signed form of a packet. It covers the packet ID and the recipient, so a
/// signed packet can't be sent again under a new ID or pointed at another node.
/// A broadcast's recipient is "*". Must match canonicalPacketString in sovereignMesh.js.
pub fn canonical_packet_string(
    packet_type: &str,
    sender_id: &str,
    timestamp_ms: u64,
    packet_id: &str,
    recipient_id: Option<&str>,
    payload: &serde_json::Value,
) -> String {
    let payload_str = match serde_json::to_string(payload) {
        Ok(s) => s,
        Err(_) => "".to_string(),
    };
    let recipient = recipient_id.filter(|r| !r.is_empty()).unwrap_or("*");
    format!(
        "NOVA-PACKET-v2\n{}\n{}\n{}\n{}\n{}\n{}",
        packet_type, sender_id, timestamp_ms, packet_id, recipient, payload_str
    )
}

pub fn verify_packet_signature(packet: &MeshPacket) -> bool {
    let pubkey_str = match &packet.sender_pubkey {
        Some(pk) if !pk.trim().is_empty() => pk.trim(),
        _ => return false,
    };

    let clean_pub = pubkey_str.trim_start_matches("0x");
    let pub_bytes = match hex_to_32_bytes(clean_pub) {
        Some(b) => b,
        None => return false,
    };

    let sig_str = match &packet.signature {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return false,
    };

    let sig_bytes = if sig_str.len() == 128 {
        match hex_to_64_bytes(sig_str) {
            Some(b) => b,
            None => return false,
        }
    } else {
        match decode_b64url_sig(sig_str) {
            Some(b) => b,
            None => return false,
        }
    };

    // 1. sender_id must name exactly this public key. A prefix/contains match let a
    //    crafted id (did:nova:<victim key><attacker prefix>) pass with the attacker's key.
    let sid = packet.sender_id.as_str();
    let did_form = format!("did:nova:{}", clean_pub);
    if sid != did_form && sid != clean_pub && sid != pubkey_str {
        return false;
    }

    if !is_valid_packet_id(&packet.id)
        || packet.recipient_id.as_deref().is_some_and(|r| r.len() > 160 || r.chars().any(char::is_control))
    {
        return false;
    }

    // 2. Cryptographic signature verification via Ed25519
    let verifying_key = match VerifyingKey::from_bytes(&pub_bytes) {
        Ok(vk) => vk,
        Err(_) => return false,
    };

    let signature = match Signature::from_slice(&sig_bytes) {
        Ok(sig) => sig,
        Err(_) => return false,
    };

    let canonical = canonical_packet_string(
        &packet.packet_type,
        &packet.sender_id,
        packet.timestamp_ms,
        &packet.id,
        packet.recipient_id.as_deref(),
        &packet.payload,
    );

    verifying_key.verify(canonical.as_bytes(), &signature).is_ok()
}

/// The UI picks a signed packet's ID, since the signature covers it; anything
/// else gets a fresh one.
fn packet_id_or_new(packet_id: Option<String>, timestamp_ms: u64) -> String {
    match packet_id.filter(|id| is_valid_packet_id(id)) {
        Some(id) => id,
        None => {
            let seq = PACKET_COUNTER.fetch_add(1, Ordering::Relaxed);
            format!("pkt_{}_{}", timestamp_ms, seq)
        }
    }
}

/// Queues a small control line (heartbeat, TURN request) on the relay tunnel.
/// A full queue just skips it; false means the tunnel is gone.
fn queue_control(control: &mpsc::WeakSender<String>, queued: &AtomicUsize, line: &str) -> bool {
    let Some(tx) = control.upgrade() else { return false };
    queued.fetch_add(line.len(), std::sync::atomic::Ordering::Relaxed);
    if tx.try_send(line.to_string()).is_err() {
        queued.fetch_sub(line.len(), std::sync::atomic::Ordering::Relaxed);
    }
    true
}

/// One-shot direct TCP delivery with a short connect timeout, so an unreachable
/// WAN peer behind NAT does not stall sends for the OS default (~20s).
async fn write_direct(addr: &str, line: &str) -> bool {
    let connect = tokio::time::timeout(
        std::time::Duration::from_secs(DIRECT_CONNECT_TIMEOUT_SECS),
        TcpStream::connect(addr),
    )
    .await;
    match connect {
        Ok(Ok(mut stream)) => stream.write_all(line.as_bytes()).await.is_ok(),
        _ => false,
    }
}

/// Appends bytes to `out` up to the next newline (not included) and returns the
/// line's length, or 0 at end of stream. The caller clears `out` after using a
/// line. Bytes stay raw until the line is complete, so a character split across
/// two reads arrives intact, and the read is cancel-safe: if a select or timeout
/// drops it mid-line, the bytes so far stay in `out` and the next call goes on.
pub async fn read_bounded_line<R: tokio::io::AsyncBufRead + Unpin>(
    reader: &mut R,
    out: &mut Vec<u8>,
    max_bytes: usize,
) -> std::io::Result<usize> {
    read_budgeted_line(reader, out, max_bytes, &mut |_| true).await
}

/// read_bounded_line, asking `reserve` for room before buffering each piece. When
/// it refuses, the line is dropped with an error.
pub async fn read_budgeted_line<R: tokio::io::AsyncBufRead + Unpin>(
    reader: &mut R,
    out: &mut Vec<u8>,
    max_bytes: usize,
    reserve: &mut (dyn FnMut(usize) -> bool + Send),
) -> std::io::Result<usize> {
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            return Ok(if out.is_empty() { 0 } else { out.len() });
        }
        let (chunk_len, take, complete) = match available.iter().position(|&b| b == b'\n') {
            Some(pos) => (pos, pos + 1, true),
            None => (available.len(), available.len(), false),
        };
        if out.len() + chunk_len > max_bytes {
            reader.consume(take);
            out.clear();
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("FRAME_OVERFLOW: packet over the {} MB limit.", max_bytes / (1024 * 1024)),
            ));
        }
        if !reserve(chunk_len) {
            reader.consume(take);
            out.clear();
            return Err(std::io::Error::new(
                std::io::ErrorKind::OutOfMemory,
                "INBOUND_BUDGET: too many packets arriving at once.",
            ));
        }
        out.extend_from_slice(&available[..chunk_len]);
        reader.consume(take);
        if complete {
            // An empty line (a bare newline) is skipped, not mistaken for end of stream.
            if out.is_empty() {
                continue;
            }
            return Ok(out.len());
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MeshPeer {
    pub id: String,
    pub name: String,
    pub address: String, // e.g., "98.142.12.5:43889" or "192.168.1.50:43889"
    pub peer_type: String, // "LAN" | "DIRECT_WAN" | "WAN_RELAY"
    pub last_seen_ms: u64,
    pub is_connected: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MeshPacket {
    pub id: String,
    pub sender_id: String,
    pub sender_name: String,
    #[serde(default)]
    pub sender_pubkey: Option<String>,
    #[serde(default)]
    pub recipient_id: Option<String>, // None or "*" for broadcast
    pub packet_type: String, // "MESH_MAIL", "MESH_POST", "MESH_LITERATURE_PUBLISH", "MESH_SEARCH_QUERY", etc.
    pub payload: serde_json::Value,
    #[serde(default)]
    pub signature: Option<String>,
    pub timestamp_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MeshStatus {
    pub node_id: String,
    pub node_name: String,
    pub lan_ip: String,
    pub wan_ip: String,
    pub current_room: String,
    pub udp_beacon_port: u16,
    pub tcp_listen_port: u16,
    pub peer_count: usize,
    pub peers: Vec<MeshPeer>,
    pub relay_address: Option<String>,
    pub relay_connected: bool,
    pub invite_code: String,
    /// TURN server credentials from the relay ({ urls, username, credential,
    /// expires_at_ms }), when it runs one. Calls use them when no direct path exists.
    pub turn: Option<serde_json::Value>,
}

/// Short-lived TURN credentials the relay issued to this node.
struct TurnGrant {
    payload: serde_json::Value,
    expires_ms: u64,
    ttl_ms: u64,
}

impl TurnGrant {
    /// Accepts only well-formed TURN credentials, so a bad relay reply cannot
    /// hand the call stack arbitrary ICE servers.
    fn from_payload(payload: &serde_json::Value) -> Option<Self> {
        let urls: Vec<String> = payload
            .get("urls")?
            .as_array()?
            .iter()
            .filter_map(|u| u.as_str())
            .filter(|u| (u.starts_with("turn:") || u.starts_with("turns:")) && u.len() < 256)
            .take(8)
            .map(str::to_string)
            .collect();
        let username = payload.get("username")?.as_str()?;
        let credential = payload.get("credential")?.as_str()?;
        let expires_ms = payload.get("expires_at_ms")?.as_u64()?;
        let ttl_ms = payload.get("ttl_secs").and_then(|t| t.as_u64()).unwrap_or(86_400) * 1000;
        if urls.is_empty() || username.len() > 128 || credential.len() > 128 || expires_ms <= current_timestamp_ms() {
            return None;
        }
        Some(Self {
            payload: serde_json::json!({
                "urls": urls,
                "username": username,
                "credential": credential,
                "expires_at_ms": expires_ms,
            }),
            expires_ms,
            ttl_ms,
        })
    }

    /// Ask again once half the lifetime has passed, so a new call always gets
    /// credentials that outlast it by hours.
    fn needs_refresh(&self) -> bool {
        current_timestamp_ms() + self.ttl_ms / 2 >= self.expires_ms
    }
}

/// A LAN announcement, signed by the key behind each ID it names, so a beacon
/// can't claim another node's ID or move its address.
#[derive(Serialize, Deserialize, Debug)]
struct BeaconMessage {
    pub proto: String,
    pub node_id: String,
    pub node_name: String,
    pub tcp_port: u16,
    pub timestamp_ms: u64,
    #[serde(default)]
    pub pubkey: String,
    #[serde(default)]
    pub sig: String,
    #[serde(default)]
    pub aliases: Vec<BeaconAlias>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct BeaconAlias {
    pub pubkey: String,
    pub sig: String,
}

const BEACON_PROTO: &str = "NOVA_BEACON_V2";

struct MeshInner {
    /// Empty until the UI hands over the identity key (set_identity).
    pub node_id: String,
    pub node_name: String,
    /// The identity key, then any aliases. Nothing is announced while it's empty.
    keys: Vec<NodeKey>,
    pub current_room: String,
    pub tcp_port: u16,
    pub udp_port: u16,
    pub lan_ip: String,
    pub wan_ip: String,
    pub peers: HashMap<String, MeshPeer>,
    /// "sender|packet id" -> the packet's timestamp, for duplicate detection.
    pub seen_packet_ids: HashMap<String, u64>,
    /// Node ID -> timestamp of the newest beacon accepted for it.
    beacon_seen: HashMap<String, u64>,
    /// No relay login before this time (set when the relay says the ID is in use elsewhere).
    relay_retry_at_ms: u64,
    pub relay_address: Option<String>,
    pub relay_connected: bool,
    /// Outbound queue into the single registered relay tunnel. The relay only
    /// forwards frames from a registered socket, so every relay-bound packet
    /// must travel through this tunnel rather than a fresh connection.
    pub relay_tx: Option<RelayTunnel>,
    pub active_connections_per_ip: HashMap<IpAddr, usize>,
    turn: Option<TurnGrant>,
}

impl MeshInner {
    /// Whether this node answers for `id` (its own ID or an alias).
    fn is_mine(&self, id: &str) -> bool {
        self.keys.iter().any(|k| k.node_id == id)
    }
}

/// The relay tunnel's outbound queue and how many of its bytes are still unsent.
#[derive(Clone)]
pub struct RelayTunnel {
    tx: mpsc::Sender<String>,
    queued: Arc<AtomicUsize>,
}

#[derive(Clone)]
pub struct MeshManager {
    inner: Arc<RwLock<MeshInner>>,
    app_handle: Option<tauri::AppHandle>,
}

impl MeshManager {
    /// The node has no ID until set_identity: its ID comes from the identity key,
    /// and the PC name is never announced (peers see the profile's display name).
    pub fn new() -> Self {
        let lan_ip = "127.0.0.1".to_string();

        let inner = MeshInner {
            node_id: String::new(),
            node_name: "Sovereign node".to_string(),
            keys: Vec::new(),
            current_room: "general".to_string(),
            tcp_port: DEFAULT_TCP_LISTEN_PORT,
            udp_port: DEFAULT_UDP_BEACON_PORT,
            lan_ip,
            wan_ip: "0.0.0.0".to_string(),
            peers: HashMap::new(),
            seen_packet_ids: HashMap::new(),
            beacon_seen: HashMap::new(),
            relay_retry_at_ms: 0,
            relay_address: load_relay_setting(),
            relay_connected: false,
            relay_tx: None,
            active_connections_per_ip: HashMap::new(),
            turn: None,
        };

        Self {
            inner: Arc::new(RwLock::new(inner)),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Hands the mesh the profile's identity key, plus alias keys (the beta feedback
    /// inbox on the team node). The node ID comes from the identity key; a new key
    /// or name logs in to the relay again. Returns the node ID.
    pub async fn set_identity(
        &self,
        secret_key_hex: String,
        node_name: Option<String>,
        alias_secrets: Vec<String>,
    ) -> Result<String, String> {
        let primary = NodeKey::from_secret_hex(&secret_key_hex)
            .ok_or_else(|| "The identity key is not a 32-byte hex key.".to_string())?;
        let mut keys = vec![primary];
        for secret in alias_secrets.iter().take(4) {
            if let Some(alias) = NodeKey::from_secret_hex(secret) {
                if !keys.iter().any(|k| k.node_id == alias.node_id) {
                    keys.push(alias);
                }
            }
        }
        let name = node_name.map(|n| clean_node_name(&n)).filter(|n| !n.is_empty());

        let mut state = self.inner.write().await;
        let ids_changed = !state.keys.iter().map(|k| &k.node_id).eq(keys.iter().map(|k| &k.node_id));
        let name_changed = name.as_ref().is_some_and(|n| n != &state.node_name);
        if let Some(n) = name {
            state.node_name = n;
        }
        state.node_id = keys[0].node_id.clone();
        state.keys = keys;
        if ids_changed || name_changed {
            // Closing the tunnel makes the supervisor log in again under the new identity.
            state.relay_tx = None;
            state.relay_connected = false;
            state.relay_retry_at_ms = 0;
        }
        log::info!("[SovereignMesh] Identity set: node {}", state.node_id);
        Ok(state.node_id.clone())
    }

    pub async fn start(&self) {
        // 1. Start TCP Listener with port search fallback (43889 -> 43900)
        let mut bound_tcp: Option<(TcpListener, u16)> = None;
        for port in DEFAULT_TCP_LISTEN_PORT..DEFAULT_TCP_LISTEN_PORT + 15 {
            let addr = format!("0.0.0.0:{}", port);
            if let Ok(listener) = TcpListener::bind(&addr).await {
                bound_tcp = Some((listener, port));
                break;
            }
        }

        let actual_tcp_port = if let Some((_, port)) = bound_tcp.as_ref() {
            *port
        } else {
            DEFAULT_TCP_LISTEN_PORT
        };

        {
            let mut state = self.inner.write().await;
            state.tcp_port = actual_tcp_port;
        }

        // Spawn TCP Inbound Server Task
        if let Some((listener, _)) = bound_tcp {
            let self_clone = self.clone();
            tokio::spawn(async move {
                self_clone.run_tcp_server(listener).await;
            });
        }

        // 2. Start UDP Beacon Receiver (LAN)
        let self_clone2 = self.clone();
        tokio::spawn(async move {
            self_clone2.run_udp_beacon_receiver().await;
        });

        // 3. Start UDP Beacon Transmitter (LAN)
        let self_clone3 = self.clone();
        tokio::spawn(async move {
            self_clone3.run_udp_beacon_transmitter(actual_tcp_port).await;
        });

        // 4. The public address comes from the relay's challenge (the address it
        //    sees this node connect from), so no third-party STUN server is asked.

        // 5. Start Background WAN Relay Client Tunnel
        let self_clone_relay = self.clone();
        tokio::spawn(async move {
            self_clone_relay.run_relay_client_supervisor().await;
        });

        // 6. Prune Stale Peers Task (every 10s)
        let self_clone4 = self.clone();
        tokio::spawn(async move {
            self_clone4.run_peer_pruner().await;
        });
    }

    async fn run_tcp_server(&self, listener: TcpListener) {
        log::info!("[SovereignMesh] Native TCP server listening on port {}", listener.local_addr().map(|a| a.to_string()).unwrap_or_default());
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    let ip = addr.ip();
                    {
                        let mut state = self.inner.write().await;
                        let total: usize = state.active_connections_per_ip.values().sum();
                        if total >= MAX_INBOUND_SOCKETS {
                            log::warn!("[SovereignMesh] Throttled incoming connection from {}: {} sockets already open.", ip, total);
                            drop(stream);
                            continue;
                        }
                        let count = state.active_connections_per_ip.entry(ip).or_insert(0);
                        if *count >= MAX_CONCURRENT_SOCKETS_PER_IP {
                            log::warn!("[SovereignMesh] Throttled incoming connection: IP {} exceeded {} concurrent sockets.", ip, MAX_CONCURRENT_SOCKETS_PER_IP);
                            drop(stream);
                            continue;
                        }
                        *count += 1;
                    }

                    let self_inner = self.clone();
                    tokio::spawn(async move {
                        self_inner.handle_inbound_stream(stream, addr).await;
                    });
                }
                Err(err) => {
                    log::warn!("[SovereignMesh] TCP Accept error: {}", err);
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    async fn handle_inbound_stream(&self, stream: TcpStream, addr: SocketAddr) {
        let ip = addr.ip();
        let (reader, _) = stream.into_split();
        let mut buf_reader = BufReader::new(reader);
        let mut line: Vec<u8> = Vec::new();
        // Bytes of `line` reserved from the shared inbound budget.
        let mut held: usize = 0;
        let mut line_started: Option<std::time::Instant> = None;

        loop {
            let before = line.len();
            let read_res = {
                let mut reserve = |n: usize| {
                    let ok = take_inbound_budget(n);
                    if ok {
                        held += n;
                    }
                    ok
                };
                tokio::time::timeout(
                    std::time::Duration::from_secs(INBOUND_IDLE_SECS),
                    read_budgeted_line(&mut buf_reader, &mut line, MAX_PACKET_BYTES, &mut reserve),
                )
                .await
            };

            match read_res {
                Ok(Ok(0)) => break, // Clean EOF
                Ok(Ok(_)) => {
                    if let Ok(packet) = serde_json::from_slice::<MeshPacket>(&line) {
                        self.process_incoming_packet(packet, false).await;
                    } else {
                        log::warn!("[SovereignMesh] Malformed JSON packet from {}", addr);
                    }
                    line.clear();
                    give_inbound_budget(std::mem::take(&mut held));
                    line_started = None;
                }
                Ok(Err(err)) => {
                    log::warn!("[SovereignMesh] Bounded frame violation or read error from {}: {}", addr, err);
                    break;
                }
                // A large packet on a slow link is still arriving; only a silent
                // socket, or one sending far too slowly, is closed.
                Err(_) if line.len() > before => {
                    let started = *line_started.get_or_insert_with(std::time::Instant::now);
                    let secs = started.elapsed().as_secs() as usize;
                    if secs >= INBOUND_IDLE_SECS as usize && line.len() < secs * MIN_INBOUND_BYTES_PER_SEC {
                        log::warn!("[SovereignMesh] Closing {}: a packet arriving at under {} KB/s.", addr, MIN_INBOUND_BYTES_PER_SEC / 1024);
                        break;
                    }
                    continue;
                }
                Err(_) => {
                    log::debug!("[SovereignMesh] Inbound TCP stream from {} timed out (idle {}s).", addr, INBOUND_IDLE_SECS);
                    break;
                }
            }
        }
        give_inbound_budget(held);

        // Decrement connection counter on exit
        let mut state = self.inner.write().await;
        if let Some(count) = state.active_connections_per_ip.get_mut(&ip) {
            if *count > 1 {
                *count -= 1;
            } else {
                state.active_connections_per_ip.remove(&ip);
            }
        }
    }

    async fn run_udp_beacon_receiver(&self) {
        let mut socket_opt: Option<UdpSocket> = None;
        if let Ok(sock) = UdpSocket::bind(format!("0.0.0.0:{}", DEFAULT_UDP_BEACON_PORT)).await {
            socket_opt = Some(sock);
        } else if let Ok(sock) = UdpSocket::bind("0.0.0.0:0").await {
            socket_opt = Some(sock);
        }

        let socket = match socket_opt {
            Some(s) => s,
            None => return,
        };

        let mut buf = [0u8; 4096];
        loop {
            match socket.recv_from(&mut buf).await {
                Ok((len, peer_addr)) => {
                    if let Ok(raw_str) = std::str::from_utf8(&buf[..len]) {
                        if let Ok(beacon) = serde_json::from_str::<BeaconMessage>(raw_str) {
                            if beacon.proto == BEACON_PROTO {
                                self.register_peer_from_beacon(beacon, peer_addr).await;
                            }
                        }
                    }
                }
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        }
    }

    async fn register_peer_from_beacon(&self, beacon: BeaconMessage, peer_addr: SocketAddr) {
        let now = current_timestamp_ms();
        if beacon.timestamp_ms > now + MAX_CLOCK_DRIFT_MS || now > beacon.timestamp_ms + MAX_CLOCK_DRIFT_MS {
            return;
        }

        // Every ID the beacon names must be signed by the key it comes from.
        let claims = std::iter::once((beacon.pubkey.as_str(), beacon.sig.as_str(), Some(beacon.node_id.as_str())))
            .chain(beacon.aliases.iter().take(4).map(|a| (a.pubkey.as_str(), a.sig.as_str(), None)));
        let mut ids = Vec::new();
        for (pub_hex, sig, claimed) in claims {
            let Some(id) = node_id_for_pub_hex(pub_hex) else { return };
            if claimed.is_some_and(|c| c != id) {
                return;
            }
            let signed = beacon_message(&id, &beacon.node_name, beacon.tcp_port, beacon.timestamp_ms);
            if !verify_hex_signature(pub_hex, &signed, sig) {
                return;
            }
            ids.push(id);
        }

        let name = clean_node_name(&beacon.node_name);
        let tcp_address = format!("{}:{}", peer_addr.ip(), beacon.tcp_port);
        let mut discovered = Vec::new();
        {
            let mut state = self.inner.write().await;
            if ids.iter().any(|id| state.keys.iter().any(|k| &k.node_id == id)) {
                return; // Our own beacon
            }
            for id in ids {
                // Only a newer beacon moves a peer: one captured and replayed from
                // another address carries the same timestamp, never a newer one.
                if beacon.timestamp_ms <= state.beacon_seen.get(&id).copied().unwrap_or(0) {
                    continue;
                }
                let lan_peers = state.peers.values().filter(|p| p.peer_type == "LAN").count();
                if !state.peers.contains_key(&id) && lan_peers >= MAX_LAN_PEERS {
                    continue;
                }
                state.beacon_seen.insert(id.clone(), beacon.timestamp_ms);
                let peer = MeshPeer {
                    id: id.clone(),
                    name: name.clone(),
                    address: tcp_address.clone(),
                    peer_type: "LAN".to_string(),
                    last_seen_ms: now,
                    is_connected: true,
                };
                if state.peers.insert(id, peer.clone()).is_none() {
                    discovered.push(peer);
                }
            }
        }

        for peer in discovered {
            log::info!("[SovereignMesh] Discovered physical LAN peer: {} ({}) at {}", peer.name, peer.id, peer.address);
            if let Some(ref handle) = self.app_handle {
                let _ = handle.emit("novaura://mesh-peer-discovered", &peer);
            }
        }
    }

    async fn run_udp_beacon_transmitter(&self, tcp_port: u16) {
        let socket = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => {
                let _ = s.set_broadcast(true);
                s
            }
            Err(_) => return,
        };

        let broadcast_target = format!("255.255.255.255:{}", DEFAULT_UDP_BEACON_PORT);

        loop {
            // Nothing is announced until the identity key arrives.
            let (keys, node_name) = {
                let state = self.inner.read().await;
                (state.keys.clone(), state.node_name.clone())
            };
            if let Some(primary) = keys.first() {
                let timestamp_ms = current_timestamp_ms();
                let sign = |k: &NodeKey| k.sign_hex(&beacon_message(&k.node_id, &node_name, tcp_port, timestamp_ms));
                let beacon = BeaconMessage {
                    proto: BEACON_PROTO.to_string(),
                    node_id: primary.node_id.clone(),
                    node_name: node_name.clone(),
                    tcp_port,
                    timestamp_ms,
                    pubkey: primary.pub_hex.clone(),
                    sig: sign(primary),
                    aliases: keys[1..].iter().map(|k| BeaconAlias { pubkey: k.pub_hex.clone(), sig: sign(k) }).collect(),
                };

                if let Ok(serialized) = serde_json::to_string(&beacon) {
                    let _ = socket.send_to(serialized.as_bytes(), &broadcast_target).await;
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }
    }

    /// Background WAN Relay Supervisor: maintains persistent outbound TCP tunnel for nodes behind strict symmetric NAT
    async fn run_relay_client_supervisor(&self) {
        loop {
            // Logging in needs the identity key, and waits out a refusal.
            let relay_opt = {
                let state = self.inner.read().await;
                let ready = !state.keys.is_empty() && current_timestamp_ms() >= state.relay_retry_at_ms;
                state.relay_address.clone().filter(|_| ready)
            };
            if let Some(relay_addr) = relay_opt {
                if !relay_addr.trim().is_empty() {
                    log::info!("[SovereignMesh] Initiating WAN relay tunnel to {}", relay_addr);
                    self.connect_and_serve_relay(&relay_addr).await;
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    }

    async fn connect_and_serve_relay(&self, relay_addr: &str) {
        let stream = match TcpStream::connect(relay_addr).await {
            Ok(s) => s,
            Err(e) => {
                log::debug!("[SovereignMesh] Relay connection to {} unavailable (will retry): {}", relay_addr, e);
                let mut state = self.inner.write().await;
                state.relay_connected = false;
                return;
            }
        };

        let (reader, mut writer) = stream.into_split();
        let mut buf_reader = BufReader::new(reader);
        let mut line: Vec<u8> = Vec::new();

        // 1. The relay opens with a one-time challenge. The login signs it with
        //    every key this node answers for, proving it owns their IDs.
        let challenge = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            read_bounded_line(&mut buf_reader, &mut line, 64 * 1024),
        )
        .await
        .ok()
        .and_then(|r| r.ok())
        .and_then(|_| serde_json::from_slice::<MeshPacket>(&line).ok())
        .filter(|p| p.packet_type == "MESH_CHALLENGE" && p.sender_id == "relay_supervisor");
        line.clear();
        let Some(challenge) = challenge else {
            log::warn!("[SovereignMesh] Relay {} sent no login challenge (an older relay?); will retry.", relay_addr);
            self.inner.write().await.relay_connected = false;
            return;
        };
        let nonce = challenge.payload.get("nonce").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if let Some(ip) = challenge.payload.get("observed_ip").and_then(|v| v.as_str()) {
            if ip.parse::<IpAddr>().is_ok() {
                self.inner.write().await.wan_ip = ip.to_string();
            }
        }

        let (keys, my_name, my_port, my_room) = {
            let state = self.inner.read().await;
            (state.keys.clone(), state.node_name.clone(), state.tcp_port, state.current_room.clone())
        };
        let Some(primary) = keys.first() else { return };
        let proofs: Vec<serde_json::Value> = keys
            .iter()
            .map(|k| serde_json::json!({ "pubkey": k.pub_hex, "sig": k.sign_hex(&relay_register_message(&nonce, &k.node_id)) }))
            .collect();

        let handshake = MeshPacket {
            id: format!("relay_reg_{}", current_timestamp_ms()),
            sender_id: primary.node_id.clone(),
            sender_name: my_name,
            sender_pubkey: Some(primary.pub_hex.clone()),
            recipient_id: None,
            packet_type: "MESH_REGISTER".to_string(),
            payload: serde_json::json!({
                "version": "2.0.0",
                "client": "novaura-desktop",
                "room": my_room,
                "tcp_port": my_port,
                "keys": proofs,
            }),
            signature: None,
            timestamp_ms: current_timestamp_ms(),
        };

        if let Ok(reg_json) = serde_json::to_string(&handshake) {
            if writer.write_all(format!("{}\n", reg_json).as_bytes()).await.is_err() {
                return;
            }
        }

        let (relay_tx, mut relay_rx) = mpsc::channel::<String>(RELAY_OUTBOUND_QUEUE);
        let relay_queued = Arc::new(AtomicUsize::new(0));
        // Heartbeats and TURN requests use a weak handle, so dropping the tunnel
        // in set_relay() still closes the queue and ends this connection.
        let control = relay_tx.downgrade();
        {
            let mut state = self.inner.write().await;
            state.relay_connected = true;
            state.relay_tx = Some(RelayTunnel { tx: relay_tx, queued: Arc::clone(&relay_queued) });
            log::info!("[SovereignMesh] Established active WAN relay tunnel to {}", relay_addr);
        }

        // Ask for TURN credentials now and again before they run out. Relays
        // without a TURN server ignore this; older relays drop it, because no
        // node can register as "relay_supervisor".
        let turn_request = serde_json::to_string(&MeshPacket {
            id: String::new(),
            sender_id: handshake.sender_id.clone(),
            sender_name: handshake.sender_name.clone(),
            sender_pubkey: None,
            recipient_id: Some("relay_supervisor".to_string()),
            packet_type: "MESH_TURN_REQUEST".to_string(),
            payload: serde_json::json!({}),
            signature: None,
            timestamp_ms: 0,
        })
        .map(|j| format!("{}\n", j))
        .unwrap_or_default();
        let mut turn_check = tokio::time::interval(tokio::time::Duration::from_secs(600));

        // The UI asks the relay for missed listings once it hears the tunnel is up.
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("novaura://mesh-relay-connected", relay_addr);
        }

        // 2. Writes run in their own task, so reading never stalls behind a large
        //    upload (the relay closes a socket that stops taking its packets).
        let writer_queued = Arc::clone(&relay_queued);
        let mut writer_task = tokio::spawn(async move {
            // Ends with None when set_relay() drops the tunnel handle: reconnect to the new address.
            while let Some(frame) = relay_rx.recv().await {
                let written = writer.write_all(frame.as_bytes()).await;
                writer_queued.fetch_sub(frame.len(), std::sync::atomic::Ordering::Relaxed);
                if written.is_err() {
                    log::warn!("[SovereignMesh] WAN relay tunnel write failed; reconnecting.");
                    break;
                }
            }
        });

        // 3. Read incoming packets routed from other WAN nodes with bounded buffer
        loop {
            tokio::select! {
                read_res = read_bounded_line(&mut buf_reader, &mut line, MAX_PACKET_BYTES) => {
                    match read_res {
                        Ok(0) | Err(_) => {
                            log::warn!("[SovereignMesh] WAN Relay tunnel disconnected or bounded frame exceeded.");
                            break;
                        }
                        Ok(_) => {
                            let mut refused = false;
                            if let Ok(packet) = serde_json::from_slice::<MeshPacket>(&line) {
                                match packet.packet_type.as_str() {
                                    // Relay-only packets. The relay never forwards client packets
                                    // claiming its reserved sender ID, so this check is sound here.
                                    "MESH_TURN_CREDENTIALS" | "MESH_ARCHIVE_ITEM" | "MESH_ARCHIVE_DONE" => {
                                        if packet.sender_id == "relay_supervisor" {
                                            self.handle_relay_packet(packet, relay_addr).await;
                                        }
                                    }
                                    "MESH_ERROR" if packet.sender_id == "relay_supervisor" => {
                                        refused = self.handle_relay_error(&packet.payload).await;
                                    }
                                    _ => self.process_incoming_packet(packet, true).await,
                                }
                            }
                            line.clear();
                            if refused {
                                break;
                            }
                        }
                    }
                }
                _ = &mut writer_task => break,
                _ = turn_check.tick() => {
                    // The first tick fires at once, which sends the initial request.
                    let wanted = {
                        let state = self.inner.read().await;
                        state.turn.as_ref().map_or(true, |t| t.needs_refresh())
                    };
                    if wanted && !turn_request.is_empty() && !queue_control(&control, &relay_queued, &turn_request) {
                        break;
                    }
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(25)) => {
                    // Periodic heartbeat ping to keep NAT port bindings open in home router
                    let hb = format!("{}\n", serde_json::json!({ "packet_type": "MESH_HEARTBEAT", "timestamp_ms": current_timestamp_ms() }));
                    if !queue_control(&control, &relay_queued, &hb) {
                        break;
                    }
                }
            }
        }
        writer_task.abort();

        let mut state = self.inner.write().await;
        state.relay_connected = false;
        state.relay_tx = None;
    }

    /// A refusal from the relay. Returns true when the tunnel should close: a
    /// failed login is retried later, and when another device took over this
    /// identity's ID, much later, so the two don't keep pushing each other off.
    async fn handle_relay_error(&self, payload: &serde_json::Value) -> bool {
        let code = payload.get("code").and_then(|c| c.as_str()).unwrap_or("");
        let reason = payload.get("reason").and_then(|r| r.as_str()).unwrap_or("");
        log::warn!("[SovereignMesh] Relay refused: {} {}", code, reason);
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("novaura://mesh-relay-error", payload);
        }
        let wait_ms = match code {
            "ID_TAKEN_OVER" => 5 * 60_000,
            "REGISTRATION_FAILED" => 30_000,
            _ => return false,
        };
        self.inner.write().await.relay_retry_at_ms = current_timestamp_ms() + wait_ms;
        true
    }

    async fn handle_relay_packet(&self, packet: MeshPacket, relay_addr: &str) {
        match packet.packet_type.as_str() {
            "MESH_TURN_CREDENTIALS" => {
                if let Some(grant) = TurnGrant::from_payload(&packet.payload) {
                    log::info!("[SovereignMesh] TURN credentials received from relay");
                    self.inner.write().await.turn = Some(grant);
                }
            }
            "MESH_ARCHIVE_ITEM" => {
                // A stored copy of someone else's packet: the relay vouches for nothing,
                // so the publisher's own signature must verify. The usual 5-minute
                // freshness window does not apply to an archive.
                let inner = packet
                    .payload
                    .get("packet")
                    .and_then(|p| serde_json::from_value::<MeshPacket>(p.clone()).ok());
                if let Some(inner) = inner {
                    if ARCHIVE_REPLAY_TYPES.contains(&inner.packet_type.as_str()) && verify_packet_signature(&inner) {
                        if let (Some(handle), Ok(mut value)) = (&self.app_handle, serde_json::to_value(&inner)) {
                            value["_archive_replay"] = serde_json::Value::Bool(true);
                            let _ = handle.emit("novaura://mesh-packet", &value);
                        }
                    }
                }
            }
            "MESH_ARCHIVE_DONE" => {
                if let Some(ref handle) = self.app_handle {
                    let mut done = packet.payload.clone();
                    if !done.is_object() {
                        done = serde_json::json!({});
                    }
                    done["relay"] = serde_json::Value::String(relay_addr.to_string());
                    let _ = handle.emit("novaura://mesh-archive-done", &done);
                }
            }
            _ => {}
        }
    }

    /// Queue a serialized frame into the live relay tunnel, waiting while the
    /// tunnel already holds RELAY_BACKLOG_BYTES unsent (a large upload paces
    /// itself to the link). Returns false when no tunnel is up or it stays
    /// blocked, so callers never report a false delivery.
    async fn send_via_relay(&self, line: &str) -> bool {
        use std::sync::atomic::Ordering::Relaxed;
        let Some(tunnel) = ({ self.inner.read().await.relay_tx.clone() }) else {
            return false;
        };
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(RELAY_SEND_WAIT_SECS);
        while tunnel.queued.load(Relaxed) > RELAY_BACKLOG_BYTES {
            if tunnel.tx.is_closed() || tokio::time::Instant::now() >= deadline {
                return false;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        tunnel.queued.fetch_add(line.len(), Relaxed);
        match tokio::time::timeout_at(deadline, tunnel.tx.send(line.to_string())).await {
            Ok(Ok(())) => true,
            _ => {
                tunnel.queued.fetch_sub(line.len(), Relaxed);
                false
            }
        }
    }

    async fn run_peer_pruner(&self) {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
            let now = current_timestamp_ms();
            let mut lost_peers = Vec::new();

            {
                let mut state = self.inner.write().await;
                state.peers.retain(|id, peer| {
                    if peer.peer_type == "LAN" && now.saturating_sub(peer.last_seen_ms) > 30_000 {
                        lost_peers.push(id.clone());
                        false
                    } else {
                        true
                    }
                });

                // A packet older than the drift window fails the timestamp check, so
                // its ID no longer needs remembering; nor does a beacon's.
                state.seen_packet_ids.retain(|_, ts| *ts + MAX_CLOCK_DRIFT_MS >= now);
                state.beacon_seen.retain(|_, ts| *ts + MAX_CLOCK_DRIFT_MS >= now);
            }

            if let Some(ref handle) = self.app_handle {
                for id in lost_peers {
                    let _ = handle.emit("novaura://mesh-peer-lost", id);
                }
            }
        }
    }

    /// `via_relay`: the packet came down the logged-in relay tunnel (not a LAN socket).
    pub async fn process_incoming_packet(&self, packet: MeshPacket, via_relay: bool) {
        // 1. Replay Protection: Timestamp Drift Check (5-minute maximum tolerance)
        let now = current_timestamp_ms();
        if packet.timestamp_ms > now + MAX_CLOCK_DRIFT_MS || now > packet.timestamp_ms + MAX_CLOCK_DRIFT_MS {
            log::warn!(
                "[SovereignMesh] Dropped packet {} from {}: timestamp drift violation (now: {}, packet: {})",
                packet.id, packet.sender_id, now, packet.timestamp_ms
            );
            return;
        }

        // 2. Cryptographic Authentication: Verify Ed25519 digital signature
        // Room membership comes unsigned from the relay itself, and only from its
        // tunnel: a LAN socket can't feed this node a roster. Everything else
        // must be signed.
        let is_relay_infra = matches!(
            packet.packet_type.as_str(),
            "MESH_ROOM_ROSTER" | "MESH_PEER_JOINED_ROOM" | "MESH_PEER_LEFT_ROOM"
        );
        if is_relay_infra {
            if !via_relay || packet.sender_id != "relay_supervisor" {
                return;
            }
        } else {
            if !verify_packet_signature(&packet) {
                log::warn!(
                    "[SovereignMesh] SECURITY ALERT: Dropped forged/unverified packet {} of type '{}' claiming sender '{}'",
                    packet.id, packet.packet_type, packet.sender_id
                );
                return;
            }
        }

        // Special Handlers for Room Roster and Swarm Auto-Discovery
        if packet.packet_type == "MESH_ROOM_ROSTER" {
            let mut new_peers = Vec::new();
            let room_name = packet.payload.get("room").and_then(|r| r.as_str()).unwrap_or("general").to_string();

            if let Some(peers_val) = packet.payload.get("peers").and_then(|p| p.as_array()) {
                let mut state = self.inner.write().await;
                for p_val in peers_val.iter().take(MAX_PEERS_PER_ROOM) {
                    if let (Some(id), Some(name), Some(addr)) = (
                        p_val.get("id").and_then(|i| i.as_str()),
                        p_val.get("name").and_then(|n| n.as_str()),
                        p_val.get("address").and_then(|a| a.as_str()),
                    ) {
                        // Anti-Poisoning Validation: reject loopback, internal IPs, link-local, multicast
                        if !is_safe_peer_address(addr) {
                            log::warn!("[SovereignMesh] Rejected unsafe/poisoned peer address in roster: {}", addr);
                            continue;
                        }

                        if !state.is_mine(id) && state.peers.len() < 1000 {
                            let peer = MeshPeer {
                                id: id.to_string(),
                                name: name.to_string(),
                                address: addr.to_string(),
                                peer_type: "ROOM_SWARM".to_string(),
                                last_seen_ms: current_timestamp_ms(),
                                is_connected: true,
                            };
                            state.peers.insert(id.to_string(), peer.clone());
                            new_peers.push(peer);
                        }
                    }
                }
            }

            log::info!("[SovereignMesh] Auto-peered with Swarm Roster: {} active nodes in Room #{}", new_peers.len(), room_name);
            if let Some(ref handle) = self.app_handle {
                for p in new_peers {
                    let _ = handle.emit("novaura://mesh-peer-discovered", &p);
                }
                let _ = handle.emit("novaura://mesh-packet", &packet);
            }
            return;
        }

        if packet.packet_type == "MESH_PEER_JOINED_ROOM" {
            let mut discovered_peer = None;
            if let Some(p_val) = packet.payload.get("peer") {
                if let (Some(id), Some(name), Some(addr)) = (
                    p_val.get("id").and_then(|i| i.as_str()),
                    p_val.get("name").and_then(|n| n.as_str()),
                    p_val.get("address").and_then(|a| a.as_str()),
                ) {
                    if !is_safe_peer_address(addr) {
                        log::warn!("[SovereignMesh] Rejected unsafe/poisoned peer address in peer join: {}", addr);
                        return;
                    }

                    let mut state = self.inner.write().await;
                    if !state.is_mine(id) && state.peers.len() < 1000 {
                        let peer = MeshPeer {
                            id: id.to_string(),
                            name: name.to_string(),
                            address: addr.to_string(),
                            peer_type: "ROOM_SWARM".to_string(),
                            last_seen_ms: current_timestamp_ms(),
                            is_connected: true,
                        };
                        state.peers.insert(id.to_string(), peer.clone());
                        discovered_peer = Some(peer);
                    }
                }
            }

            if let Some(ref handle) = self.app_handle {
                if let Some(ref p) = discovered_peer {
                    log::info!("[SovereignMesh] Swarm Member Joined: {} ({})", p.name, p.id);
                    let _ = handle.emit("novaura://mesh-peer-discovered", p);
                }
                let _ = handle.emit("novaura://mesh-packet", &packet);
            }
            return;
        }

        if packet.packet_type == "MESH_PEER_LEFT_ROOM" {
            let mut lost_id = None;
            if let Some(id) = packet.payload.get("node_id").and_then(|i| i.as_str()) {
                let mut state = self.inner.write().await;
                if state.peers.remove(id).is_some() {
                    lost_id = Some(id.to_string());
                }
            }

            if let Some(ref handle) = self.app_handle {
                if let Some(ref lid) = lost_id {
                    log::info!("[SovereignMesh] Swarm Member Departed: {}", lid);
                    let _ = handle.emit("novaura://mesh-peer-lost", lid);
                }
                let _ = handle.emit("novaura://mesh-packet", &packet);
            }
            return;
        }

        let (is_duplicate, for_me) = {
            let mut state = self.inner.write().await;
            // Keyed by sender too, so nobody can spend another sender's packet ID first.
            let seen_key = format!("{}|{}", packet.sender_id, packet.id);
            if state.seen_packet_ids.contains_key(&seen_key) {
                (true, false)
            } else {
                if state.seen_packet_ids.len() >= MAX_SEEN_PACKETS {
                    state.seen_packet_ids.retain(|_, ts| *ts + MAX_CLOCK_DRIFT_MS >= now);
                    if state.seen_packet_ids.len() >= MAX_SEEN_PACKETS {
                        log::warn!("[SovereignMesh] Dropped packet {}: too many packets in the last few minutes.", packet.id);
                        return;
                    }
                }
                state.seen_packet_ids.insert(seen_key, packet.timestamp_ms);
                let matches_recipient = match packet.recipient_id.as_deref() {
                    Some(rec) => rec == "*" || state.is_mine(rec),
                    None => true,
                };

                // Refresh the sender's node in the routing table
                if let Some(sender_node) = packet.sender_pubkey.as_deref().and_then(node_id_for_pub_hex) {
                    if let Some(p) = state.peers.get_mut(&sender_node) {
                        p.last_seen_ms = now;
                        p.is_connected = true;
                    }
                }

                (false, matches_recipient)
            }
        };

        if is_duplicate {
            return;
        }

        if for_me {
            log::info!("[SovereignMesh] Received packet {} of type '{}' from {}", packet.id, packet.packet_type, packet.sender_name);
            if let Some(ref handle) = self.app_handle {
                let _ = handle.emit("novaura://mesh-packet", &packet);
            }
        }
    }

    pub async fn broadcast_packet(
        &self,
        packet_type: String,
        payload: serde_json::Value,
        signature: Option<String>,
        sender_pubkey: Option<String>,
        sender_id: Option<String>,
        timestamp_ms: Option<u64>,
        packet_id: Option<String>,
    ) -> Result<bool, String> {
        let (default_node_id, node_name, mut addresses) = {
            let state = self.inner.read().await;
            let list: Vec<String> = state.peers.values().map(|p| p.address.clone()).collect();
            (state.node_id.clone(), state.node_name.clone(), list)
        };
        // A node listed under an alias too gets the packet once.
        addresses.sort();
        addresses.dedup();

        let final_sender_id = sender_id.unwrap_or(default_node_id);
        let final_timestamp = timestamp_ms.unwrap_or_else(current_timestamp_ms);

        let packet = MeshPacket {
            id: packet_id_or_new(packet_id, final_timestamp),
            sender_id: final_sender_id,
            sender_name: node_name,
            sender_pubkey,
            recipient_id: Some("*".to_string()),
            packet_type,
            payload,
            signature,
            timestamp_ms: final_timestamp,
        };

        let serialized = serde_json::to_string(&packet).map_err(|e| e.to_string())?;
        let line = format!("{}\n", serialized);

        {
            let mut state = self.inner.write().await;
            state.seen_packet_ids.insert(format!("{}|{}", packet.sender_id, packet.id), final_timestamp);
        }

        let mut sent_count = 0;
        for address in addresses {
            if write_direct(&address, &line).await {
                sent_count += 1;
            }
        }

        // Push through the registered WAN relay tunnel (room broadcast).
        let via_relay = self.send_via_relay(&line).await;

        log::info!(
            "[SovereignMesh] Broadcast forwarded to {} direct peers{}.",
            sent_count,
            if via_relay { " + WAN relay" } else { " (relay offline)" }
        );
        Ok(sent_count > 0 || via_relay)
    }

    pub async fn send_direct_packet(
        &self,
        recipient_id: String,
        packet_type: String,
        payload: serde_json::Value,
        signature: Option<String>,
        sender_pubkey: Option<String>,
        sender_id: Option<String>,
        timestamp_ms: Option<u64>,
        packet_id: Option<String>,
    ) -> Result<bool, String> {
        let (default_node_id, node_name, target_addr) = {
            let state = self.inner.read().await;
            let addr = state.peers.get(&recipient_id).map(|p| p.address.clone());
            (state.node_id.clone(), state.node_name.clone(), addr)
        };

        let final_sender_id = sender_id.unwrap_or(default_node_id);
        let final_timestamp = timestamp_ms.unwrap_or_else(current_timestamp_ms);

        let packet = MeshPacket {
            id: packet_id_or_new(packet_id, final_timestamp),
            sender_id: final_sender_id,
            sender_name: node_name,
            sender_pubkey,
            recipient_id: Some(recipient_id.clone()),
            packet_type,
            payload,
            signature,
            timestamp_ms: final_timestamp,
        };

        let serialized = serde_json::to_string(&packet).map_err(|e| e.to_string())?;
        let line = format!("{}\n", serialized);

        // 1. Try Direct TCP socket first (LAN or Direct WAN)
        if let Some(ref addr) = target_addr {
            if write_direct(addr, &line).await {
                return Ok(true);
            }
        }

        // 2. Fallback: route through the registered WAN relay tunnel
        if self.send_via_relay(&line).await {
            log::info!("[SovereignMesh] Packet to {} queued on the WAN relay tunnel.", recipient_id);
            return Ok(true);
        }

        Err(format!("Could not deliver to peer {} directly or through relay.", recipient_id))
    }

    /// Connect to a remote peer via invite code (e.g., nova://connect/did:nova:...@198.51.100.24:43889?name=Silas)
    /// or raw IP:port
    pub async fn connect_peer(&self, address_or_code: String) -> Result<MeshPeer, String> {
        let trimmed = address_or_code.trim();

        let (mut target_addr, peer_id, peer_name, peer_type) = if trimmed.starts_with("nova://connect/") {
            let stripped = &trimmed["nova://connect/".len()..];
            let (target_part, query_part) = match stripped.split_once('?') {
                Some((t, q)) => (t, q),
                None => (stripped, ""),
            };

            let (did, host_port) = match target_part.split_once('@') {
                Some((d, hp)) => (d.to_string(), hp.to_string()),
                None => ("peer_node".to_string(), target_part.to_string()),
            };

            let name = query_part.split('&')
                .find(|s| s.starts_with("name="))
                .and_then(|s| s.split_once('='))
                .map(|(_, val)| val.replace("%20", " "))
                .unwrap_or_else(|| format!("Peer ({})", &did[..8.min(did.len())]));

            (host_port, did, name, "DIRECT_WAN".to_string())
        } else if trimmed.starts_with("nova://relay/") {
            let stripped = &trimmed["nova://relay/".len()..];
            let (relay_host, query_part) = match stripped.split_once('?') {
                Some((r, q)) => (r, q),
                None => (stripped, ""),
            };

            let target_did = query_part.split('&')
                .find(|s| s.starts_with("target="))
                .and_then(|s| s.split_once('='))
                .map(|(_, val)| val.to_string())
                .unwrap_or_else(|| "relay_target".to_string());

            let name = query_part.split('&')
                .find(|s| s.starts_with("name="))
                .and_then(|s| s.split_once('='))
                .map(|(_, val)| val.replace("%20", " "))
                .unwrap_or_else(|| "Relay Peer".to_string());

            (relay_host.to_string(), target_did, name, "WAN_RELAY".to_string())
        } else {
            // Raw address (e.g. 198.51.100.24:43889)
            let addr = trimmed.to_string();
            let id = format!("did:nova:peer_{}", addr.replace([':', '.'], "_"));
            let name = format!("Remote Peer ({})", addr);
            (addr, id, name, "DIRECT_WAN".to_string())
        };

        if !target_addr.contains(':') {
            target_addr = format!("{}:{}", target_addr, DEFAULT_TCP_LISTEN_PORT);
        }

        // Anti-poisoning address validation
        if !is_safe_peer_address(&target_addr) {
            return Err(format!("PROHIBITED_PEER_ADDRESS: Address '{}' is rejected (loopback, internal, or invalid).", target_addr));
        }

        let mut stream = TcpStream::connect(&target_addr).await.map_err(|e| {
            format!("Direct connection to {} failed: {}. (If firewalled, consider routing through WAN Relay)", target_addr, e)
        })?;

        let (node_id, node_name) = {
            let state = self.inner.read().await;
            (state.node_id.clone(), state.node_name.clone())
        };

        // Handshake packet
        let ping = MeshPacket {
            id: format!("handshake_{}", current_timestamp_ms()),
            sender_id: node_id,
            sender_name: node_name,
            sender_pubkey: None,
            recipient_id: Some(peer_id.clone()),
            packet_type: "MESH_HANDSHAKE".to_string(),
            payload: serde_json::json!({ "version": "1.0.0", "client": "novaura-desktop" }),
            signature: None,
            timestamp_ms: current_timestamp_ms(),
        };

        let line = format!("{}\n", serde_json::to_string(&ping).unwrap());
        stream.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;

        let peer = MeshPeer {
            id: peer_id.clone(),
            name: peer_name,
            address: target_addr,
            peer_type,
            last_seen_ms: current_timestamp_ms(),
            is_connected: true,
        };

        {
            let mut state = self.inner.write().await;
            state.peers.insert(peer.id.clone(), peer.clone());
        }

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("novaura://mesh-peer-discovered", &peer);
        }

        Ok(peer)
    }

    pub async fn set_relay(&self, relay_address: Option<String>) -> Result<bool, String> {
        let relay_address = relay_address.map(|a| a.trim().to_string()).filter(|a| !a.is_empty());
        save_relay_setting(&relay_address);
        let mut state = self.inner.write().await;
        state.relay_address = relay_address;
        state.relay_connected = false;
        // TURN credentials belong to the old relay's TURN server.
        state.turn = None;
        // Dropping the tunnel handle closes the current tunnel so the supervisor
        // reconnects to the new address.
        state.relay_tx = None;
        Ok(true)
    }

    pub async fn get_status(&self) -> MeshStatus {
        let state = self.inner.read().await;
        let public_host = if state.wan_ip != "0.0.0.0" && !state.wan_ip.is_empty() {
            state.wan_ip.clone()
        } else {
            state.lan_ip.clone()
        };

        let invite_code = format!(
            "nova://connect/{}@{}:{}?name={}",
            state.node_id,
            public_host,
            state.tcp_port,
            state.node_name.replace(' ', "%20")
        );

        MeshStatus {
            node_id: state.node_id.clone(),
            node_name: state.node_name.clone(),
            lan_ip: state.lan_ip.clone(),
            wan_ip: state.wan_ip.clone(),
            current_room: state.current_room.clone(),
            udp_beacon_port: state.udp_port,
            tcp_listen_port: state.tcp_port,
            peer_count: state.peers.len(),
            peers: state.peers.values().cloned().collect(),
            relay_address: state.relay_address.clone(),
            relay_connected: state.relay_connected,
            invite_code,
            turn: state
                .turn
                .as_ref()
                .filter(|t| t.expires_ms > current_timestamp_ms() + 60_000)
                .map(|t| t.payload.clone()),
        }
    }

    /// Switch active decentralized swarm room (e.g. "general", "crypto", "writers")
    pub async fn switch_room(&self, room: String) -> Result<bool, String> {
        let clean_room = room.trim().trim_start_matches('#').to_string();
        let target_room = if clean_room.is_empty() { "general".to_string() } else { clean_room };

        let (node_id, node_name, tcp_port, relay_addr) = {
            let mut state = self.inner.write().await;
            state.current_room = target_room.clone();
            // Clear prior room swarm peers
            state.peers.retain(|_, p| p.peer_type != "ROOM_SWARM");
            (state.node_id.clone(), state.node_name.clone(), state.tcp_port, state.relay_address.clone())
        };

        // Tell the relay through the logged-in tunnel (a fresh connection would be a stranger to it).
        if relay_addr.is_some() && !node_id.is_empty() {
            let join_pkt = MeshPacket {
                id: format!("room_switch_{}", current_timestamp_ms()),
                sender_id: node_id,
                sender_name: node_name,
                sender_pubkey: None,
                recipient_id: None,
                packet_type: "MESH_JOIN_ROOM".to_string(),
                payload: serde_json::json!({
                    "room": target_room,
                    "tcp_port": tcp_port,
                }),
                signature: None,
                timestamp_ms: current_timestamp_ms(),
            };
            if let Ok(line) = serde_json::to_string(&join_pkt) {
                self.send_via_relay(&format!("{}\n", line)).await;
            }
        }

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("novaura://mesh-room-switched", &target_room);
        }

        log::info!("[SovereignMesh] Switched active decentralized swarm room to #{}", target_room);
        Ok(true)
    }
}
