import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Mic, MicOff, Video, VideoOff, Monitor, Users, Clock, Plus, Search,
  Copy, Check, ShieldCheck, Volume2, Key, Sparkles, Hash, X
} from 'lucide-react';
import { callService, CallState, getMyPhoneNumber } from '../../services/sovereignCallService.js';
import { db } from '../../database/sovereignDatabase.js';
import { getLocalIdentity } from '../../services/sovereignMesh.js';

const DIALPAD_KEYS = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '' },
];

export default function NovaPhoneWindow() {
  const [activeTab, setActiveTab] = useState('dialer'); // 'dialer', 'contacts', 'history', 'identity'
  const [dialNumber, setDialNumber] = useState('');
  const [callStatus, setCallStatus] = useState(callService.callState);
  const [currentCallInfo, setCurrentCallInfo] = useState(callService.currentCall);
  const [callDuration, setCallDuration] = useState(0);

  // Media States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Contacts & History data from private cloud DB
  const [contacts, setContacts] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ handle: '', phoneNumber: '', vanityName: '' });
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Video Element Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const localIdentity = getLocalIdentity();

  // Load Contacts and Call Logs
  const loadDatabaseData = async () => {
    try {
      const allContacts = await db.contacts.toArray();
      setContacts(allContacts);

      const logs = await db.call_logs.orderBy('timestamp').reverse().toArray();
      setCallLogs(logs);
    } catch (err) {
      console.warn('[NovaPhone] Database load error:', err);
    }
  };

  useEffect(() => {
    loadDatabaseData();

    // Listen to callService events
    const handleStateChange = (e) => {
      setCallStatus(e.detail.state);
      setCurrentCallInfo(e.detail.call);
      if (e.detail.state === CallState.IDLE) {
        setCallDuration(0);
        setIsScreenSharing(false);
        loadDatabaseData(); // refresh logs
      }
    };

    const handleTimerTick = (e) => {
      setCallDuration(e.detail.seconds);
    };

    const handleLocalStream = (e) => {
      if (localVideoRef.current && e.detail) {
        localVideoRef.current.srcObject = e.detail;
      }
    };

    const handleRemoteStream = (e) => {
      if (remoteVideoRef.current && e.detail) {
        remoteVideoRef.current.srcObject = e.detail;
      }
    };

    callService.addEventListener('state_change', handleStateChange);
    callService.addEventListener('timer_tick', handleTimerTick);
    callService.addEventListener('local_stream', handleLocalStream);
    callService.addEventListener('remote_stream', handleRemoteStream);

    // If streams are already present in service
    if (callService.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = callService.localStream;
    }
    if (callService.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = callService.remoteStream;
    }

    return () => {
      callService.removeEventListener('state_change', handleStateChange);
      callService.removeEventListener('timer_tick', handleTimerTick);
      callService.removeEventListener('local_stream', handleLocalStream);
      callService.removeEventListener('remote_stream', handleRemoteStream);
    };
  }, []);

  // Format Duration in MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Dialpad Handlers
  const handleDigitPress = (digit) => {
    setDialNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const handleStartCall = async (targetNum, video = true) => {
    const destination = (targetNum || dialNumber).trim();
    if (!destination) return;

    try {
      await callService.startCall(destination, video);
      setIsVideoOn(video);
    } catch (err) {
      alert(`Call failed: ${err.message}`);
    }
  };

  const handleAnswerCall = async (video = true) => {
    try {
      await callService.answerCall(video);
      setIsVideoOn(video);
    } catch (err) {
      alert(`Answer failed: ${err.message}`);
    }
  };

  const handleHangup = () => {
    callService.endCall();
  };

  const handleToggleMute = () => {
    const muted = callService.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVideo = () => {
    const on = callService.toggleVideo();
    setIsVideoOn(on);
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      callService.toggleVideo();
      setIsScreenSharing(false);
    } else {
      const shared = await callService.shareScreen();
      if (shared) setIsScreenSharing(true);
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!newContact.phoneNumber.trim()) return;

    try {
      await db.contacts.put({
        id: `contact_${Date.now()}`,
        handle: newContact.handle.trim() || 'Peer Node',
        phoneNumber: newContact.phoneNumber.trim(),
        vanityName: newContact.vanityName.trim() || '',
        publicKey: '',
        createdAt: new Date().toISOString(),
      });
      setNewContact({ handle: '', phoneNumber: '', vanityName: '' });
      setShowAddContact(false);
      loadDatabaseData();
    } catch (err) {
      alert(`Could not save contact: ${err.message}`);
    }
  };

  const copyMyNumber = () => {
    const num = getMyPhoneNumber();
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const isCallActive = callStatus !== CallState.IDLE;

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* ── Left Navigation Rail ───────────────────────────────────────────── */}
      <div className="w-16 bg-slate-900/90 border-r border-slate-800 flex flex-col items-center py-4 gap-6 shrink-0 z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <PhoneCall className="w-5 h-5 text-white" />
        </div>

        <div className="flex flex-col gap-3 w-full px-2">
          <button
            onClick={() => setActiveTab('dialer')}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'dialer'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Dialpad"
          >
            <Hash className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Dial</span>
          </button>

          <button
            onClick={() => setActiveTab('contacts')}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'contacts'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Contacts"
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Contacts</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Call Logs"
          >
            <Clock className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('identity')}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'identity'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="My Line Identity"
          >
            <Key className="w-5 h-5" />
            <span className="text-[9px] font-semibold">My Line</span>
          </button>
        </div>

        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Mesh P2P Signaling Online" />
          <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Mesh</span>
        </div>
      </div>

      {/* ── Center Stage: Dialer / Contacts / History / Identity ───────────── */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isCallActive ? 'hidden lg:flex lg:w-96 lg:border-r lg:border-slate-800' : ''}`}>
        {/* Top Header */}
        <div className="h-14 px-6 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              <span>NovaPhone Sovereign Telecom</span>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                E.164 P2P
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Decentralized WebRTC Voice & Video Mesh</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyMyNumber}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors"
            >
              {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{getMyPhoneNumber() || 'No number until you create a node identity'}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Dialpad */}
        {activeTab === 'dialer' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
            {/* Number Display */}
            <div className="w-full max-w-xs mb-4">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  placeholder="+1-700-NOVA-XXXX"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-3 text-center text-lg font-mono text-white tracking-widest outline-none focus:border-emerald-500 shadow-inner"
                />
                {dialNumber && (
                  <button
                    onClick={handleBackspace}
                    className="absolute right-3 text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-center mt-1.5 text-[10px] text-slate-500 font-mono">
                Format: +1-700-NOVA-XXXX or vanity string
              </div>
            </div>

            {/* Dialpad Matrix */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
              {DIALPAD_KEYS.map((k) => (
                <button
                  key={k.digit}
                  onClick={() => handleDigitPress(k.digit)}
                  className="h-14 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 flex flex-col items-center justify-center transition-all active:scale-95 shadow-sm group"
                >
                  <span className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    {k.digit}
                  </span>
                  {k.sub && (
                    <span className="text-[9px] font-mono text-slate-500 tracking-wider">
                      {k.sub}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Call Buttons */}
            <div className="flex items-center gap-4 w-full max-w-xs justify-center">
              <button
                onClick={() => handleStartCall(dialNumber, false)}
                disabled={!dialNumber.trim()}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 rounded-xl font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all shadow-md active:scale-95"
              >
                <Phone className="w-4 h-4" />
                <span>Voice Call</span>
              </button>

              <button
                onClick={() => handleStartCall(dialNumber, true)}
                disabled={!dialNumber.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Video className="w-4 h-4" />
                <span>Video Call</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Contacts */}
        {activeTab === 'contacts' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => setShowAddContact(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            </div>

            {/* Add Contact Modal / Inline Form */}
            {showAddContact && (
              <form onSubmit={handleSaveContact} className="p-4 bg-slate-900 border border-slate-800 rounded-xl mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-emerald-400">Add Sovereign Contact</h3>
                  <button type="button" onClick={() => setShowAddContact(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newContact.handle}
                    onChange={(e) => setNewContact({ ...newContact, handle: e.target.value })}
                    placeholder="Contact Name / Handle"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                    required
                  />
                  <input
                    type="text"
                    value={newContact.phoneNumber}
                    onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })}
                    placeholder="+1-700-NOVA-XXXX"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddContact(false)}
                    className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium"
                  >
                    Save to Local Vault
                  </button>
                </div>
              </form>
            )}

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {contacts.filter(c => (c.handle || '').toLowerCase().includes(contactSearch.toLowerCase()) || (c.phoneNumber || '').includes(contactSearch)).map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                      {c.handle?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{c.handle}</div>
                      <div className="text-[11px] font-mono text-slate-400">{c.phoneNumber}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartCall(c.phoneNumber, false)}
                      className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-emerald-400 transition-colors"
                      title="Voice Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStartCall(c.phoneNumber, true)}
                      className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-emerald-400 transition-colors"
                      title="Video Call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {contacts.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No contacts found. Click "Add Contact" to store peers in your private vault.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Call Activity Logs</h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {callLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                      {log.direction === 'incoming' ? (
                        log.status === 'completed' ? <PhoneIncoming className="w-4 h-4 text-emerald-400" /> : <PhoneMissed className="w-4 h-4 text-red-400" />
                      ) : (
                        <PhoneOutgoing className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{log.peerNumber}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()} • {log.status} ({formatTime(log.durationSec || 0)})
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartCall(log.peerNumber, log.isVideo)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                    title="Redial"
                  >
                    <PhoneCall className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {callLogs.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No call logs recorded yet. All P2P call history is securely persisted on-device.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: My Line Identity */}
        {activeTab === 'identity' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4">
            <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-900/60 border border-emerald-500/30 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Sovereign Node Certificate</h3>
                  <span className="text-[10px] text-emerald-400 font-mono">Hardware-Bound & Activated</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Sovereign Phone Number:</span>
                  <span className="font-mono text-emerald-300 font-semibold">{getMyPhoneNumber() || 'No number until you create a node identity'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Ecosystem Handle:</span>
                  <span className="font-mono text-slate-200">@{localIdentity?.handle || 'operator'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Node Public Key:</span>
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">{localIdentity?.publicKey || 'No node key yet'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Persistence State:</span>
                  <span className="text-emerald-400 font-medium">Native Disk Vault Synchronized</span>
                </div>
              </div>

              <button
                onClick={copyMyNumber}
                className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
              >
                {copiedNotice ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedNotice ? 'Phone Number Copied!' : 'Copy Sovereign Phone Number'}</span>
              </button>
            </div>

            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-2">
              <h4 className="font-semibold text-slate-200">About Sovereign Telecom</h4>
              <p className="leading-relaxed">
                NovaPhone routes all audio, video, and screen sharing directly between peers using DTLS-SRTP encrypted WebRTC streams.
                Signaling is coordinated across the decentralized mesh and local network buses with zero central telecom intermediaries.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Active Call Screen (Full view when call is active) ──────────────── */}
      {isCallActive && (
        <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
          {/* Main Remote Video or Audio Avatar */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${callStatus === CallState.CONNECTED ? '' : 'hidden'}`}
            />

            {/* Fallback / Dialing / Ringing / Audio-Only Stage */}
            {callStatus !== CallState.CONNECTED && (
              <div className="flex flex-col items-center gap-4 text-center p-8 z-10">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-cyan-600 flex items-center justify-center animate-pulse shadow-2xl shadow-emerald-500/40">
                  <Phone className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-wide">
                    {currentCallInfo?.remoteNumber || dialNumber}
                  </h2>
                  <p className="text-xs font-mono text-emerald-400 mt-1 uppercase tracking-widest">
                    {callStatus === CallState.DIALING && 'Establishing Peer Connection...'}
                    {callStatus === CallState.RINGING && 'Incoming Call — Ringing...'}
                    {callStatus === CallState.ENDED && 'Call Finished'}
                  </p>
                </div>
              </div>
            )}

            {/* Local Picture-in-Picture (PIP) Camera */}
            <div className="absolute top-4 right-4 w-36 h-48 bg-slate-900 rounded-xl overflow-hidden border-2 border-emerald-500/40 shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-2 text-[9px] font-mono bg-black/60 px-1 rounded text-white">
                You
              </div>
            </div>

            {/* Call Status Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-xl z-20">
              <div className={`w-2 h-2 rounded-full ${callStatus === CallState.CONNECTED ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-xs font-mono font-semibold text-white">
                {callStatus === CallState.CONNECTED ? formatTime(callDuration) : callStatus}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentCallInfo?.remoteNumber}
              </span>
            </div>
          </div>

          {/* Bottom Floating Call Controls */}
          <div className="h-20 bg-slate-900/90 border-t border-slate-800 flex items-center justify-center gap-4 px-6 shrink-0 z-30">
            {callStatus === CallState.RINGING && currentCallInfo?.direction === 'incoming' ? (
              // Answer or Reject Controls
              <div className="flex items-center gap-6">
                <button
                  onClick={() => callService.rejectCall()}
                  className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30 transition-all active:scale-95"
                  title="Decline"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  onClick={() => handleAnswerCall(true)}
                  className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                  title="Answer with Video"
                >
                  <Video className="w-6 h-6" />
                </button>
              </div>
            ) : (
              // In-Call Controls
              <div className="flex items-center gap-4">
                <button
                  onClick={handleToggleMute}
                  className={`p-3.5 rounded-full transition-all shadow-md ${
                    isMuted
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleToggleVideo}
                  className={`p-3.5 rounded-full transition-all shadow-md ${
                    !isVideoOn
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title={isVideoOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleToggleScreenShare}
                  className={`p-3.5 rounded-full transition-all shadow-md ${
                    isScreenSharing
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
                >
                  <Monitor className="w-5 h-5" />
                </button>

                <button
                  onClick={handleHangup}
                  className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-xl shadow-red-500/40 transition-all active:scale-95 ml-4"
                  title="Hang Up"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
