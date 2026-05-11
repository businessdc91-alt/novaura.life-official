// WebRTC voice calling with Firebase Realtime Database signaling
import { ref, set, onValue, push, remove, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb, auth } from './firebase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface CallParticipant {
  userId: string;
  displayName: string;
  stream?: MediaStream;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

export interface VoiceRoom {
  id: string;
  name: string;
  participants: Record<string, CallParticipant>;
  createdAt: number;
}

type OnParticipantUpdate = (participants: Record<string, CallParticipant>) => void;
type OnStreamAdded = (userId: string, stream: MediaStream) => void;

export class VoiceCallService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private onParticipantUpdate: OnParticipantUpdate | null = null;
  private onStreamAdded: OnStreamAdded | null = null;
  private unsubscribers: (() => void)[] = [];

  get userId() { return auth.currentUser?.uid || ''; }
  get displayName() { return auth.currentUser?.displayName || auth.currentUser?.email || 'Staff'; }

  async getLocalStream(video = false): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      video: video ? { width: 1280, height: 720 } : false,
    });
    return this.localStream;
  }

  async joinRoom(
    roomId: string,
    onUpdate: OnParticipantUpdate,
    onStream: OnStreamAdded
  ) {
    this.roomId = roomId;
    this.onParticipantUpdate = onUpdate;
    this.onStreamAdded = onStream;

    if (!this.localStream) await this.getLocalStream();

    // Register presence in room
    const myRef = ref(rtdb, `voice_rooms/${roomId}/participants/${this.userId}`);
    await set(myRef, {
      userId: this.userId,
      displayName: this.displayName,
      muted: false,
      deafened: false,
      joinedAt: Date.now(),
    });
    onDisconnect(myRef).remove();

    // Watch for other participants
    const participantsRef = ref(rtdb, `voice_rooms/${roomId}/participants`);
    const unsub = onValue(participantsRef, async snap => {
      const data = snap.val() || {};
      onUpdate(data);
      // Connect to any new participants
      for (const uid of Object.keys(data)) {
        if (uid !== this.userId && !this.peerConnections.has(uid)) {
          await this.createOffer(uid, roomId);
        }
      }
    });
    this.unsubscribers.push(() => unsub());

    // Watch for incoming offers/answers/ICE
    const signalRef = ref(rtdb, `voice_rooms/${roomId}/signals/${this.userId}`);
    const sigUnsub = onValue(signalRef, async snap => {
      const signals = snap.val();
      if (!signals) return;
      for (const [fromUid, signal] of Object.entries(signals as Record<string, any>)) {
        if (signal.type === 'offer') await this.handleOffer(fromUid, signal, roomId);
        else if (signal.type === 'answer') await this.handleAnswer(fromUid, signal);
        else if (signal.type === 'ice') await this.handleIce(fromUid, signal.candidate);
      }
    });
    this.unsubscribers.push(() => sigUnsub());
  }

  private createPeer(remoteUid: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(remoteUid, pc);

    this.localStream?.getTracks().forEach(t => pc.addTrack(t, this.localStream!));

    pc.ontrack = e => {
      this.onStreamAdded?.(remoteUid, e.streams[0]);
    };

    pc.onicecandidate = async e => {
      if (e.candidate && this.roomId) {
        await push(ref(rtdb, `voice_rooms/${this.roomId}/signals/${remoteUid}/${this.userId}`), {
          type: 'ice',
          candidate: e.candidate.toJSON(),
        });
      }
    };

    return pc;
  }

  private async createOffer(remoteUid: string, roomId: string) {
    const pc = this.createPeer(remoteUid);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await set(ref(rtdb, `voice_rooms/${roomId}/signals/${remoteUid}/${this.userId}`), {
      type: 'offer',
      sdp: offer.sdp,
    });
  }

  private async handleOffer(fromUid: string, signal: any, roomId: string) {
    const pc = this.createPeer(fromUid);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await set(ref(rtdb, `voice_rooms/${roomId}/signals/${fromUid}/${this.userId}`), {
      type: 'answer',
      sdp: answer.sdp,
    });
  }

  private async handleAnswer(fromUid: string, signal: any) {
    const pc = this.peerConnections.get(fromUid);
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
  }

  private async handleIce(fromUid: string, candidate: any) {
    const pc = this.peerConnections.get(fromUid);
    if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    if (this.roomId) {
      await set(ref(rtdb, `voice_rooms/${this.roomId}/participants/${this.userId}/muted`), muted);
    }
  }

  async leaveRoom() {
    this.unsubscribers.forEach(u => u());
    this.unsubscribers = [];
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    if (this.roomId) {
      await remove(ref(rtdb, `voice_rooms/${this.roomId}/participants/${this.userId}`));
      this.roomId = null;
    }
  }
}

export const voiceService = new VoiceCallService();

export function subscribeToVoiceRooms(cb: (rooms: VoiceRoom[]) => void) {
  const roomsRef = ref(rtdb, 'voice_rooms');
  return onValue(roomsRef, snap => {
    const data = snap.val() || {};
    cb(Object.entries(data).map(([id, r]: [string, any]) => ({ id, ...r })));
  });
}
