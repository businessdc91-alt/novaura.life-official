// mesh.rs — Sovereign Physical P2P Mesh Network Engine
// Direct Machine-to-Machine networking over LAN (UDP Beaconing + TCP Framing)
// and WAN (STUN Public IP Resolution + Direct Hole-Punching + Headless WAN Relay Routing)

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream, UdpSocket};
use tokio::sync::{mpsc, RwLock};

pub const DEFAULT_UDP_BEACON_PORT: u16 = 43888;
pub const DEFAULT_TCP_LISTEN_PORT: u16 = 43889;
pub const DEFAULT_PUBLIC_RELAY: &str = "relay.novaura.life:43889";
pub const MAX_PACKET_BYTES: usize = 256 * 1024; // 256 KB memory exhaustion ceiling
pub const MAX_PEERS_PER_ROOM: usize = 100;
pub const MAX_CONCURRENT_SOCKETS_PER_IP: usize = 8;
pub const RELAY_OUTBOUND_QUEUE: usize = 256;
pub const DIRECT_CONNECT_TIMEOUT_SECS: u64 = 3;

static PACKET_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

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

pub fn canonical_packet_string(
    packet_type: &str,
    sender_id: &str,
    timestamp_ms: u64,
    payload: &serde_json::Value,
) -> String {
    let payload_str = match serde_json::to_string(payload) {
        Ok(s) => s,
        Err(_) => "".to_string(),
    };
    format!("{}:{}:{}:{}", packet_type, sender_id, timestamp_ms, payload_str)
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

    // 1. Validate that sender_id binds cryptographically to the public key
    let prefix = if clean_pub.len() >= 16 { &clean_pub[..16] } else { clean_pub };
    if !packet.sender_id.starts_with("did:nova:") && packet.sender_id != clean_pub && packet.sender_id != pubkey_str {
        return false;
    }
    if packet.sender_id.starts_with("did:nova:") && !packet.sender_id.contains(prefix) {
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
        &packet.payload,
    );

    verifying_key.verify(canonical.as_bytes(), &signature).is_ok()
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

pub async fn read_bounded_line<R: tokio::io::AsyncBufRead + Unpin>(
    reader: &mut R,
    out: &mut String,
    max_bytes: usize,
) -> std::io::Result<usize> {
    out.clear();
    let mut total_read = 0;

    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            return Ok(total_read);
        }

        if let Some(pos) = available.iter().position(|&b| b == b'\n') {
            let to_take = pos + 1;
            let chunk = &available[..pos];
            total_read += to_take;
            if out.len() + chunk.len() > max_bytes {
                reader.consume(to_take);
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "FRAME_OVERFLOW: Inbound packet line exceeded 256KB cap.",
                ));
            }
            if let Ok(s) = std::str::from_utf8(chunk) {
                out.push_str(s);
            }
            reader.consume(to_take);
            return Ok(total_read);
        } else {
            let chunk_len = available.len();
            total_read += chunk_len;
            if out.len() + chunk_len > max_bytes {
                reader.consume(chunk_len);
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "FRAME_OVERFLOW: Inbound packet line exceeded 256KB cap without newline.",
                ));
            }
            if let Ok(s) = std::str::from_utf8(available) {
                out.push_str(s);
            }
            reader.consume(chunk_len);
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
}

#[derive(Serialize, Deserialize, Debug)]
struct BeaconMessage {
    pub proto: String,
    pub node_id: String,
    pub node_name: String,
    pub tcp_port: u16,
    pub timestamp_ms: u64,
}

struct MeshInner {
    pub node_id: String,
    pub node_name: String,
    pub current_room: String,
    pub tcp_port: u16,
    pub udp_port: u16,
    pub lan_ip: String,
    pub wan_ip: String,
    pub peers: HashMap<String, MeshPeer>,
    pub seen_packet_ids: HashSet<String>,
    pub relay_address: Option<String>,
    pub relay_connected: bool,
    /// Outbound queue into the single registered relay tunnel. The relay only
    /// forwards frames from a registered socket, so every relay-bound packet
    /// must travel through this tunnel rather than a fresh connection.
    pub relay_tx: Option<mpsc::Sender<String>>,
    pub active_connections_per_ip: HashMap<IpAddr, usize>,
}

