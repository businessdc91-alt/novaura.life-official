import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Radio, Shield, Copy, Check, Plus, RefreshCw, Send,
  Wifi, Server, ArrowUpRight, CheckCircle2, AlertCircle, Clock,
  ExternalLink, Zap, Terminal, Activity, Unplug, BookOpen, Mail,
  Share2, ChevronRight, Laptop, HelpCircle, Users, MessageSquare, Hash,
  Cpu, Paperclip, Upload, Trash2, ShieldCheck, ShieldAlert
} from 'lucide-react';
import {
  getPhysicalMeshStatus,
  connectManualPeer,
  configureMeshRelay,
  sendDirectMeshPacket,
  switchSwarmRoom,
  broadcastMeshPacket,
  getLocalIdentity,
  saveContact,
  getContacts,
  updateContactTrust,
  deleteContact,
  isSharingInference,
  setInferenceSharing,
  requestPeerInference,
  getOutbox,
} from '../../services/sovereignMesh.js';
import { sendFileToPeer, listTransfers } from '../../services/meshTransfers.js';
import { formatBytes } from '../../config/meshLimits.js';
import TransfersPanel from './peering/TransfersPanel.jsx';
import { useKernel } from '../../kernel/useKernel.js';

export default function SovereignPeeringWindow({ initialTab } = {}) {
  const { kernel } = useKernel();
  const [meshStatus, setMeshStatus] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'lobby'); // 'lobby' | 'trust' | 'compute' | 'transfers' | 'connect' | 'peers' | 'relay' | 'diagnostics'
  const [remoteAddressInput, setRemoteAddressInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [customRelayInput, setCustomRelayInput] = useState('relay.novaura.life:43889');
  const [isUpdatingRelay, setIsUpdatingRelay] = useState(false);
  const [packetLogs, setPacketLogs] = useState([]);
  const [pingMap, setPingMap] = useState({});
  const [inviteMode, setInviteMode] = useState('wan'); // 'wan' | 'relay'
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [isSwitchingRoom, setIsSwitchingRoom] = useState(false);
  const [shoutMessage, setShoutMessage] = useState('');
  const [isSendingShout, setIsSendingShout] = useState(false);

  // Swarm Ecosystem State (Web of Trust, Compute, Transfers)
  const [contactsList, setContactsList] = useState([]);
  const [outboxList, setOutboxList] = useState([]);
  const [transfersList, setTransfersList] = useState([]);
  const [sharingInferenceState, setSharingInferenceState] = useState(isSharingInference());
  const [swarmPrompt, setSwarmPrompt] = useState('');
  const [swarmRole, setSwarmRole] = useState('aura');
  const [isTestingSwarmInference, setIsTestingSwarmInference] = useState(false);
  const [swarmInferenceResult, setSwarmInferenceResult] = useState(null);
  const [selectedPeerForInference, setSelectedPeerForInference] = useState(null);
  const [targetPeerForFile, setTargetPeerForFile] = useState(null);
  const [newContactHandle, setNewContactHandle] = useState('');
  const [newContactNodeId, setNewContactNodeId] = useState('');
  const [newContactTier, setNewContactTier] = useState('verified');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const fileInputRef = useRef(null);
  const logContainerRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const status = await getPhysicalMeshStatus();
      setMeshStatus(status);
      if (status?.relay_address) {
        setCustomRelayInput(status.relay_address);
      }
    } catch (err) {
      console.warn('[PeeringWindow] Status error:', err);
    }
  };

  const fetchContactsData = async () => {
    try {
      const c = await getContacts();
      setContactsList(c || []);
    } catch (e) {
      console.warn('Error fetching contacts:', e);
    }
  };

  const fetchOutboxData = async () => {
    try {
      const o = await getOutbox();
      setOutboxList(o || []);
    } catch (e) {
      console.warn('Error fetching outbox:', e);
    }
  };

  const fetchTransfersData = async () => {
    try {
      const t = await listTransfers();
      setTransfersList(t || []);
    } catch (e) {
      console.warn('Error fetching transfers:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchContactsData();
    fetchOutboxData();
    fetchTransfersData();

    const interval = setInterval(() => {
      fetchStatus();
      fetchOutboxData();
    }, 3500);

    const handleMeshUpdated = () => fetchStatus();
    const handlePeerDiscovered = (e) => {
      fetchStatus();
      fetchOutboxData();
      addLog(`[SWARM_ROSTER] Node joined room: ${e.detail?.name || 'Remote Peer'} (${e.detail?.id?.substring(0, 10)}...)`);
    };
    const handlePeerLost = (e) => {
      fetchStatus();
      addLog(`[SWARM_ROSTER] Node departed room: ${e.detail}`);
    };
    const handleMeshPacket = (e) => {
      const pkt = e.detail;
      if (pkt) {
        addLog(`[PACKET_${pkt.packet_type || pkt.type || 'P2P'}] from ${pkt.sender_name || 'peer'} (${pkt.sender_id ? pkt.sender_id.substring(0, 8) : 'anon'})`);
      }
    };
    const handleRoomSwitched = (e) => {
      fetchStatus();
      addLog(`[ROOM_SWITCH] Successfully switched active room to #${e.detail}`);
    };
    const handleContactEvent = () => fetchContactsData();
    const handleOutboxEvent = () => fetchOutboxData();
    const handleTransferEvent = () => fetchTransfersData();

    window.addEventListener('novaura:mesh_updated', handleMeshUpdated);
    window.addEventListener('novaura:peer_discovered', handlePeerDiscovered);
    window.addEventListener('novaura:peer_lost', handlePeerLost);
    window.addEventListener('novaura:mesh_packet_received', handleMeshPacket);
    window.addEventListener('novaura:mesh_room_switched', handleRoomSwitched);
    window.addEventListener('novaura:contact_saved', handleContactEvent);
    window.addEventListener('novaura:contact_deleted', handleContactEvent);
    window.addEventListener('novaura:outbox_queued', handleOutboxEvent);
    window.addEventListener('novaura:outbox_delivered', handleOutboxEvent);
    window.addEventListener('novaura:file_received', handleTransferEvent);
    window.addEventListener('novaura:transfer_updated', handleTransferEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('novaura:mesh_updated', handleMeshUpdated);
      window.removeEventListener('novaura:peer_discovered', handlePeerDiscovered);
      window.removeEventListener('novaura:peer_lost', handlePeerLost);
      window.removeEventListener('novaura:mesh_packet_received', handleMeshPacket);
      window.removeEventListener('novaura:mesh_room_switched', handleRoomSwitched);
      window.removeEventListener('novaura:contact_saved', handleContactEvent);
      window.removeEventListener('novaura:contact_deleted', handleContactEvent);
      window.removeEventListener('novaura:outbox_queued', handleOutboxEvent);
      window.removeEventListener('novaura:outbox_delivered', handleOutboxEvent);
      window.removeEventListener('novaura:file_received', handleTransferEvent);
      window.removeEventListener('novaura:transfer_updated', handleTransferEvent);
    };
  }, []);

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString();
    setPacketLogs(prev => [...prev.slice(-99), `[${time}] ${text}`]);
    if (logContainerRef.current) {
      setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  const currentRoom = meshStatus?.current_room || 'general';

  const handleRoomHop = async (roomName) => {
    const clean = roomName.trim().replace(/^#/, '');
    if (!clean || clean === currentRoom) return;
    setIsSwitchingRoom(true);
    addLog(`[ROOM_CHANGE] Switching swarm room to #${clean}...`);
    try {
      await switchSwarmRoom(clean);
      setCustomRoomInput('');
      setTimeout(fetchStatus, 800);
    } catch (err) {
      addLog(`[ERROR] Room switch failed: ${err}`);
    } finally {
      setIsSwitchingRoom(false);
    }
  };

  const handleSendShout = (e) => {
    e?.preventDefault();
    if (!shoutMessage.trim()) return;
    setIsSendingShout(true);

    const identity = getLocalIdentity();
    const packet = {
      id: 'shout_' + Date.now(),
      authorHandle: identity?.handle || 'operator',
      authorName: identity?.displayName || 'Sovereign Operator',
      authorColor: identity?.avatarColor || '#00f0ff',
      content: shoutMessage.trim(),
      type: 'wall',
      subAura: `r/${currentRoom}`,
      timestamp: new Date().toISOString(),
    };

    broadcastMeshPacket('MESH_POST', { post: packet });
    addLog(`[SWARM_BROADCAST] Shouted to #${currentRoom}: "${shoutMessage.trim()}"`);
    setShoutMessage('');
    setIsSendingShout(false);
  };

  const getComputedInviteCode = () => {
    if (!meshStatus) return '';
    const identity = getLocalIdentity();
    const nodeName = encodeURIComponent(meshStatus.node_name || identity.displayName || 'Sovereign Node');
    const nodeId = meshStatus.node_id || identity.publicKey || 'did:nova:node';

    if (inviteMode === 'relay') {
      const relayHost = meshStatus.relay_address || 'relay.novaura.life:43889';
      return `nova://relay/${relayHost}?target=${nodeId}&name=${nodeName}`;
    }

    // Direct: the public address when one is set, else this PC's address on the LAN.
    const wan = meshStatus.wan_ip && meshStatus.wan_ip !== '0.0.0.0' ? meshStatus.wan_ip : '';
    const host = wan || meshStatus.lan_ip || '127.0.0.1';
    const port = meshStatus.tcp_listen_port || 43889;
    return `nova://connect/${nodeId}@${host}:${port}?name=${nodeName}`;
  };

  const handleCopyInvite = () => {
    const code = getComputedInviteCode();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedInvite(true);
    addLog(`[INVITE] Copied ${inviteMode.toUpperCase()} invite code to clipboard.`);
    setTimeout(() => setCopiedInvite(false), 2200);
  };

  const handleConnect = async (e) => {
    e?.preventDefault();
    const target = remoteAddressInput.trim();
    if (!target) return;

    setIsConnecting(true);
    setConnectionResult(null);
    addLog(`[DIAL] Initiating handshake to: ${target}...`);

    try {
      const result = await connectManualPeer(target);
      if (result) {
        setConnectionResult({
          success: true,
          message: `Successfully peered with remote node (${result.name || result.address || target})!`,
        });
        addLog(`[HANDSHAKE_OK] Secure direct P2P link established with ${result.name || target}.`);
        setRemoteAddressInput('');
        fetchStatus();
      } else {
        setConnectionResult({
          success: false,
          message: 'Connection failed or timed out. If behind a firewall, use the WAN Relay tunnel.',
        });
        addLog(`[DIAL_FAIL] Handshake rejected or unroutable.`);
      }
    } catch (err) {
      setConnectionResult({
        success: false,
        message: String(err?.message || err || 'Network handshake failed.'),
      });
      addLog(`[ERROR] Dial error: ${String(err?.message || err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePingPeer = async (peer) => {
    const start = Date.now();
    setPingMap(prev => ({ ...prev, [peer.id]: 'pinging...' }));
    addLog(`[PING] Probing peer ${peer.name} (${peer.address})...`);

    try {
      const success = await sendDirectMeshPacket(peer.id, 'MESH_PEER_PING', {
        timestamp_ms: start,
      });
      const elapsed = Date.now() - start;
      if (success) {
        setPingMap(prev => ({ ...prev, [peer.id]: `${elapsed} ms` }));
        addLog(`[PONG] Peer ${peer.name} responded in ${elapsed} ms.`);
      } else {
        setPingMap(prev => ({ ...prev, [peer.id]: 'timeout' }));
        addLog(`[PING_TIMEOUT] Peer ${peer.name} failed to reply.`);
      }
    } catch (err) {
      setPingMap(prev => ({ ...prev, [peer.id]: 'error' }));
      addLog(`[PING_ERROR] Error pinging peer: ${err}`);
    }
  };

  const handleApplyRelay = async () => {
    setIsUpdatingRelay(true);
    addLog(`[RELAY_CONFIG] Reconfiguring WAN Relay to ${customRelayInput}...`);
    try {
      await configureMeshRelay(customRelayInput.trim());
      addLog(`[RELAY_CONFIG] Configuration applied. Connecting supervisor tunnel...`);
      setTimeout(fetchStatus, 1500);
    } catch (err) {
      addLog(`[RELAY_ERROR] Failed to set relay: ${err}`);
    } finally {
      setIsUpdatingRelay(false);
    }
  };

  const handleSaveContact = async (peer, trustTier = 'verified') => {
    try {
      await saveContact({
        handle: peer.name || 'peer_' + (peer.id ? peer.id.substring(0, 8) : 'node'),
        nodeId: peer.id,
        publicKey: peer.publicKey || peer.id,
        trustTier,
        allowInferenceSharing: trustTier === 'ally',
      });
      addLog(`[TRUST] Contact ${peer.name || peer.id.substring(0, 8)} saved with tier: ${trustTier}`);
      fetchContactsData();
    } catch (err) {
      addLog(`[TRUST_ERROR] Failed to save contact: ${err.message || err}`);
    }
  };

  const handleManualAddContact = async (e) => {
    e?.preventDefault();
    if (!newContactNodeId.trim()) return;
    setIsAddingContact(true);
    try {
      await saveContact({
        handle: newContactHandle.trim() || 'peer_' + newContactNodeId.trim().substring(0, 8),
        nodeId: newContactNodeId.trim(),
        publicKey: newContactNodeId.trim(),
        trustTier: newContactTier,
        allowInferenceSharing: newContactTier === 'ally',
      });
      addLog(`[TRUST] Contact added to Web of Trust: ${newContactHandle.trim() || newContactNodeId.trim()}`);
      setNewContactHandle('');
      setNewContactNodeId('');
      fetchContactsData();
    } catch (err) {
      addLog(`[TRUST_ERROR] Failed to add contact: ${err.message || err}`);
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleUpdateTrust = async (contactId, tier) => {
    try {
      await updateContactTrust(contactId, tier);
      addLog(`[TRUST] Updated contact trust tier to: ${tier}`);
      fetchContactsData();
    } catch (err) {
      addLog(`[TRUST_ERROR] Failed to update trust: ${err.message || err}`);
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await deleteContact(contactId);
      addLog(`[TRUST] Contact removed from Web of Trust.`);
      fetchContactsData();
    } catch (err) {
      addLog(`[TRUST_ERROR] Failed to delete contact: ${err.message || err}`);
    }
  };

  const handleToggleSharing = () => {
    const next = !sharingInferenceState;
    setInferenceSharing(next);
    setSharingInferenceState(next);
    addLog(`[SWARM_COMPUTE] GPU/Local Inference sharing set to: ${next ? 'ENABLED' : 'DISABLED'}`);
  };

  const triggerFileSelect = (peerId) => {
    setTargetPeerForFile(peerId);
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !targetPeerForFile) return;
    addLog(`[AIRDROP] Offering ${file.name} (${formatBytes(file.size)}) to peer ${targetPeerForFile.substring(0, 8)}...`);
    try {
      const res = await sendFileToPeer(targetPeerForFile, file);
      addLog(`[AIRDROP_QUEUED] Offer sent: ${res.fileName} (ID: ${res.transferId.substring(0, 11)}). It sends once they accept; see Transfers.`);
      fetchTransfersData();
      setActiveTab('transfers');
    } catch (err) {
      addLog(`[AIRDROP_ERROR] Transfer failed: ${err.message || err}`);
    } finally {
      e.target.value = '';
      setTargetPeerForFile(null);
    }
  };

  const handleRunSwarmInference = async (e) => {
    e?.preventDefault();
    if (!swarmPrompt.trim()) return;
    setIsTestingSwarmInference(true);
    setSwarmInferenceResult(null);
    addLog(`[SWARM_INFERENCE] Requesting remote compute for ${swarmRole.toUpperCase()} model...`);

    try {
      const result = await requestPeerInference({
        targetPeerId: selectedPeerForInference || undefined,
        role: swarmRole,
        prompt: swarmPrompt.trim(),
      });
      setSwarmInferenceResult(result);
      addLog(`[SWARM_INFERENCE_OK] Received remote response from ${result.providerName || 'peer node'} (${result.model})`);
    } catch (err) {
      setSwarmInferenceResult({ error: err.message || String(err) });
      addLog(`[SWARM_INFERENCE_FAIL] Inference failed: ${err.message || err}`);
    } finally {
      setIsTestingSwarmInference(false);
    }
  };

  const openApp = (appId) => {
    if (kernel?.windowManager?.openWindow) {
      kernel.windowManager.openWindow(appId);
    }
  };

  const peersList = meshStatus?.peers || [];
  const roomPeers = peersList.filter(p => p.peer_type === 'ROOM_SWARM' || !p.peer_type || p.peer_type === 'DIRECT_WAN');
  const wanIp = meshStatus?.wan_ip;
  const hasWan = Boolean(wanIp && wanIp !== '0.0.0.0' && wanIp !== '127.0.0.1');

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden border border-slate-800">
      {/* Top Banner: Global Mesh Telemetry */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Globe className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                NovAura Sovereign Peering
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                WAN & LAN MESH
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                <span>{currentRoom}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Decentralized Global Social Mesh • Zero-Config Auto-Discovery • End-to-End Encrypted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* WAN Relay indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <Server className={`w-3.5 h-3.5 ${meshStatus?.relay_connected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-medium">WAN RELAY & ROSTER</span>
              <span className={`text-[11px] font-mono font-semibold ${meshStatus?.relay_connected ? 'text-emerald-400' : 'text-amber-300'}`}>
                {meshStatus?.relay_connected ? 'ONLINE (25s Keepalive)' : 'UNREACHABLE · LAN PEERS ONLY'}
              </span>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchStatus}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh Network Telemetry & Swarm Roster"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Network Interface Specs Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-slate-900/40 border-b border-slate-800/80 text-xs font-mono">
        {/* Active Room */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>SWARM ROOM</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-bold">AUTO-JOINED</span>
          </div>
          <span className="text-sm font-bold text-emerald-300 truncate">
            #{currentRoom}
          </span>
          <span className="text-[10px] text-slate-500">{peersList.length} nodes in room</span>
        </div>

        {/* Address for direct invites. Sovereign does not look up its public IP
            (no third-party servers), so direct invites work on the local network. */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{hasWan ? 'PUBLIC ADDRESS' : 'LAN ADDRESS'}</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300">{hasWan ? 'WAN' : 'LOCAL'}</span>
          </div>
          <span className="text-sm font-bold text-cyan-300 truncate">
            {hasWan ? wanIp : meshStatus?.lan_ip || '127.0.0.1'}
          </span>
          <span className="text-[10px] text-slate-500">{hasWan ? 'Internet address' : 'Peers on your network reach you here; use a relay invite across the internet'}</span>
        </div>

        {/* TCP Listening Port */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>TCP SOCKET</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300">LISTENING</span>
          </div>
          <span className="text-sm font-bold text-emerald-300">
            Port {meshStatus?.tcp_listen_port || 43889}
          </span>
          <span className="text-[10px] text-slate-500">Direct peer port</span>
        </div>

        {/* Total Active Connected Nodes */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>ACTIVE PEERS</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300">LIVE</span>
          </div>
          <span className="text-sm font-bold text-cyan-300">
            {peersList.length} Connected
          </span>
          <span className="text-[10px] text-slate-500">Global mesh swarm</span>
        </div>
      </div>

      {/* Hidden File Input for Direct Sovereign Air-Drop */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChosen}
        className="hidden"
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950">
        <button
          onClick={() => setActiveTab('lobby')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'lobby'
              ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Universe Lobby (#{currentRoom})</span>
        </button>

        <button
          onClick={() => setActiveTab('trust')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'trust'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Web of Trust ({contactsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('compute')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'compute'
              ? 'border-purple-400 text-purple-400 bg-purple-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Swarm AI & Outbox</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'transfers'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Transfers{transfersList.some(t => t.status === 'offered') ? ` (${transfersList.filter(t => t.status === 'offered').length} waiting)` : ''}</span>
        </button>

        <button
          onClick={() => setActiveTab('connect')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'connect'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Direct Dial & Invite</span>
        </button>

        <button
          onClick={() => setActiveTab('peers')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'peers'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>Active Nodes ({peersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('relay')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'relay'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>WAN Relay Hub</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'diagnostics'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Diagnostics</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'lobby' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Universe Swarm Hero Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">
                        Decentralized Universe Lobby
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Room #{currentRoom}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Auto-started on boot • Connects everyone in this room like a decentralized social network.
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className="text-[10px] text-slate-400 block uppercase">Room Members</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {roomPeers.length + 1} Online Node{roomPeers.length + 1 === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Room Quick Switcher Chips */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Quick Room Switcher:</span>
                  <span className="text-[11px] text-slate-500">Click any preset or enter custom room</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {['general', 'writers-guild', 'cybeni-builders', 'crypto-lab', 'team-private'].map(room => (
                    <button
                      key={room}
                      onClick={() => handleRoomHop(room)}
                      disabled={isSwitchingRoom || currentRoom === room}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        currentRoom === room
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <Hash className="w-3 h-3 opacity-60" />
                      <span>{room}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Room Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customRoomInput.trim()) handleRoomHop(customRoomInput);
                  }}
                  className="flex gap-2 pt-1"
                >
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-xs">#</span>
                    <input
                      type="text"
                      value={customRoomInput}
                      onChange={(e) => setCustomRoomInput(e.target.value)}
                      placeholder="Enter custom room name (e.g. project-apollo, book-club)..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSwitchingRoom || !customRoomInput.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-all cursor-pointer shrink-0"
                  >
                    {isSwitchingRoom ? 'Joining...' : 'Join Room'}
                  </button>
                </form>
              </div>

              {/* Swarm Shout Bar */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Broadcast Shout to Room #{currentRoom}</span>
                </div>
                <form onSubmit={handleSendShout} className="flex gap-2">
                  <input
                    type="text"
                    value={shoutMessage}
                    onChange={(e) => setShoutMessage(e.target.value)}
                    placeholder={`Say hello or post a live update to all online nodes in #${currentRoom}...`}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={isSendingShout || !shoutMessage.trim()}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Broadcast</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Room Members Roster List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Active Nodes in #{currentRoom}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    {roomPeers.length} Remote Peer{roomPeers.length === 1 ? '' : 's'}
                  </span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Automatically peered • No invite link needed
                </span>
              </div>

              {roomPeers.length === 0 ? (
                <div className="p-10 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 text-emerald-400 mx-auto flex items-center justify-center">
                    <Globe className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-200">You are the First Pioneer in #{currentRoom}</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Your node is registered in the decentralized room roster. As other NovAura users launch their OS anywhere in the world, they will automatically appear here!
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      onClick={() => openApp('novasocial')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 transition-colors cursor-pointer"
                    >
                      Open NovaSocial Feed
                    </button>
                    <button
                      onClick={() => setActiveTab('connect')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
                    >
                      Copy Shareable Invite Link
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {roomPeers.map(peer => {
                    const latency = pingMap[peer.id];
                    const contactRecord = contactsList.find(c => c.nodeId === peer.id);
                    return (
                      <div
                        key={peer.id}
                        className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono text-xs">
                            {peer.name ? peer.name[0].toUpperCase() : 'N'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{peer.name || 'Remote Peer'}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                SWARM PEER
                              </span>
                              {contactRecord && (
                                <button
                                  onClick={() => {
                                    const nextTier = contactRecord.trustTier === 'verified' ? 'ally' : contactRecord.trustTier === 'ally' ? 'blocked' : 'verified';
                                    handleUpdateTrust(contactRecord.id, nextTier);
                                  }}
                                  title="Click to cycle trust tier: Verified → Ally → Blocked"
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border cursor-pointer hover:opacity-80 transition-opacity ${
                                    contactRecord.trustTier === 'ally'
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      : contactRecord.trustTier === 'blocked'
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                  }`}
                                >
                                  {contactRecord.trustTier.toUpperCase()} ⟳
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                              <span>{peer.address}</span>
                              <span>•</span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[140px]">{peer.id}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {latency && (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 bg-emerald-500/10 rounded">
                              {latency}
                            </span>
                          )}

                          {/* Contact Pin/Unpin Button */}
                          {!contactRecord ? (
                            <button
                              onClick={() => handleSaveContact(peer, 'verified')}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
                              title="Pin to Web of Trust"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeleteContact(contactRecord.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Unpin / Remove from Web of Trust"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Air-Drop File Button */}
                          <button
                            onClick={() => triggerFileSelect(peer.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                            title="Air-Drop File to Peer"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>

                          {/* Swarm AI Compute Request Button */}
                          <button
                            onClick={() => {
                              setSelectedPeerForInference(peer.id);
                              setActiveTab('compute');
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-purple-400 transition-colors cursor-pointer"
                            title="Request AI Compute from Peer"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handlePingPeer(peer)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
                          >
                            Ping
                          </button>
                          <button
                            onClick={() => openApp('novamail')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Send NovaMail"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openApp('literature_ide')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Share Literature"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'trust' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Web of Trust Header */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/30 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Sovereign Web-of-Trust & Address Book
                    </h2>
                    <p className="text-xs text-slate-400">
                      Zero-Knowledge trust hierarchy • Blocked peers dropped at boundary • Allies gain priority compute
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    {contactsList.filter(c => c.trustTier === 'ally').length} Allies
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {contactsList.filter(c => c.trustTier === 'verified').length} Verified
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    {contactsList.filter(c => c.trustTier === 'blocked').length} Blocked
                  </span>
                </div>
              </div>

              {/* Pin Contact Quick Form */}
              <form onSubmit={handleManualAddContact} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Pin New Node to Web of Trust</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Provide Peer Handle & Node Public Key / ID</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newContactHandle}
                    onChange={(e) => setNewContactHandle(e.target.value)}
                    placeholder="Handle (e.g. @marcus)"
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <input
                    type="text"
                    value={newContactNodeId}
                    onChange={(e) => setNewContactNodeId(e.target.value)}
                    placeholder="Node ID or Public Key"
                    className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <div className="flex gap-1.5">
                    <select
                      value={newContactTier}
                      onChange={(e) => setNewContactTier(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="verified">Verified</option>
                      <option value="ally">Ally (Compute)</option>
                      <option value="blocked">Blocked</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isAddingContact || !newContactNodeId.trim()}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Pin</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Contacts Directory */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Pinned Contacts Directory</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    {contactsList.length} Total
                  </span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Stored securely in sovereign local database (Zero Cloud)
                </span>
              </div>

              {contactsList.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 text-cyan-400 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-200">No Pinned Contacts Yet</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Pin peers from the <button onClick={() => setActiveTab('lobby')} className="text-emerald-400 underline cursor-pointer">Universe Lobby</button> to elevate them into trusted Allies or block malicious nodes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {contactsList.map(contact => {
                    const isOnline = roomPeers.some(p => p.id === contact.nodeId);
                    return (
                      <div
                        key={contact.id}
                        className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold font-mono text-xs ${
                            contact.trustTier === 'ally'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : contact.trustTier === 'blocked'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          }`}>
                            {contact.handle ? contact.handle.replace('@', '')[0].toUpperCase() : 'C'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{contact.handle || 'Peer Node'}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                                contact.trustTier === 'ally'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : contact.trustTier === 'blocked'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              }`}>
                                {contact.trustTier ? contact.trustTier.toUpperCase() : 'VERIFIED'}
                              </span>
                              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} title={isOnline ? 'Online in Room' : 'Offline'} />
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                              <span className="truncate max-w-[200px]">{contact.nodeId}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions & Tier Switcher */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[10px] font-mono font-bold">
                            <button
                              onClick={() => handleUpdateTrust(contact.id, 'ally')}
                              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${contact.trustTier === 'ally' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-emerald-300'}`}
                            >
                              Ally
                            </button>
                            <button
                              onClick={() => handleUpdateTrust(contact.id, 'verified')}
                              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${contact.trustTier === 'verified' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-cyan-300'}`}
                            >
                              Verified
                            </button>
                            <button
                              onClick={() => handleUpdateTrust(contact.id, 'blocked')}
                              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${contact.trustTier === 'blocked' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-rose-300'}`}
                            >
                              Block
                            </button>
                          </div>

                          <button
                            onClick={() => triggerFileSelect(contact.nodeId)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                            title="Air-Drop File"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedPeerForInference(contact.nodeId);
                              setActiveTab('compute');
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-purple-400 transition-colors cursor-pointer"
                            title="Request AI Compute"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'compute' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Swarm Compute Hero & GPU Sharing Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/30 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Distributed Swarm AI Compute & Sovereign Outbox
                    </h2>
                    <p className="text-xs text-slate-400">
                      Share GPU with ally contacts • Remote AI inference • Asynchronous store-and-forward outbox. Everyone else: AI Lounge → Inference Exchange
                    </p>
                  </div>
                </div>

                {/* Local GPU Sharing Toggle */}
                <button
                  onClick={handleToggleSharing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer shadow-md ${
                    sharingInferenceState
                      ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${sharingInferenceState ? 'text-purple-400' : 'text-slate-500'}`} />
                  <span>{sharingInferenceState ? 'SHARING GPU WITH ALLIES (ACTIVE)' : 'SHARE GPU WITH ALLIES (OFF)'}</span>
                </button>
              </div>

              {/* Swarm Inference Requester */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">Request Remote Swarm Inference:</span>
                    <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px] font-mono font-bold">
                      <button
                        type="button"
                        onClick={() => setSwarmRole('aura')}
                        className={`px-2.5 py-0.5 rounded cursor-pointer ${swarmRole === 'aura' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-cyan-300'}`}
                      >
                        Aura (Cognitive)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSwarmRole('nova')}
                        className={`px-2.5 py-0.5 rounded cursor-pointer ${swarmRole === 'nova' ? 'bg-purple-500 text-slate-950' : 'text-slate-400 hover:text-purple-300'}`}
                      >
                        Nova (Velocity)
                      </button>
                    </div>
                  </div>

                  {selectedPeerForInference && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                      <span>Target: {selectedPeerForInference.substring(0, 10)}...</span>
                      <button
                        onClick={() => setSelectedPeerForInference(null)}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleRunSwarmInference} className="space-y-2">
                  <textarea
                    rows={3}
                    value={swarmPrompt}
                    onChange={(e) => setSwarmPrompt(e.target.value)}
                    placeholder="Enter prompt to dispatch to peer nodes over sovereign mesh..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 font-sans"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Summarize distributed consensus models',
                        'Draft a sovereign cyber-physical protocol spec',
                        'Explain zero-knowledge proofs simply'
                      ].map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setSwarmPrompt(chip)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isTestingSwarmInference || !swarmPrompt.trim()}
                      className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isTestingSwarmInference ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Querying Swarm...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Dispatch to Mesh</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Swarm Result Card */}
                {swarmInferenceResult && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-purple-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Swarm Response from {swarmInferenceResult.providerName || 'Peer Node'}</span>
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Model: {swarmInferenceResult.model || 'dual-inference'}
                      </span>
                    </div>
                    {swarmInferenceResult.error ? (
                      <p className="text-xs text-rose-400 font-mono">{swarmInferenceResult.error}</p>
                    ) : (
                      <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-950 p-3 rounded-lg border border-slate-800 font-sans">
                        {swarmInferenceResult.response}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Sovereign Store-and-Forward Outbox */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Store-and-Forward Outbox Queue</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      {outboxList.length} Messages
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Durable offline packet queue • Automatically flushes when recipient peers appear in room
                  </p>
                </div>
                <button
                  onClick={fetchOutboxData}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {outboxList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-xs text-slate-500">
                  Outbox is clear. All direct messages and packets are currently delivered.
                </div>
              ) : (
                <div className="space-y-2">
                  {outboxList.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300">
                          {item.packetType}
                        </span>
                        <span className="text-slate-300">To: {item.recipientId ? item.recipientId.substring(0, 12) + '...' : 'Swarm'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'DELIVERED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : item.status === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {item.status} ({item.retries || 0} retries)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'transfers' && <TransfersPanel peers={peersList} />}

        {activeTab === 'connect' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Sovereign Invite Code Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Direct Sovereign Node Invite Link</h2>
                    <p className="text-xs text-slate-400">
                      Share this invite URL for 1-to-1 direct dialing outside the public Universe Room.
                    </p>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setInviteMode('wan')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      inviteMode === 'wan'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Direct
                  </button>
                  <button
                    onClick={() => setInviteMode('relay')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      inviteMode === 'relay'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    WAN Relay Tunnel
                  </button>
                </div>
              </div>

              {/* Code Display Bar */}
              <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="flex-1 font-mono text-xs text-cyan-400 px-3 py-1.5 overflow-x-auto whitespace-nowrap scrollbar-none select-all">
                  {getComputedInviteCode() || 'Initializing sovereign address...'}
                </div>
                <button
                  onClick={handleCopyInvite}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    copiedInvite
                      ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  }`}
                >
                  {copiedInvite ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Invite</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Connect to Remote Node Dialer */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Direct Peer Dial Pad</h2>
                  <p className="text-xs text-slate-400">
                    Paste a peer's invite link (<span className="text-cyan-400 font-mono">nova://connect/...</span> or <span className="text-amber-400 font-mono">nova://relay/...</span>) or raw IP:Port.
                  </p>
                </div>
              </div>

              <form onSubmit={handleConnect} className="flex gap-2">
                <input
                  type="text"
                  value={remoteAddressInput}
                  onChange={(e) => setRemoteAddressInput(e.target.value)}
                  placeholder="Paste invite URL or remote IP:Port (e.g., 203.0.113.42:43889)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  type="submit"
                  disabled={isConnecting || !remoteAddressInput.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Handshaking...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Connect Node</span>
                    </>
                  )}
                </button>
              </form>

              {connectionResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    connectionResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {connectionResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{connectionResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'peers' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">All Active Network Peers ({peersList.length})</h2>
                <p className="text-xs text-slate-400">
                  Total physical nodes connected across Room Swarm, Direct WAN, and LAN.
                </p>
              </div>
              <button
                onClick={fetchStatus}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Probe Connections</span>
              </button>
            </div>

            {peersList.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-500 mx-auto flex items-center justify-center">
                  <Laptop className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-300">No Remote Nodes Connected Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    NovAura is listening on Port {meshStatus?.tcp_listen_port || 43889} in room #{currentRoom}. Check the <button onClick={() => setActiveTab('lobby')} className="text-emerald-400 underline cursor-pointer">Universe Lobby</button> to see the active swarm.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {peersList.map((peer) => {
                  const latency = pingMap[peer.id];
                  const contactRecord = contactsList.find(c => c.nodeId === peer.id);
                  return (
                    <div
                      key={peer.id}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold font-mono">
                          {peer.name ? peer.name[0].toUpperCase() : 'N'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{peer.name || 'Remote Peer'}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                                peer.peer_type === 'ROOM_SWARM'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : peer.peer_type === 'DIRECT_WAN'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              }`}
                            >
                              {peer.peer_type || 'ROOM_SWARM'}
                            </span>
                            {contactRecord && (
                              <button
                                onClick={() => {
                                  const nextTier = contactRecord.trustTier === 'verified' ? 'ally' : contactRecord.trustTier === 'ally' ? 'blocked' : 'verified';
                                  handleUpdateTrust(contactRecord.id, nextTier);
                                }}
                                title="Click to cycle trust tier: Verified → Ally → Blocked"
                                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer hover:opacity-80 transition-opacity ${
                                  contactRecord.trustTier === 'ally'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : contactRecord.trustTier === 'blocked'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                }`}
                              >
                                {contactRecord.trustTier.toUpperCase()} ⟳
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <span>{peer.address}</span>
                            <span>•</span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[180px]">{peer.id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Telemetry & Actions */}
                      <div className="flex items-center gap-2">
                        <div className="text-right font-mono text-xs mr-2">
                          <span className="text-[10px] text-slate-500 block">ROUNDTRIP</span>
                          <span className={`font-bold ${latency === 'timeout' || latency === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {latency || 'Ready'}
                          </span>
                        </div>

                        {!contactRecord ? (
                          <button
                            onClick={() => handleSaveContact(peer, 'verified')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
                            title="Pin to Web of Trust"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteContact(contactRecord.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Unpin / Remove from Web of Trust"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => triggerFileSelect(peer.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Air-Drop File to Peer"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedPeerForInference(peer.id);
                            setActiveTab('compute');
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-purple-400 transition-colors cursor-pointer"
                          title="Request AI Compute from Peer"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handlePingPeer(peer)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                        >
                          Ping
                        </button>
                        <button
                          onClick={() => openApp('novamail')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Send NovaMail"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'relay' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">WAN Relay Supervisor</h2>
                    <p className="text-xs text-slate-400">
                      Zero-Knowledge packet forwarding and room rendezvous for nodes behind NATs.
                    </p>
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                  meshStatus?.relay_connected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {meshStatus?.relay_connected ? 'TUNNEL ACTIVE' : 'RELAY UNREACHABLE · RETRYING'}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-300">
                  Relay Endpoint Address (Host:Port)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customRelayInput}
                    onChange={(e) => setCustomRelayInput(e.target.value)}
                    placeholder="e.g. relay.novaura.life:43889 or your.vps.com:43889"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <button
                    onClick={handleApplyRelay}
                    disabled={isUpdatingRelay || !customRelayInput.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isUpdatingRelay ? 'Applying...' : 'Apply Relay'}
                  </button>
                  <button
                    onClick={() => {
                      setCustomRelayInput('relay.novaura.life:43889');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer shrink-0"
                  >
                    Reset Default
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Host Your Own Private Sovereign Headless Relay</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                NovAura ships with a production-ready standalone headless relay binary (<span className="text-cyan-300 font-mono">novaura_relay</span>). You can run it on any cloud VPS (DigitalOcean, AWS, Linode, Hetzner) with 0 setup.
              </p>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 space-y-1 select-all">
                <div className="text-slate-500"># Run on any Linux / Windows / macOS server:</div>
                <div>cargo run --bin novaura_relay -- --port 43889</div>
              </div>

              {/* Zero-Knowledge & Network Privacy Disclosure */}
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-slate-300 text-[11px] space-y-1">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Zero-Knowledge Architecture & Privacy Disclosure</span>
                </div>
                <p className="text-slate-400 leading-normal">
                  Joining public mesh rooms broadcasts your socket endpoint strictly to peers currently active in that specific room to negotiate NAT traversal. Sensitive peer-to-peer communications (AuraMail, private files) use X25519/AES-256-GCM sealed envelopes, ensuring the relay operates as a blind forwarder with zero message visibility.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Live Sovereign Mesh Terminal</h2>
                <p className="text-xs text-slate-400">
                  Real-time telemetry of direct TCP packets and peer heartbeats.
                </p>
              </div>
              <button
                onClick={() => setPacketLogs([])}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
              >
                Clear Log
              </button>
            </div>

            <div
              ref={logContainerRef}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-300 h-96 overflow-y-auto space-y-1.5 leading-relaxed shadow-inner"
            >
              {packetLogs.length === 0 ? (
                <div className="text-slate-600 italic">Listening for sovereign mesh network activity...</div>
              ) : (
                packetLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`${
                      log.includes('ERROR') || log.includes('FAIL')
                        ? 'text-rose-400'
                        : log.includes('OK') || log.includes('JOIN') || log.includes('ROSTER')
                        ? 'text-emerald-400'
                        : log.includes('INVITE') || log.includes('DIAL') || log.includes('SWARM')
                        ? 'text-cyan-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
