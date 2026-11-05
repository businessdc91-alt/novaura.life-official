/**
 * sovereignCallService.js — Decentralized P2P WebRTC Calling & Media Engine
 *
 * Implements:
 * - Direct peer-to-peer audio & video calling with end-to-end DTLS-SRTP encryption
 * - In-ecosystem Sovereign Phone Number dialing (+1-700-XXXX-XXXX)
 * - Signaling over the Sovereign mesh only: a dialled number is looked up
 *   (MESH_PHONE_LOOKUP, which carries no call data), the node that answers for
 *   it is reached with direct packets signed by both node keys
 *   (MESH_CALL_SIGNAL), and once a call starts only that node's packets count.
 *   Windows on the same PC also hear each other over a BroadcastChannel.
 * - STUN, plus the relay's TURN server when it offers one
 * - Call state machine: IDLE -> DIALING -> RINGING -> CONNECTED -> ENDED
 * - Call logging to on-device private cloud database (db.call_logs)
 */

import { db } from '../database/sovereignDatabase.js';
import {
  getLocalIdentity, getPhysicalMeshStatus, broadcastMeshPacket, sendDirectMeshPacket,
  registerMeshHandler, verifiedSenderDid,
} from './sovereignMesh.js';
import { getSavedKeyRecord } from './sovereignAuth.js';
import { chooseMyNumber, phoneKey, samePhoneNumber } from './phoneNumbers.js';

const LOOKUP_TIMEOUT_MS = 6000;
// After the first node answers, wait this long for a second one (a number collision).
const LOOKUP_GRACE_MS = 1500;
const SIGNAL_TYPES = new Set(['CALL_OFFER', 'CALL_ANSWER', 'ICE_CANDIDATE', 'CALL_REJECT', 'CALL_BUSY', 'CALL_HANGUP']);

/** This node's number: the one chosen at activation or on the identity, else one derived from its key. */
export function getMyPhoneNumber() {
  const id = getLocalIdentity();
  let licensed = '';
  try { licensed = getSavedKeyRecord()?.phoneNumber || ''; } catch { /* no license yet */ }
  return chooseMyNumber({ chosen: [id?.phoneNumber, licensed], pubHex: id?.publicKey });
}