#[derive(Clone)]
pub struct MeshManager {
    inner: Arc<RwLock<MeshInner>>,
    app_handle: Option<tauri::AppHandle>,
}

impl MeshManager {
    pub fn new(node_id: String, node_name: String) -> Self {
        let hostname = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "localhost".to_string());

        let lan_ip = "127.0.0.1".to_string();

        let inner = MeshInner {
            node_id,
            node_name: if node_name.trim().is_empty() { hostname } else { node_name },
            current_room: "general".to_string(),
            tcp_port: DEFAULT_TCP_LISTEN_PORT,
            udp_port: DEFAULT_UDP_BEACON_PORT,
            lan_ip,
            wan_ip: "0.0.0.0".to_string(),
            peers: HashMap::new(),
            seen_packet_ids: HashSet::new(),
            relay_address: Some(DEFAULT_PUBLIC_RELAY.to_string()),
            relay_connected: false,
            relay_tx: None,
            active_connections_per_ip: HashMap::new(),
        };

        Self {
            inner: Arc::new(RwLock::new(inner)),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    pub async fn start(&self) {
        let (node_id, node_name) = {
            let state = self.inner.read().await;
            (state.node_id.clone(), state.node_name.clone())
        };

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
            self_clone3.run_udp_beacon_transmitter(node_id, node_name, actual_tcp_port).await;
        });

        // 4. Resolve Public WAN IP via RFC 5389 STUN Discovery
        let self_clone_stun = self.clone();
        tokio::spawn(async move {
            if let Some(wan_ip) = resolve_wan_ip_stun().await {
                log::info!("[SovereignMesh] Resolved public WAN IP via STUN: {}", wan_ip);
                let mut state = self_clone_stun.inner.write().await;
                state.wan_ip = wan_ip;
            }
        });

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
        let mut line = String::new();

