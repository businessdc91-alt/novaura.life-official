/**
 * sovereignCallService.js — Decentralized P2P WebRTC Calling & Media Engine
 *
 * Implements:
 * - Direct peer-to-peer audio & video calling with end-to-end DTLS-SRTP encryption
 * - In-ecosystem Sovereign Phone Number dialing (+1-700-NOVA-XXXX)
 * - Multi-tier signaling: Global Decentralized Mesh Relay + Local BroadcastChannel + Direct Token Handshake
 * - Automatic STUN NAT traversal for global internet connectivity
 * - Call state machine: IDLE -> DIALING -> RINGING -> CONNECTED -> ENDED
 * - Call logging to on-device private cloud database (db.call_logs)
 */

import { db } from '../database/sovereignDatabase.js';
import { getLocalIdentity, getPhysicalMeshStatus } from './sovereignMesh.js';

// Public STUN servers for peer-to-peer NAT traversal across the global internet
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' },
];

/**
 * STUN plus the relay's TURN server when it offers one. STUN alone fails when
 * both callers sit behind carrier NAT (hotspots, 5G home internet); TURN then
 * carries the still-encrypted media.
 */
export async function getIceServers() {
  try {
    const turn = (await getPhysicalMeshStatus())?.turn;
    if (turn?.urls?.length && turn.expires_at_ms > Date.now() + 60_000) {
      return [...STUN_SERVERS, { urls: turn.urls, username: turn.username, credential: turn.credential }];
    }
  } catch {
    // No relay status available: STUN only.
  }
  return STUN_SERVERS;
}

export const CallState = {
  IDLE: 'IDLE',
  DIALING: 'DIALING',
  RINGING: 'RINGING',
  CONNECTED: 'CONNECTED',
  ENDED: 'ENDED',
};

class SovereignCallService extends EventTarget {
  constructor() {
    super();
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.dataChannel = null;
    this.callState = CallState.IDLE;
    this.currentCall = null; // { callId, remoteNumber, remoteHandle, direction, isVideo, startTime }
    this.signalChannel = null;
    this.meshRelaySocket = null;
    this.callTimer = null;
    this.durationSec = 0;

    this._initSignalBuses();
  }

  // ── 1. Signaling Buses Initialization ─────────────────────────────────────
  _initSignalBuses() {
    if (typeof window === 'undefined') return;

    // 1. Local / Multi-Instance Signal Bus
    if (window.BroadcastChannel) {
      try {
        this.signalChannel = new BroadcastChannel('novaura_webrtc_signaling');
        this.signalChannel.onmessage = (e) => this._handleSignalPacket(e.data);
      } catch (err) {
        console.warn('[CallService] Local signal bus note:', err);
      }
    }

    // 2. Global Decentralized Mesh Relay (WebSocket pub-sub over public relay networks)
    this._connectMeshRelay();
  }

  _connectMeshRelay() {
    // Connect to decentralized signaling relay with automatic reconnection
    try {
      const relayUrl = 'wss://relay.damus.io'; // Public decentralized WSS relay
      this.meshRelaySocket = new WebSocket(relayUrl);

      this.meshRelaySocket.onopen = () => {
        console.info('[CallService] Connected to Global Decentralized Mesh Relay');
        const identity = getLocalIdentity();
        if (identity?.phoneNumber) {
          // Subscribe to incoming calls addressed to our phone number
          const subMsg = JSON.stringify(['REQ', 'incoming_calls', { kinds: [20000], '#t': [identity.phoneNumber] }]);
          this.meshRelaySocket.send(subMsg);
        }
      };

      this.meshRelaySocket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (Array.isArray(parsed) && parsed[0] === 'EVENT') {
            const rawContent = parsed[2]?.content;
            if (rawContent) {
              const signal = JSON.parse(rawContent);
              this._handleSignalPacket(signal);
            }
          }
        } catch {}
      };

      this.meshRelaySocket.onerror = () => {
        // Soft fail; local and direct token signaling remains active
      };