function myDid() {
  const pub = String(getLocalIdentity()?.publicKey || '').replace(/^0x/, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(pub) ? `did:nova:${pub}` : null;
}

function contactDid(contact) {
  if (/^did:nova:[0-9a-f]{64}$/.test(String(contact?.id || ''))) return contact.id;
  if (/^did:nova:[0-9a-f]{64}$/.test(String(contact?.nodeId || ''))) return contact.nodeId;
  const pub = String(contact?.publicKey || '').replace(/^0x/, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(pub) ? `did:nova:${pub}` : null;
}

// Open number lookups: phoneKey(number) -> { dids: Set, settle() }
const _lookups = new Map();

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
    this.currentCall = null; // { callId, remoteNumber, remoteHandle, remoteDid, direction, isVideo, startTime }
    this.signalChannel = null;
    this.pendingCandidates = [];
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

    // 2. Other machines: the Sovereign mesh (handlers registered below the class).
  }

  /**
   * The node that answers for `number`: a saved contact with a node key first,
   * else whoever answers a mesh lookup. Throws when nobody, or more than one
   * node, answers.
   */
  async resolveNumber(number) {
    try {
      const contacts = await db.contacts.toArray();
      const known = contacts.map(c => ({ c, did: contactDid(c) })).find(({ c, did }) => did && samePhoneNumber(c.phoneNumber, number));
      if (known) return known.did;
    } catch {
      // No contacts table yet: fall through to the lookup.
    }

    const key = phoneKey(number);
    if (key.length < 4) throw new Error('Enter a full Nova Phone number.');
    const dids = await new Promise((resolve) => {
      const found = new Set();
      let grace = null;
      const timer = setTimeout(() => finish(), LOOKUP_TIMEOUT_MS);
      const finish = () => {
        clearTimeout(timer);
        clearTimeout(grace);
        _lookups.delete(key);
        resolve(found);
      };
      _lookups.set(key, {
        add: (did) => {
          found.add(did);
          if (!grace) grace = setTimeout(finish, LOOKUP_GRACE_MS);
        },
      });
      broadcastMeshPacket('MESH_PHONE_LOOKUP', { number });
    });

    if (dids.size === 1) return [...dids][0];
    if (dids.size > 1) throw new Error('More than one node answers for this number. Call them from a saved contact instead.');
    throw new Error('No node on the mesh answered for this number. They may be offline.');
  }

  _sendSignal(packet) {
    const identity = getLocalIdentity();
    // Plain JSON: SDP and ICE objects keep their fields on the prototype, which
    // the packet signature (canonical JSON of own keys) would not cover.
    const enriched = JSON.parse(JSON.stringify({
      ...packet,
      fromNumber: getMyPhoneNumber(),
      fromHandle: identity?.handle || 'operator',
      timestamp: Date.now(),
    }));
    // An explicit toDid (even null) wins: a busy reply must not go to the current call.
    const toDid = Object.prototype.hasOwnProperty.call(enriched, 'toDid') ? enriched.toDid : (this.currentCall?.remoteDid || null);
    delete enriched.toDid;

    // 1. Other windows on this PC
    if (this.signalChannel) {
      try {
        this.signalChannel.postMessage(enriched);
      } catch {}
    }

    // 2. The node on the other end of this call, directly over the mesh
    if (toDid) {
      sendDirectMeshPacket(toDid, 'MESH_CALL_SIGNAL', { signal: enriched }).catch(() => {});
    }

    this.dispatchEvent(new CustomEvent('signal_sent', { detail: enriched }));
  }

  /** A call signal from the mesh, from the node whose key signed it. */
  _handleMeshSignal(signal, fromDid) {
    if (!signal || typeof signal !== 'object' || !SIGNAL_TYPES.has(signal.type) || !fromDid) return;
    // Mid-call, only the node this call is with may speak for it.
    if (signal.type !== 'CALL_OFFER' && this.currentCall?.remoteDid && this.currentCall.remoteDid !== fromDid) return;
    this._handleSignalPacket({ ...signal, fromDid });
  }

  // ── 2. Handling Incoming Signal Packets ────────────────────────────────────
  async _handleSignalPacket(data) {
    if (!data || !data.type) return;

    const myNumber = getMyPhoneNumber();

    // Over the mesh the packet was sent to this node's key; on the local bus the number decides.
    if (!data.fromDid && data.toNumber && !samePhoneNumber(data.toNumber, myNumber)) return;

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
            toDid: data.fromDid || null,
          });
        }
        break;

      case 'CALL_ANSWER':
        if (this.currentCall && this.currentCall.callId === data.callId && this.callState === CallState.DIALING) {
          await this._handleCallAnswer(data);
        }
        break;

      case 'ICE_CANDIDATE':
        if (this.currentCall?.callId === data.callId && data.candidate) {
          if (this.peerConnection?.remoteDescription) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.warn('[CallService] ICE candidate error:', e);
            }
          } else if (this.pendingCandidates.length < 64) {
            // Arrived before the offer was answered: applied once the remote description is set.
            this.pendingCandidates.push(data.candidate);
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

  async startCall(toNumber, isVideo = true, options = {}) {
    if (this.callState !== CallState.IDLE) {
      throw new Error('Call already in progress');
    }

    const callId = `call_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    this.currentCall = {
      callId,
      remoteNumber: toNumber,
      remoteHandle: toNumber.replace('+1-700-', ''),
      remoteDid: null,
      direction: 'outgoing',
      isVideo,
      startTime: null,
    };
    this._setCallState(CallState.DIALING);

    try {
      // 0. Find the node that answers for this number
      const remoteDid = options.did || await this.resolveNumber(toNumber);
      if (remoteDid === myDid()) throw new Error('That number belongs to this PC.');
      this.currentCall.remoteDid = remoteDid;

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
      remoteNumber: String(data.fromNumber || '').slice(0, 32),
      remoteHandle: String(data.fromHandle || 'unknown').slice(0, 64),
      remoteDid: data.fromDid || null,
      direction: 'incoming',
      isVideo: Boolean(data.isVideo),
      pendingOffer: data.sdp,
      startTime: null,
    };
    this._setCallState(CallState.RINGING);

    // Caller ID: the number and name are the caller's own claim. A saved contact
    // with this key is shown as itself; a contact's number on another key is not.
    if (data.fromDid) {
      try {
        const contacts = await db.contacts.toArray();
        const byKey = contacts.find(c => contactDid(c) === data.fromDid);
        const byNumber = contacts.find(c => samePhoneNumber(c.phoneNumber, data.fromNumber));
        if (this.currentCall?.callId === data.callId) {
          if (byKey) {
            this.currentCall.remoteHandle = byKey.handle || byKey.name || this.currentCall.remoteHandle;
            this.currentCall.verifiedContact = true;
          } else if (byNumber) {
            this.currentCall.remoteNumber = `${this.currentCall.remoteNumber} (not ${byNumber.handle || 'your contact'}'s key)`;
          }
        }
      } catch {
        // No contacts: show the claim as is.
      }
    }

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
      await this._flushCandidates();

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
      await this._flushCandidates();
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

  async _flushCandidates() {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[CallService] Queued ICE candidate error:', e);
      }
    }
  }

  _cleanup() {
    clearInterval(this.callTimer);
    this.durationSec = 0;
    this.pendingCandidates = [];

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

// ── Mesh signaling ──────────────────────────────────────────────────────────
// Handlers only ever see packets whose signature verified, so the sender DID
// below is the key that actually sent them.

registerMeshHandler('MESH_PHONE_LOOKUP', (payload, packet) => {
  const from = verifiedSenderDid(packet);
  const mine = getMyPhoneNumber();
  if (!from || from === myDid() || !samePhoneNumber(payload?.number, mine)) return;
  sendDirectMeshPacket(from, 'MESH_PHONE_HERE', { number: mine }).catch(() => {});
});

registerMeshHandler('MESH_PHONE_HERE', (payload, packet) => {
  const from = verifiedSenderDid(packet);
  const lookup = _lookups.get(phoneKey(payload?.number));
  if (from && lookup) lookup.add(from);
});

registerMeshHandler('MESH_CALL_SIGNAL', (payload, packet) => {
  callService._handleMeshSignal(payload?.signal, verifiedSenderDid(packet));
});
