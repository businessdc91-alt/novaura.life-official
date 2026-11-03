import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload, Lock, Eye, EyeOff, Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  createEncryptedBackup, openEncryptedBackup, restoreArchive, restoreLegacyJson,
  readBackupHeader, backupSummary, MIN_PASSPHRASE,
} from '../../../services/backup/novaBackup.js';

const mb = (n) => `${(n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0)} MB`;

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Progress({ value, label }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[11px] text-slate-300"><Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />{label}</div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all" style={{ width: `${Math.round(value * 100)}%` }} /></div>
    </div>
  );
}

function PassField({ value, onChange, placeholder, show, onToggle, onEnter, autoFocus }) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
        placeholder={placeholder}
        autoComplete="new-password"
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 pr-9 text-xs text-white focus:outline-none focus:border-cyan-600 select-text"
      />
      <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" title={show ? 'Hide' : 'Show'}>
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function BackupPanel() {
  const [summary, setSummary] = useState(null);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [show, setShow] = useState(false);
  const [making, setMaking] = useState(null); // progress 0..1 and label
  const [made, setMade] = useState(null);
  const [makeError, setMakeError] = useState('');

  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null); // { header } or { legacy: true }
  const [restorePass, setRestorePass] = useState('');
  const [opening, setOpening] = useState(null);
  const [opened, setOpened] = useState(null); // { archive, counts, header }
  const [restoreError, setRestoreError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(false);
  const [restoreStage, setRestoreStage] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { backupSummary().then(setSummary).catch(() => {}); }, []);

  const tooShort = pass1.length < MIN_PASSPHRASE;
  const mismatch = pass2.length > 0 && pass1 !== pass2;

  const makeBackup = async () => {
    if (tooShort || pass1 !== pass2 || making) return;
    setMakeError('');
    setMade(null);
    setMaking({ value: 0, label: 'Reading your data...' });
    try {
      const { blob, fileName } = await createEncryptedBackup(pass1, {
        onProgress: ({ stage, done, total }) => setMaking(stage === 'reading'
          ? { value: (done / total) * 0.2, label: 'Reading your data...' }
          : { value: 0.2 + (done / Math.max(1, total)) * 0.8, label: `Encrypting ${mb(done)} of ${mb(total)}...` }),
      });
      saveBlob(blob, fileName);
      setMade({ fileName, size: blob.size });
      setPass1('');
      setPass2('');
    } catch (e) {
      setMakeError(e.message);
    } finally {
      setMaking(null);
    }
  };

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    setFileInfo(null);
    setOpened(null);
    setRestorePass('');
    setRestoreError('');
    if (/\.json$/i.test(f.name)) {
      setFileInfo({ legacy: true });
      return;
    }
    try {
      const { header } = await readBackupHeader(f);
      setFileInfo({ header });
    } catch (err) {
      setRestoreError(err.message);
    }
  };

  const unlock = async () => {
    if (!file || !restorePass || opening) return;
    setRestoreError('');
    setOpening({ value: 0, label: 'Checking the passphrase...' });
    try {
      const result = await openEncryptedBackup(file, restorePass, {
        onProgress: ({ done, total }) => setOpening({ value: done / total, label: `Decrypting ${mb(done)} of ${mb(total)}...` }),
      });
      setOpened(result);
    } catch (e) {
      setRestoreError(e.message);
    } finally {
      setOpening(null);
    }
  };

  const reloadSoon = () => {
    setRestored(true);
    setTimeout(() => window.location.reload(), 1800);
  };

  const applyRestore = async () => {
    if (!opened || restoring) return;
    const who = opened.archive.tables.identities?.[0]?.handle;
    if (!window.confirm(`Replace everything on this machine with the backup${who ? ` of "${who}"` : ''}? Data created here since that backup will be lost.`)) return;
    setRestoring(true);
    try {
      await restoreArchive(opened.archive, {
        onStage: (stage) => setRestoreStage(stage === 'disk' ? 'Saving a sealed copy to this disk (large libraries take a little while)...' : 'Writing your data...'),
      });
      reloadSoon();
    } catch (e) {
      setRestoreError(`Restore failed: ${e.message}`);
      setRestoring(false);
      setRestoreStage('');
    }
  };

  const applyLegacy = async () => {
    if (!file || restoring) return;
    setRestoring(true);
    try {
      await restoreLegacyJson(await file.text());
      reloadSoon();
    } catch (e) {
      setRestoreError(`Restore failed: ${e.message}`);
      setRestoring(false);
    }
  };

  const c = opened?.counts || {};
  const id = opened?.archive.tables.identities?.[0];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100 mb-1">Encrypted Backup & Restore</h2>
        <p className="text-xs text-slate-400">
          One file with everything on this node: your identity and its private key, saved AI keys, files, mail, chats, music and videos, and settings.
          It is locked with a passphrase you choose. Without the passphrase nobody can open it, including you, so write it down somewhere safe.
        </p>
      </div>

      {/* Create */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-400" /> Create a backup</h4>
            <p className="text-[11px] text-slate-400">
              {summary ? `${summary.rows.toLocaleString()} records, ${summary.files} files, ${summary.tracks} tracks, ${mb(summary.mediaBytes)} of stored media.` : 'Counting your data...'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <PassField value={pass1} onChange={setPass1} placeholder={`Passphrase (${MIN_PASSPHRASE}+ characters)`} show={show} onToggle={() => setShow(s => !s)} />
          <PassField value={pass2} onChange={setPass2} placeholder="Type it again" show={show} onToggle={() => setShow(s => !s)} onEnter={makeBackup} />
        </div>
        {pass1 && tooShort && <p className="text-[11px] text-amber-300">At least {MIN_PASSPHRASE} characters. A few unrelated words work well.</p>}
        {mismatch && <p className="text-[11px] text-amber-300">The two passphrases don't match.</p>}
        {making ? <Progress {...making} /> : (
          <button
            onClick={makeBackup}
            disabled={tooShort || pass1 !== pass2}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-lg text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" /> Create encrypted backup
          </button>
        )}
        {made && (
          <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved {made.fileName} ({mb(made.size)}) to your Downloads folder.
          </p>
        )}
        {makeError && <p className="text-[11px] text-rose-300">{makeError}</p>}
      </div>

      {/* Restore */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Restore a backup</h4>
            <p className="text-[11px] text-slate-400">Use this on a new install to bring your node back. Older .json backups can be restored too.</p>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={restoring} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700">
            <Upload className="w-3.5 h-3.5" /> Choose file
          </button>
          <input ref={fileRef} type="file" accept=".novabackup,.json" onChange={pickFile} className="hidden" />
        </div>

        {file && fileInfo?.header && !opened && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-300">
              {file.name}: made {new Date(fileInfo.header.createdAt).toLocaleString()}
              {fileInfo.header.node ? ` by "${fileInfo.header.node}"` : ''}, {mb(file.size)}.
            </p>
            <PassField value={restorePass} onChange={setRestorePass} placeholder="Backup passphrase" show={show} onToggle={() => setShow(s => !s)} onEnter={unlock} autoFocus />
            {opening ? <Progress {...opening} /> : (
              <button onClick={unlock} disabled={!restorePass} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium">
                <Lock className="w-3.5 h-3.5" /> Unlock backup
              </button>
            )}
          </div>
        )}

        {opened && !restored && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-300">
              Unlocked. It holds {id ? <>the identity <span className="text-white font-semibold">{id.handle}</span>{id.nodeId ? ` (${id.nodeId.slice(0, 22)}…)` : ''}, </> : ''}
              {(c.documents || 0).toLocaleString()} files and folders, {c.music_tracks || 0} tracks, {(c.mailbox || 0).toLocaleString()} mail messages and {(c.chat_history || 0).toLocaleString()} chat messages.
            </p>
            <div className="text-[11px] text-amber-200 bg-amber-950/40 border border-amber-900/60 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Restoring replaces the data on this machine with the backup's, then restarts the desktop.
            </div>
            <button onClick={applyRestore} disabled={restoring} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
              {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Replace this node's data
            </button>
            {restoreStage && <p className="text-[11px] text-cyan-300">{restoreStage}</p>}
          </div>
        )}

        {file && fileInfo?.legacy && !restored && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-300">{file.name} is an older, unencrypted backup. Its records are merged into this node; stored music and videos were never part of those files.</p>
            <button onClick={applyLegacy} disabled={restoring} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
              {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Merge older backup
            </button>
            <p className="text-[11px] text-amber-300">That file holds your keys in plain text. Once you've made an encrypted backup, delete it.</p>
          </div>
        )}

        {restored && <p className="text-[11px] text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Restored. Restarting the desktop...</p>}
        {restoreError && <p className="text-[11px] text-rose-300">{restoreError}</p>}
      </div>
    </div>
  );
}