      this.meshRelaySocket.onclose = () => {
        // Reconnect after delay
        setTimeout(() => this._connectMeshRelay(), 30000);
      };
    } catch {
      // Mesh relay optional
    }
  }

  _sendSignal(packet) {
    const enriched = {
      ...packet,
      fromNumber: getLocalIdentity()?.phoneNumber || '+1-700-NOVA-0001',
      fromHandle: getLocalIdentity()?.handle || 'operator',
      timestamp: Date.now(),
    };

    // 1. Broadcast locally across windows
    if (this.signalChannel) {
      try {
        this.signalChannel.postMessage(enriched);
      } catch {}
    }

    // 2. Publish to Global Decentralized Mesh Relay if connected
    if (this.meshRelaySocket && this.meshRelaySocket.readyState === WebSocket.OPEN) {
      try {
        const nostrEvent = JSON.stringify([
          'EVENT',
          {
            kind: 20000,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', packet.toNumber]],
            content: JSON.stringify(enriched),
          },
        ]);
        this.meshRelaySocket.send(nostrEvent);
      } catch {}
    }

    // Dispatch internal event
    this.dispatchEvent(new CustomEvent('signal_sent', { detail: enriched }));
  }

  // ── 2. Handling Incoming Signal Packets ────────────────────────────────────
  async _handleSignalPacket(data) {
    if (!data || !data.type) return;

    const myIdentity = getLocalIdentity();
    const myNumber = myIdentity?.phoneNumber || '+1-700-NOVA-0001';

    // Ignore if not addressed to this node (unless it is a general broadcast)
    if (data.toNumber && data.toNumber !== myNumber) return;

    // Ignore packets from self
    if (data.fromNumber === myNumber && data.callId === this.currentCall?.callId && this.currentCall?.direction === 'outgoing') {
      return;
    }

    switch (data.type) {
      case 'CALL_OFFER':
        if (this.callState === CallState.IDLE) {
          this._handleIncomingCallOffer(data);
        } else {
          // Send busy signal
          this._sendSignal({
            type: 'CALL_BUSY',
            callId: data.callId,
            toNumber: data.fromNumber,
          });
        }
        break;

      case 'CALL_ANSWER':
        if (this.currentCall && this.currentCall.callId === data.callId && this.callState === CallState.DIALING) {
          await this._handleCallAnswer(data);
        }
        break;

      case 'ICE_CANDIDATE':
        if (this.peerConnection && this.currentCall?.callId === data.callId) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.warn('[CallService] ICE candidate error:', e);
          }
        }
        break;

      case 'CALL_REJECT':
      case 'CALL_BUSY':
      case 'CALL_HANGUP':
        if (this.currentCall && this.currentCall.callId === data.callId) {
          this.endCall(data.type === 'CALL_BUSY' ? 'Peer is currently on another call' : 'Call ended');
        }
        break;
    }
  }

  // ── 3. Call Lifecycle (Dial, Answer, Hangup) ───────────────────────────────

  async startCall(toNumber, isVideo = true) {
    if (this.callState !== CallState.IDLE) {
      throw new Error('Call already in progress');
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.currentCall = {
      callId,
      remoteNumber: toNumber,
      remoteHandle: toNumber.replace('+1-700-', ''),
      direction: 'outgoing',
      isVideo,
      startTime: null,
    };
    this._setCallState(CallState.DIALING);

    try {
      // 1. Acquire Local Media
      await this._acquireMedia(isVideo);

      // 2. Create WebRTC PeerConnection
      await this._createPeerConnection();

      // 3. Create Offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      await this.peerConnection.setLocalDescription(offer);

      // 4. Send Offer via Mesh Signal
      this._sendSignal({
        type: 'CALL_OFFER',
        callId,
        toNumber,
        sdp: offer,
        isVideo,
      });

      return callId;
    } catch (err) {
      this.endCall(`Failed to establish call: ${err.message}`);
      throw err;
    }
  }

  async _handleIncomingCallOffer(data) {
    this.currentCall = {
      callId: data.callId,
      remoteNumber: data.fromNumber,
      remoteHandle: data.fromHandle,
      direction: 'incoming',
      isVideo: Boolean(data.isVideo),
      pendingOffer: data.sdp,
      startTime: null,
    };
    this._setCallState(CallState.RINGING);

    // Notify listeners / UI to show incoming call modal
    this.dispatchEvent(new CustomEvent('incoming_call', { detail: this.currentCall }));
  }

  async answerCall(withVideo = true) {
    if (this.callState !== CallState.RINGING || !this.currentCall?.pendingOffer) {
      throw new Error('No active ringing call to answer');
    }

    try {
      // 1. Acquire Local Media
      await this._acquireMedia(withVideo);

      // 2. Create PeerConnection
      await this._createPeerConnection();

      // 3. Set Remote Description from incoming offer
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.currentCall.pendingOffer));

      // 4. Create Answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // 5. Send Answer Signal
      this._sendSignal({
        type: 'CALL_ANSWER',
        callId: this.currentCall.callId,
        toNumber: this.currentCall.remoteNumber,
        sdp: answer,
      });

      this._startTimer();
      this._setCallState(CallState.CONNECTED);
    } catch (err) {
      this.endCall(`Answer error: ${err.message}`);
    }
  }

  async _handleCallAnswer(data) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      this._startTimer();
      this._setCallState(CallState.CONNECTED);
    } catch (err) {
      console.warn('[CallService] Set remote description error:', err);
    }
  }

  rejectCall() {
    if (this.currentCall) {
      this._sendSignal({
        type: 'CALL_REJECT',
        callId: this.currentCall.callId,
        toNumber: this.currentCall.remoteNumber,
      });
      this._logCall('rejected');
    }
    this._cleanup();
    this._setCallState(CallState.IDLE);
  }

  endCall(reason = 'Call ended') {
    if (this.currentCall) {
      this._sendSignal({
        type: 'CALL_HANGUP',
        callId: this.currentCall.callId,
        toNumber: this.currentCall.remoteNumber,
        reason,
      });
      this._logCall(this.callState === CallState.CONNECTED ? 'completed' : 'missed');
    }
    this._cleanup();
    this._setCallState(CallState.ENDED);

    setTimeout(() => {
      if (this.callState === CallState.ENDED) {
        this._setCallState(CallState.IDLE);
      }
    }, 1500);
  }

  // ── 4. WebRTC Internals & Media Handling ──────────────────────────────────

  async _acquireMedia(withVideo) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('WebRTC MediaDevices API is unavailable');
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      this.dispatchEvent(new CustomEvent('local_stream', { detail: this.localStream }));
    } catch (e) {
      // Audio-only fallback if camera is unavailable or denied
      console.warn('[CallService] Video acquisition failed, falling back to audio:', e);
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.dispatchEvent(new CustomEvent('local_stream', { detail: this.localStream }));
    }
  }

  async _createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({ iceServers: await getIceServers() });

    // Attach local audio & video tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote media track reception
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.dispatchEvent(new CustomEvent('remote_stream', { detail: this.remoteStream }));
    };

    // ICE Candidate generation -> broadcast to peer
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentCall) {
        this._sendSignal({
          type: 'ICE_CANDIDATE',
          callId: this.currentCall.callId,
          toNumber: this.currentCall.remoteNumber,
          candidate: event.candidate,
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      if (state === 'connected') {
        this._setCallState(CallState.CONNECTED);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.endCall('Connection lost');
      }
    };
  }

  // ── 5. Media Control Toggles ──────────────────────────────────────────────

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // returns isMuted
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled; // returns isVideoOn
      }
    }
    return false;
  }

  async shareScreen() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing not supported');
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      }

      screenTrack.onended = () => {
        // Revert back to camera track
        const cameraTrack = this.localStream?.getVideoTracks()[0];
        if (cameraTrack && this.peerConnection) {
          const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(cameraTrack);
        }
      };

      return true;
    } catch (err) {
      console.warn('[CallService] Screen share error:', err);
      return false;
    }
  }

  // ── 6. State Machine & Call Logging ───────────────────────────────────────

  _setCallState(newState) {
    this.callState = newState;
    this.dispatchEvent(new CustomEvent('state_change', { detail: { state: newState, call: this.currentCall } }));
  }

  _startTimer() {
    this.durationSec = 0;
    clearInterval(this.callTimer);
    this.callTimer = setInterval(() => {
      this.durationSec += 1;
      this.dispatchEvent(new CustomEvent('timer_tick', { detail: { seconds: this.durationSec } }));
    }, 1000);
  }

  _cleanup() {
    clearInterval(this.callTimer);
    this.durationSec = 0;

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.remoteStream = null;

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  async _logCall(status) {
    if (!this.currentCall) return;
    try {
      const logEntry = {
        id: `call_log_${Date.now()}`,
        peerHandle: this.currentCall.remoteHandle,
        peerNumber: this.currentCall.remoteNumber,
        direction: this.currentCall.direction,
        status, // 'completed', 'missed', 'rejected'
        durationSec: this.durationSec,
        isVideo: this.currentCall.isVideo,
        timestamp: new Date().toISOString(),
      };
      await db.call_logs.put(logEntry);
      window.dispatchEvent(new CustomEvent('novaura:call_logged', { detail: logEntry }));
    } catch (err) {
      console.warn('[CallService] Log save error:', err);
    }
  }
}

export const callService = new SovereignCallService();
export default callService;
