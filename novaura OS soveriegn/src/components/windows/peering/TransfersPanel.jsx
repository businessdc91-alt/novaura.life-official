import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload, FolderOpen, X, Check, RotateCcw, Trash2, Paperclip, Lock } from 'lucide-react';
import {
  listTransfers, subscribeTransfers, sendFileToPeer, acceptTransfer, declineTransfer, cancelTransfer,
  revealTransfer, forgetTransfer,
} from '../../../services/meshTransfers.js';
import { formatBytes } from '../../../config/meshLimits.js';

const STATUS = {
  offered: ['Waiting for you', 'bg-amber-500/20 text-amber-300'],
  waiting: ['Waiting for them to accept', 'bg-amber-500/20 text-amber-300'],
  sending: ['Sending', 'bg-cyan-500/20 text-cyan-300'],
  receiving: ['Receiving', 'bg-cyan-500/20 text-cyan-300'],
  verifying: ['Checking the file', 'bg-cyan-500/20 text-cyan-300'],
  completed: ['Done', 'bg-emerald-500/20 text-emerald-300'],
  failed: ['Failed', 'bg-rose-500/20 text-rose-300'],
  declined: ['Declined', 'bg-slate-700 text-slate-300'],
  cancelled: ['Cancelled', 'bg-slate-700 text-slate-300'],
  interrupted: ['Interrupted', 'bg-amber-500/20 text-amber-300'],
};
const MOVING = new Set(['sending', 'receiving']);

function eta(rec) {
  if (!rec.rateBps || !MOVING.has(rec.status)) return '';
  const left = Math.max(0, rec.size - doneBytes(rec)) / rec.rateBps;
  if (left < 60) return `${Math.ceil(left)} s left`;
  if (left < 3600) return `${Math.ceil(left / 60)} min left`;
  return `${(left / 3600).toFixed(1)} h left`;
}

const doneBytes = (rec) => Math.min(rec.size, (rec.next || 0) * rec.chunkBytes);

/**
 * Files to and from peers, any size. Sending reads the file from disk piece by
 * piece; received files land in Documents\NovauraSovereign\Received.
 */
export default function TransfersPanel({ peers = [] }) {
  const [items, setItems] = useState([]);
  const [peerId, setPeerId] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const resumeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = () => listTransfers().then(list => { if (alive) setItems(list); });
    load();
    const off = subscribeTransfers((rec) => {
      if (!alive) return;
      setItems(prev => {
        if (rec.removed) return prev.filter(r => r.id !== rec.id);
        const i = prev.findIndex(r => r.id === rec.id);
        if (i < 0) return [rec, ...prev];
        const next = prev.slice();
        next[i] = rec;
        return next;
      });
    });
    return () => { alive = false; off(); };
  }, []);

  const target = peerId || peers[0]?.id || '';

  const pick = (resumeRec = null) => {
    resumeRef.current = resumeRec;
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const resume = resumeRef.current;
    resumeRef.current = null;
    if (!file) return;
    setNotice('');
    try {
      if (resume) {
        await sendFileToPeer(resume.peerId, file, { resumeId: resume.id });
      } else {
        if (!target) throw new Error('No peer is connected. Connect to someone first.');
        await sendFileToPeer(target, file);
      }
    } catch (err) {
      setNotice(err.message || String(err));
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Send a file</h3>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Any size. Encrypted end to end; relays only carry scrambled pieces. The other person accepts it first.
            </p>
          </div>
          <button
            onClick={() => revealTransfer(null).catch(err => setNotice(String(err)))}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Received folder
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={target}
            onChange={e => setPeerId(e.target.value)}
            className="flex-1 min-w-[12rem] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
          >
            {peers.length === 0 && <option value="">No peers connected</option>}
            {peers.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
          </select>
          <button
            onClick={() => pick()}
            disabled={!target}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Paperclip className="w-3.5 h-3.5" /> Choose file…
          </button>
        </div>
        {notice && <p className="text-xs text-rose-300">{notice}</p>}
        <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-xs text-slate-500">
          No transfers yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(rec => {
            const [label, tone] = STATUS[rec.status] || [rec.status, 'bg-slate-700 text-slate-300'];
            const incoming = rec.direction === 'in';
            const pct = rec.size ? Math.round((doneBytes(rec) / rec.size) * 100) : (rec.status === 'completed' ? 100 : 0);
            const showBar = ['sending', 'receiving', 'verifying', 'interrupted'].includes(rec.status);
            return (
              <div key={rec.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${incoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                      {incoming ? <Download className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate" title={rec.fileName}>{rec.fileName}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {formatBytes(rec.size)} • {incoming ? 'from' : 'to'} {rec.peerName || 'peer'}
                        {MOVING.has(rec.status) && rec.rateBps ? ` • ${formatBytes(rec.rateBps)}/s • ${eta(rec)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tone}`}>{label}</span>
                    {incoming && rec.status === 'offered' && (
                      <>
                        <button onClick={() => acceptTransfer(rec.id)} className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1 cursor-pointer">
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button onClick={() => declineTransfer(rec.id)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer">Decline</button>
                      </>
                    )}
                    {incoming && rec.status === 'completed' && rec.path && (
                      <button onClick={() => revealTransfer(rec).catch(err => setNotice(String(err)))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer">
                        <FolderOpen className="w-3.5 h-3.5" /> Show
                      </button>
                    )}
                    {!incoming && rec.status === 'interrupted' && (
                      <button onClick={() => pick(rec)} className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1 cursor-pointer" title="Choose the same file to continue where it stopped">
                        <RotateCcw className="w-3.5 h-3.5" /> Resume…
                      </button>
                    )}
                    {['waiting', 'sending', 'receiving', 'verifying', 'interrupted'].includes(rec.status) && (
                      <button onClick={() => cancelTransfer(rec.id)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/30 text-slate-300 cursor-pointer" title="Cancel">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {['completed', 'failed', 'declined', 'cancelled'].includes(rec.status) && (
                      <button onClick={() => forgetTransfer(rec.id)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer" title={incoming ? 'Remove from the list (the file stays on disk)' : 'Remove from the list'}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {showBar && (
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {rec.error && <div className={rec.status === 'failed' ? 'text-rose-300' : 'text-amber-300'}>{rec.error}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
