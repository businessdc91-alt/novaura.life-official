import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Monitor, Plus } from 'lucide-react';
import { voiceService, subscribeToVoiceRooms, type VoiceRoom, type CallParticipant } from '../../services/voiceService';
import { useAppStore } from '../../stores/appStore';
import { ref, set, serverTimestamp } from 'firebase/database';
import { rtdb, auth } from '../../services/firebase';

export default function VoiceCall() {
  const { user, setVoiceRoom, activeVoiceRoom } = useAppStore();
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [participants, setParticipants] = useState<Record<string, CallParticipant>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    const unsub = subscribeToVoiceRooms(r => setRooms(r.filter(room => room.participants)));
    return () => unsub();
  }, []);

  useEffect(() => {
    // Attach remote streams to audio elements
    Object.entries(remoteStreams).forEach(([uid, stream]) => {
      if (!audioRefs.current[uid]) {
        audioRefs.current[uid] = new Audio();
      }
      audioRefs.current[uid].srcObject = stream;
      audioRefs.current[uid].play().catch(() => {});
      audioRefs.current[uid].muted = deafened;
    });
  }, [remoteStreams, deafened]);

  const joinRoom = async (roomId: string) => {
    if (activeVoiceRoom) await leaveRoom();
    await voiceService.joinRoom(
      roomId,
      p => setParticipants(p),
      (uid, stream) => setRemoteStreams(prev => ({ ...prev, [uid]: stream }))
    );
    setVoiceRoom(roomId);
  };

  const leaveRoom = async () => {
    await voiceService.leaveRoom();
    setVoiceRoom(null);
    setParticipants({});
    setRemoteStreams({});
    Object.values(audioRefs.current).forEach(a => { a.srcObject = null; a.pause(); });
    audioRefs.current = {};
  };

  const toggleMute = async () => {
    const next = !muted;
    await voiceService.setMuted(next);
    setMuted(next);
  };

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    Object.values(audioRefs.current).forEach(a => { a.muted = next; });
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    const id = `room_${Date.now()}`;
    await set(ref(rtdb, `voice_rooms/${id}`), {
      id, name: newRoomName.trim(),
      createdBy: user?.uid,
      createdAt: Date.now(),
    });
    setCreating(false);
    setNewRoomName('');
    await joinRoom(id);
  };

  const inRoom = (roomId: string) => activeVoiceRoom === roomId;

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white">Voice Rooms</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-semibold hover:bg-neon-cyan/20 transition-all"
        >
          <Plus className="w-4 h-4" /> New Room
        </button>
      </div>

      {/* Create room modal */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-xl p-4 flex gap-3"
          >
            <input
              autoFocus
              className="flex-1 bg-void-lighter border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/40 selectable"
              placeholder="Room name..."
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createRoom(); if (e.key === 'Escape') setCreating(false); }}
            />
            <button onClick={createRoom}
              className="px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-semibold hover:bg-neon-cyan/20 transition-all">
              Create
            </button>
            <button onClick={() => setCreating(false)}
              className="px-4 py-2 rounded-lg text-white/40 hover:text-white text-sm transition-colors">
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room list */}
      <div className="grid grid-cols-2 gap-4">
        {rooms.length === 0 && (
          <div className="col-span-2 text-center py-16 text-white/20">
            No voice rooms yet. Create one to start talking.
          </div>
        )}
        {rooms.map(room => {
          const roomParticipants = Object.values(room.participants || {});
          const active = inRoom(room.id);

          return (
            <motion.div
              key={room.id}
              layout
              className={`glass rounded-xl p-5 border transition-all ${active ? 'border-neon-cyan/30 glow-cyan' : 'border-white/5'}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">{room.name}</h3>
                  <p className="text-white/40 text-xs mt-0.5">{roomParticipants.length} participant{roomParticipants.length !== 1 ? 's' : ''}</p>
                </div>
                {active ? (
                  <button onClick={leaveRoom}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all">
                    <PhoneOff className="w-3.5 h-3.5" /> Leave
                  </button>
                ) : (
                  <button onClick={() => joinRoom(room.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/20 transition-all">
                    <Phone className="w-3.5 h-3.5" /> Join
                  </button>
                )}
              </div>

              {/* Participant avatars */}
              <div className="flex flex-wrap gap-2">
                {roomParticipants.map((p: any) => (
                  <div key={p.userId} className="flex items-center gap-1.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${p.muted ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                      {(p.displayName || '?').charAt(0)}
                    </div>
                    <span className="text-white/60 text-xs">{p.displayName?.split(' ')[0]}</span>
                    {p.muted && <MicOff className="w-3 h-3 text-red-400" />}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Controls bar when in call */}
      <AnimatePresence>
        {activeVoiceRoom && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 glass rounded-2xl border border-neon-cyan/20 glow-cyan"
          >
            <span className="text-white/50 text-sm mr-2">
              {rooms.find(r => r.id === activeVoiceRoom)?.name || 'In call'}
            </span>

            <button onClick={toggleMute}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${muted ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'}`}>
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button onClick={toggleDeafen}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${deafened ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'}`}>
              {deafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button onClick={leaveRoom}
              className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-all">
              <PhoneOff className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