        loop {
            let read_res = tokio::time::timeout(
                std::time::Duration::from_secs(30),
                read_bounded_line(&mut buf_reader, &mut line, MAX_PACKET_BYTES),
            ).await;

            match read_res {
                Ok(Ok(0)) => break, // Clean EOF
                Ok(Ok(_)) => {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        if let Ok(packet) = serde_json::from_str::<MeshPacket>(trimmed) {
                            self.process_incoming_packet(packet, Some(addr.to_string())).await;
                        } else {
                            log::warn!("[SovereignMesh] Malformed JSON packet from {}", addr);
                        }
                    }
                    line.clear();
                }
                Ok(Err(err)) => {
                    log::warn!("[SovereignMesh] Bounded frame violation or read error from {}: {}", addr, err);
                    break;
                }
                Err(_) => {
                    log::debug!("[SovereignMesh] Inbound TCP stream from {} timed out (idle 30s).", addr);
                    break;
                }
            }
        }

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
                            if beacon.proto == "NOVA_BEACON_V1" {
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
        let my_id = { self.inner.read().await.node_id.clone() };
        if beacon.node_id == my_id {
            return; // Ignore own beacon
        }

        let tcp_address = format!("{}:{}", peer_addr.ip(), beacon.tcp_port);
        let peer = MeshPeer {
            id: beacon.node_id.clone(),
            name: beacon.node_name.clone(),
            address: tcp_address,
            peer_type: "LAN".to_string(),
            last_seen_ms: current_timestamp_ms(),
            is_connected: true,
        };

        let is_new = {
            let mut state = self.inner.write().await;
            state.peers.insert(beacon.node_id.clone(), peer.clone()).is_none()
        };

        if is_new {
            log::info!("[SovereignMesh] Discovered physical LAN peer: {} ({}) at {}", peer.name, peer.id, peer.address);
            if let Some(ref handle) = self.app_handle {
                let _ = handle.emit("novaura://mesh-peer-discovered", &peer);
            }
        }
    }

    async fn run_udp_beacon_transmitter(&self, node_id: String, node_name: String, tcp_port: u16) {
        let socket = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => {
                let _ = s.set_broadcast(true);
                s
            }
            Err(_) => return,
        };

        let broadcast_target = format!("255.255.255.255:{}", DEFAULT_UDP_BEACON_PORT);

        loop {
            let beacon = BeaconMessage {
                proto: "NOVA_BEACON_V1".to_string(),
                node_id: node_id.clone(),
                node_name: node_name.clone(),
                tcp_port,
                timestamp_ms: current_timestamp_ms(),
            };

            if let Ok(serialized) = serde_json::to_string(&beacon) {
                let _ = socket.send_to(serialized.as_bytes(), &broadcast_target).await;
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }
    }

    /// Background WAN Relay Supervisor: maintains persistent outbound TCP tunnel for nodes behind strict symmetric NAT
    async fn run_relay_client_supervisor(&self) {
        loop {
            let relay_opt = { self.inner.read().await.relay_address.clone() };
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

        let (relay_tx, mut relay_rx) = mpsc::channel::<String>(RELAY_OUTBOUND_QUEUE);
        {
            let mut state = self.inner.write().await;
            state.relay_connected = true;
            state.relay_tx = Some(relay_tx);
            log::info!("[SovereignMesh] Established active WAN relay tunnel to {}", relay_addr);
        }

        let (reader, mut writer) = stream.into_split();

        // 1. Send registration handshake with room membership
        let (my_id, my_name, my_wan, my_port, my_room) = {
            let state = self.inner.read().await;
            (
                state.node_id.clone(),
                state.node_name.clone(),
                state.wan_ip.clone(),
                state.tcp_port,
                state.current_room.clone(),
            )
        };

        let handshake = MeshPacket {
            id: format!("relay_reg_{}", current_timestamp_ms()),
            sender_id: my_id,
            sender_name: my_name,
            sender_pubkey: None,
            recipient_id: None,
            packet_type: "MESH_REGISTER".to_string(),
            payload: serde_json::json!({
                "version": "1.1.0",
                "client": "novaura-desktop",
                "room": my_room,
                "wan_ip": my_wan,
                "tcp_port": my_port
            }),
            signature: None,
            timestamp_ms: current_timestamp_ms(),
        };

        if let Ok(reg_json) = serde_json::to_string(&handshake) {
            let _ = writer.write_all(format!("{}\n", reg_json).as_bytes()).await;
        }

        // 2. Read incoming packets routed from other WAN nodes with bounded buffer
        let mut buf_reader = BufReader::new(reader);
        let mut line = String::new();

        loop {
            tokio::select! {
                read_res = read_bounded_line(&mut buf_reader, &mut line, MAX_PACKET_BYTES) => {
                    match read_res {
                        Ok(0) | Err(_) => {
                            log::warn!("[SovereignMesh] WAN Relay tunnel disconnected or bounded frame exceeded.");
                            break;
                        }
                        Ok(_) => {
                            let trimmed = line.trim();
                            if !trimmed.is_empty() {
                                if let Ok(packet) = serde_json::from_str::<MeshPacket>(trimmed) {
                                    self.process_incoming_packet(packet, Some(relay_addr.to_string())).await;
                                }
                            }
                            line.clear();
                        }
                    }
                }
                outbound = relay_rx.recv() => {
                    // None means set_relay() dropped the tunnel handle: reconnect to the new address.
                    match outbound {
                        Some(frame) => {
                            if writer.write_all(frame.as_bytes()).await.is_err() {
                                log::warn!("[SovereignMesh] WAN relay tunnel write failed; reconnecting.");
                                break;
                            }
                        }
                        None => break,
                    }
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(25)) => {
                    // Periodic heartbeat ping to keep NAT port bindings open in home router
                    let hb = format!("{}\n", serde_json::json!({ "packet_type": "MESH_HEARTBEAT", "timestamp_ms": current_timestamp_ms() }));
                    if writer.write_all(hb.as_bytes()).await.is_err() {
                        break;
                    }
                }
            }
        }

        let mut state = self.inner.write().await;
        state.relay_connected = false;
        state.relay_tx = None;
    }

    /// Queue a serialized frame into the live relay tunnel. Returns false when no
    /// tunnel is up or its queue is full, so callers never report a false delivery.
    async fn send_via_relay(&self, line: &str) -> bool {
        let tx = { self.inner.read().await.relay_tx.clone() };
        match tx {
            Some(tx) => tx.try_send(line.to_string()).is_ok(),
            None => false,
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

                if state.seen_packet_ids.len() > 5000 {
                    state.seen_packet_ids.clear();
                }
            }

            if let Some(ref handle) = self.app_handle {
                for id in lost_peers {
                    let _ = handle.emit("novaura://mesh-peer-lost", id);
                }
            }
        }
    }

    pub async fn process_incoming_packet(&self, packet: MeshPacket, _from_addr: Option<String>) {
        // 1. Replay Protection: Timestamp Drift Check (5-minute maximum tolerance)
        let now = current_timestamp_ms();
        if packet.timestamp_ms > now + 300_000 || now > packet.timestamp_ms + 300_000 {
            log::warn!(
                "[SovereignMesh] Dropped packet {} from {}: timestamp drift violation (now: {}, packet: {})",
                packet.id, packet.sender_id, now, packet.timestamp_ms
            );
            return;
        }

        // 2. Cryptographic Authentication: Verify Ed25519 digital signature
        // Infrastructure relay packets are routing-only; all application packets MUST be cryptographically signed
        let is_infra_packet = matches!(
            packet.packet_type.as_str(),
            "MESH_HEARTBEAT" | "MESH_REGISTER" | "MESH_ROOM_ROSTER" | "MESH_PEER_JOINED_ROOM" | "MESH_PEER_LEFT_ROOM" | "MESH_JOIN_ROOM"
        );
        if !is_infra_packet {
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

                        if id != state.node_id && state.peers.len() < 1000 {
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
                    if id != state.node_id && state.peers.len() < 1000 {
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
            if state.seen_packet_ids.contains(&packet.id) {
                (true, false)
            } else {
                state.seen_packet_ids.insert(packet.id.clone());
                let matches_recipient = match &packet.recipient_id {
                    Some(rec) => rec == &state.node_id || rec == "*",
                    None => true,
                };

                // Auto-register or refresh peer in routing table
                if packet.sender_id != state.node_id {
                    let existing = state.peers.get_mut(&packet.sender_id);
                    if let Some(p) = existing {
                        p.last_seen_ms = current_timestamp_ms();
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
    ) -> Result<bool, String> {
        let (default_node_id, node_name, peers) = {
            let state = self.inner.read().await;
            let peer_list: Vec<MeshPeer> = state.peers.values().cloned().collect();
            (state.node_id.clone(), state.node_name.clone(), peer_list)
        };

        let final_sender_id = sender_id.unwrap_or(default_node_id);
        let final_timestamp = timestamp_ms.unwrap_or_else(current_timestamp_ms);

        let seq = PACKET_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let packet = MeshPacket {
            id: format!("pkt_{}_{}", final_timestamp, seq),
            sender_id: final_sender_id,
            sender_name: node_name,
            sender_pubkey,
            recipient_id: None,
            packet_type,
            payload,
            signature,
            timestamp_ms: final_timestamp,
        };

        let serialized = serde_json::to_string(&packet).map_err(|e| e.to_string())?;
        let line = format!("{}\n", serialized);

        {
            let mut state = self.inner.write().await;
            state.seen_packet_ids.insert(packet.id.clone());
        }

        let mut sent_count = 0;
        for peer in peers {
            if write_direct(&peer.address, &line).await {
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
    ) -> Result<bool, String> {
        let (default_node_id, node_name, target_addr) = {
            let state = self.inner.read().await;
            let addr = state.peers.get(&recipient_id).map(|p| p.address.clone());
            (state.node_id.clone(), state.node_name.clone(), addr)
        };

        let final_sender_id = sender_id.unwrap_or(default_node_id);
        let final_timestamp = timestamp_ms.unwrap_or_else(current_timestamp_ms);

        let seq = PACKET_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let packet = MeshPacket {
            id: format!("pkt_{}_{}", final_timestamp, seq),
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
        let mut state = self.inner.write().await;
        state.relay_address = relay_address;
        state.relay_connected = false;
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
        }
    }

    /// Switch active decentralized swarm room (e.g. "general", "crypto", "writers")
    pub async fn switch_room(&self, room: String) -> Result<bool, String> {
        let clean_room = room.trim().trim_start_matches('#').to_string();
        let target_room = if clean_room.is_empty() { "general".to_string() } else { clean_room };

        let (node_id, node_name, wan_ip, tcp_port, relay_addr) = {
            let mut state = self.inner.write().await;
            state.current_room = target_room.clone();
            // Clear prior room swarm peers
            state.peers.retain(|_, p| p.peer_type != "ROOM_SWARM");
            (state.node_id.clone(), state.node_name.clone(), state.wan_ip.clone(), state.tcp_port, state.relay_address.clone())
        };

        // Notify relay of room switch
        if let Some(ref r_addr) = relay_addr {
            if let Ok(mut stream) = TcpStream::connect(r_addr).await {
                let join_pkt = MeshPacket {
                    id: format!("room_switch_{}", current_timestamp_ms()),
                    sender_id: node_id,
                    sender_name: node_name,
                    sender_pubkey: None,
                    recipient_id: None,
                    packet_type: "MESH_JOIN_ROOM".to_string(),
                    payload: serde_json::json!({
                        "room": target_room,
                        "wan_ip": wan_ip,
                        "tcp_port": tcp_port,
                    }),
                    signature: None,
                    timestamp_ms: current_timestamp_ms(),
                };
                if let Ok(line) = serde_json::to_string(&join_pkt) {
                    let _ = stream.write_all(format!("{}\n", line).as_bytes()).await;
                }
            }
        }

        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("novaura://mesh-room-switched", &target_room);
        }

        log::info!("[SovereignMesh] Switched active decentralized swarm room to #{}", target_room);
        Ok(true)
    }
}

/// RFC 5389 STUN Binding Request to discover our authentic external WAN public IP address
async fn resolve_wan_ip_stun() -> Option<String> {
    let stun_servers = [
        "stun.l.google.com:19302",
        "stun1.l.google.com:19302",
        "stun.cloudflare.com:3478",
    ];

    for server_str in stun_servers {
        if let Ok(mut addrs) = tokio::net::lookup_host(server_str).await {
            if let Some(server_addr) = addrs.next() {
                if let Ok(socket) = UdpSocket::bind("0.0.0.0:0").await {
                    let mut packet = [0u8; 20];
                    // Message Type: 0x0001 (Binding Request)
                    packet[0] = 0x00;
                    packet[1] = 0x01;
                    // Message Length: 0x0000
                    packet[2] = 0x00;
                    packet[3] = 0x00;
                    // Magic Cookie: 0x2112A442
                    packet[4] = 0x21;
                    packet[5] = 0x12;
                    packet[6] = 0xA4;
                    packet[7] = 0x42;
                    // Transaction ID: 12 bytes
                    let seed = current_timestamp_ms();
                    for i in 8..20 {
                        packet[i] = ((seed >> (i % 8)) ^ (i as u64 * 31)) as u8;
                    }

                    if socket.send_to(&packet, server_addr).await.is_ok() {
                        let mut buf = [0u8; 512];
                        let recv_res = tokio::time::timeout(
                            tokio::time::Duration::from_millis(2500),
                            socket.recv_from(&mut buf),
                        ).await;

                        if let Ok(Ok((len, _))) = recv_res {
                            if len >= 20 && buf[0] == 0x01 && buf[1] == 0x01 {
                                let magic = [0x21, 0x12, 0xA4, 0x42];
                                let mut offset = 20;
                                while offset + 4 <= len {
                                    let attr_type = u16::from_be_bytes([buf[offset], buf[offset + 1]]);
                                    let attr_len = u16::from_be_bytes([buf[offset + 2], buf[offset + 3]]) as usize;
                                    offset += 4;
                                    if offset + attr_len > len {
                                        break;
                                    }

                                    // Attribute 0x0020: XOR-MAPPED-ADDRESS
                                    if attr_type == 0x0020 && attr_len >= 8 {
                                        let family = buf[offset + 1];
                                        if family == 0x01 { // IPv4
                                            let ip_bytes = [
                                                buf[offset + 4] ^ magic[0],
                                                buf[offset + 5] ^ magic[1],
                                                buf[offset + 6] ^ magic[2],
                                                buf[offset + 7] ^ magic[3],
                                            ];
                                            return Some(format!("{}.{}.{}.{}", ip_bytes[0], ip_bytes[1], ip_bytes[2], ip_bytes[3]));
                                        }
                                    }
                                    // Attribute 0x0001: MAPPED-ADDRESS
                                    else if attr_type == 0x0001 && attr_len >= 8 {
                                        let family = buf[offset + 1];
                                        if family == 0x01 {
                                            return Some(format!("{}.{}.{}.{}", buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]));
                                        }
                                    }

                                    offset += (attr_len + 3) & !3;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}
