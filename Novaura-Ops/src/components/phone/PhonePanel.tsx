import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, PhoneCall, PhoneMissed, Mic, MicOff,
  Volume2, VolumeX, Delete, Clock, Hash, Users,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getOrAssignExtension, subscribeExtensions, findExtension,
  dialExtension, endCall, acceptCall, subscribeMyCallLog,
  subscribeCallDeclined, subscribeCallAccepted, startRingTone,
  type PhoneExtension, type CallLogEntry,
} from '../../services/phoneService';
import { voiceService } from '../../services/voiceService';
import { useAppStore } from '../../stores/appStore';

const DIAL_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

type PhoneTab = 'dialpad' | 'directory' | 'log';

function fmtDuration(mins?: number): string {
  if (!mins) return '< 1m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function PhonePanel() {
  const { user, setVoiceRoom, activeVoiceRoom } = useAppStore();
  const [tab, setTab] = useState<PhoneTab>('dialpad');
  const [myExt, setMyExt] = useState<string>('—');
  const [extensions, setExtensions] = useState<PhoneExtension[]>([]);
  const [callLog, setCallLog] = useState<CallLogEntry[]>([]);
  const [digits, setDigits] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [callState, setCallState] = useState<'idle' | 'dialing' | 'ringing' | 'active'>('idle');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);
  const [error, setError] = useState('');
  const callStartRef = useRef<number>(0);
  const stopRingRef = useRef<(() => void) | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const unsubDeclineRef = useRef<(() => void) | null>(null);
  const unsubAcceptRef = useRef<(() => void) | null>(null);

  // Init
  useEffect(() => {
    getOrAssignExtension().then(setMyExt).catch(() => {});
    const u1 = subscribeExtensions(setExtensions);
    const u2 = subscribeMyCallLog(setCallLog);
    return () => { u1(); u2(); };
  }, []);

  // Resolve extension name as user types
  useEffect(() => {
    setResolvedName(null);
    if (digits.length >= 3) {
      findExtension(digits).then(ext => setResolvedName(ext?.displayName || null)).catch(() => {});
    }
  }, [digits]);

  // Elapsed timer while in active call
  useEffect(() => {
    if (callState !== 'active') { setCallElapsed(0); return; }
    const id = setInterval(() => setCallElapsed(Math.floor((Date.now() - callStartRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [callState]);

  // Attach remote streams to audio
  const handleStream = (uid: string, stream: MediaStream) => {
    if (!audioRefs.current[uid]) audioRefs.current[uid] = new Audio();
    audioRefs.current[uid].srcObject = stream;
    audioRefs.current[uid].play().catch(() => {});
    audioRefs.current[uid].muted = deafened;
  };

  const handleDial = async () => {
    if (!digits.trim() || callState !== 'idle') return;
    setError('');
    try {
      setCallState('dialing');
      const callId = await dialExtension(digits);
      setActiveCallId(callId);

      // Play outbound ring tone
      stopRingRef.current = startRingTone();

      // Listen for decline
      unsubDeclineRef.current = subscribeCallDeclined(callId, () => {
        stopRingRef.current?.();
        stopRingRef.current = null;
        setCallState('idle');
        setActiveCallId(null);
        setError('Call declined.');
        unsubDeclineRef.current?.();
        unsubAcceptRef.current?.();
      });

      // Listen for accept → join room
      unsubAcceptRef.current = subscribeCallAccepted(callId, async () => {
        stopRingRef.current?.();
        stopRingRef.current = null;
        unsubDeclineRef.current?.();
        setCallState('active');
        callStartRef.current = Date.now();
        await voiceService.joinRoom(callId, () => {}, handleStream);
        setVoiceRoom(callId);
      });

    } catch (e: any) {
      setCallState('idle');
      setError(e.message || 'Call failed');
    }
  };

  const handleHangUp = async () => {
    stopRingRef.current?.();
    stopRingRef.current = null;
    unsubDeclineRef.current?.();
    unsubAcceptRef.current?.();
    if (activeCallId) await endCall(activeCallId);
    await voiceService.leaveRoom();
    setVoiceRoom(null);
    setCallState('idle');
    setActiveCallId(null);
    setCallElapsed(0);
    Object.values(audioRefs.current).forEach(a => { a.srcObject = null; a.pause(); });
    audioRefs.current = {};
  };

  const handleDialKey = (k: string) => {
    if (k === '#' || k === '*') return;
    if (digits.length < 6) setDigits(p => p + k);
  };

  const handleBackspace = () => setDigits(p => p.slice(0, -1));

  const handleQuickDial = async (ext: string) => {
    setDigits(ext);
    setTab('dialpad');
  };

  const toggleMute = async () => {
    await voiceService.setMuted(!muted);
    setMuted(m => !m);
  };

  const toggleDeafen = () => {
    setDeafened(d => {
      Object.values(audioRefs.current).forEach(a => { a.muted = !d; });
      return !d;
    });
  };

  const fmtElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const TABS: { id: PhoneTab; icon: React.ComponentType<any>; label: string }[] = [
    { id: 'dialpad',   icon: Hash,       label: 'Dial Pad'  },
    { id: 'directory', icon: Users,      label: 'Directory' },
    { id: 'log',       icon: Clock,      label: 'Call Log'  },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Phone</h1>
          <p className="text-white/30 text-xs">Your extension: <span className="text-neon-cyan font-mono font-bold">{myExt}</span></p>
        </div>

        {/* Call status bar */}
        {callState !== 'idle' && (
          <div className={`flex items-center gap-3 ml-auto px-4 py-2 rounded-xl border ${
            callState === 'active'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-yellow-500/10 border-yellow-500/20'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              callState === 'active' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
            }`} />
            <span className={`text-xs font-semibold ${callState === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
              {callState === 'dialing' ? 'Calling...' : callState === 'ringing' ? 'Incoming...' : `In call ${fmtElapsed(callElapsed)}`}
            </span>
            {callState === 'active' && (
              <>
                <button onClick={toggleMute}
                  className={`p-1.5 rounded-lg transition-all ${muted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60 hover:text-white'}`}>
                  {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <button onClick={toggleDeafen}
                  className={`p-1.5 rounded-lg transition-all ${deafened ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60 hover:text-white'}`}>
                  {deafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
            <button onClick={handleHangUp}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all">
              <PhoneOff className="w-3.5 h-3.5" />
              {callState === 'active' ? 'End' : 'Cancel'}
            </button>
          </div>
        )}

        {/* Tab switcher */}
        <div className={`flex gap-1 bg-void-lighter rounded-xl p-1 ${callState !== 'idle' ? '' : 'ml-auto'}`}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tab === t.id ? 'bg-void-light text-white' : 'text-white/40 hover:text-white/60'
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── DIAL PAD ── */}
        {tab === 'dialpad' && (
          <div className="max-w-xs mx-auto flex flex-col items-center gap-6">
            {/* Display */}
            <div className="w-full glass rounded-2xl px-6 py-4 border border-white/5 text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="text-white font-mono text-3xl font-bold tracking-[0.2em] min-h-[44px] flex items-center">
                  {digits || <span className="text-white/15">— — —</span>}
                </span>
                {digits && (
                  <button onClick={handleBackspace} className="text-white/30 hover:text-white transition-colors">
                    <Delete className="w-5 h-5" />
                  </button>
                )}
              </div>
              {resolvedName && (
                <p className="text-neon-cyan text-sm mt-1 font-semibold">{resolvedName}</p>
              )}
              {digits.length >= 3 && !resolvedName && (
                <p className="text-white/20 text-xs mt-1">Extension not found</p>
              )}
            </div>

            {/* Key pad */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {DIAL_KEYS.flat().map(k => (
                <button key={k} onClick={() => handleDialKey(k)}
                  className="h-16 rounded-2xl glass border border-white/5 flex flex-col items-center justify-center gap-0.5 hover:border-white/15 hover:bg-white/5 transition-all active:scale-95">
                  <span className="text-white text-xl font-bold">{k}</span>
                  <span className="text-white/20 text-[9px] font-medium tracking-wider">
                    {k === '2' ? 'ABC' : k === '3' ? 'DEF' : k === '4' ? 'GHI' : k === '5' ? 'JKL' :
                     k === '6' ? 'MNO' : k === '7' ? 'PQRS' : k === '8' ? 'TUV' : k === '9' ? 'WXYZ' : ''}
                  </span>
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            {/* Call button */}
            <button
              onClick={handleDial}
              disabled={!digits || callState !== 'idle' || (digits.length >= 3 && !resolvedName)}
              className="w-20 h-20 rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 30px rgba(34,197,94,0.3)' }}
            >
              <Phone className="w-8 h-8 text-white" />
            </button>

            {/* Quick access to my extension */}
            <p className="text-white/20 text-xs text-center">Dial 3-digit extensions · Your ext: <span className="text-neon-cyan">{myExt}</span></p>
          </div>
        )}

        {/* ── DIRECTORY ── */}
        {tab === 'directory' && (
          <div className="space-y-2 max-w-lg mx-auto">
            <p className="text-white/30 text-xs uppercase tracking-wider font-semibold mb-4">Staff Directory</p>
            {extensions.map(ext => (
              <motion.div key={ext.uid} layout
                className="glass rounded-xl p-4 border border-white/5 flex items-center gap-4 hover:border-white/10 transition-all">
                <div className="w-10 h-10 rounded-full bg-void-lighter border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-white/60">
                  {ext.photoURL
                    ? <img src={ext.photoURL} alt="" className="w-full h-full object-cover" />
                    : ext.displayName.charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {ext.displayName}
                    {ext.isOwner && <span className="ml-2 text-[10px] text-yellow-400">Owner</span>}
                  </p>
                  <p className="text-white/30 text-xs truncate">{ext.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono text-neon-cyan font-bold text-lg">{ext.extension}</span>
                  {ext.uid !== user?.uid && callState === 'idle' && (
                    <button onClick={() => handleQuickDial(ext.extension)}
                      className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-all">
                      <PhoneCall className="w-4 h-4" />
                    </button>
                  )}
                  {ext.uid === user?.uid && (
                    <span className="text-[10px] text-white/20 italic">you</span>
                  )}
                </div>
              </motion.div>
            ))}
            {extensions.length === 0 && (
              <p className="text-white/20 text-sm text-center py-16">No extensions assigned yet — log in to get one</p>
            )}
          </div>
        )}

        {/* ── CALL LOG ── */}
        {tab === 'log' && (
          <div className="space-y-2 max-w-lg mx-auto">
            <p className="text-white/30 text-xs uppercase tracking-wider font-semibold mb-4">Recent Calls</p>
            {callLog.map(entry => {
              const isMissed = entry.status === 'declined' || entry.status === 'missed';
              const isActive = entry.status === 'active';
              const color = isMissed ? '#ef4444' : isActive ? '#22c55e' : '#00f0ff';
              const Icon = isMissed ? PhoneMissed : isActive ? PhoneCall : Phone;
              return (
                <div key={entry.id} className="glass rounded-xl p-4 border border-white/5 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: color + '15' }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">→ Ext {entry.calleeExt}</p>
                    <p className="text-white/30 text-xs">
                      {entry.startedAt ? format(entry.startedAt.toDate(), 'MMM d, h:mm a') : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold capitalize" style={{ color }}>{entry.status}</p>
                    {entry.durationMinutes != null && (
                      <p className="text-white/30 text-xs">{fmtDuration(entry.durationMinutes)}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {callLog.length === 0 && (
              <p className="text-white/20 text-sm text-center py-16">No calls yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
