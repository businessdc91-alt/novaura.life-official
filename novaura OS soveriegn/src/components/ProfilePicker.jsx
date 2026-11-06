import React, { useEffect, useRef, useState } from 'react';
import { Lock, Plus, Settings2, ChevronRight, Loader2, ArrowLeft, Trash2, KeyRound, Info } from 'lucide-react';
import logoImg from '../assets/novaura-logo.png';
import {
  MAIN_PROFILE, PROFILE_COLORS, getProfilesState, createProfile, updateProfile, setProfilePassword,
  removeProfile, enterProfile, getAutostart, setAutostart, skipTarget, initials, profileFormProblem,
} from '../services/profiles.js';

const errorText = (err) => String(err?.message || err || 'Something went wrong.');

function Avatar({ profile, size = 84 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `radial-gradient(circle at 30% 25%, ${profile.color}cc, ${profile.color}33 70%)`,
        border: `2px solid ${profile.color}`,
        boxShadow: `0 0 24px ${profile.color}55`,
      }}
    >
      {initials(profile.name)}
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {PROFILE_COLORS.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-7 h-7 rounded-full transition-transform hover:scale-110"
          style={{ background: color, outline: value === color ? '2px solid white' : 'none', outlineOffset: 2 }}
          title={color}
        />
      ))}
    </div>
  );
}

const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400';

/** New profile, or changes to one (name, color, password, removal). */
function ProfilePanel({ profile, isActive, onDone, onCancel }) {
  const editing = Boolean(profile);
  const [name, setName] = useState(profile?.name || '');
  const [color, setColor] = useState(profile?.color || PROFILE_COLORS[1]);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    const problem = profileFormProblem({ name, password: editing ? '' : password, confirm: editing ? '' : confirm });
    if (problem) throw new Error(problem);
    if (editing) await updateProfile(profile.id, name, color);
    else await createProfile(name, color, password);
    onDone();
  });

  const changePassword = (remove) => run(async () => {
    if (!remove) {
      const problem = profileFormProblem({ name: profile.name, password, confirm });
      if (problem) throw new Error(problem);
      if (!password) throw new Error('Type the new password twice.');
    }
    await setProfilePassword(profile.id, current, remove ? '' : password);
    onDone();
  });

  const remove = () => run(async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    const kept = await removeProfile(profile.id, current);
    onDone(`${profile.name} was removed. Files it saved to Documents are still in ${kept}.`);
  });

  const canRemove = editing && profile.id !== MAIN_PROFILE && !isActive;

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-slate-900/80 border border-slate-700/70 p-6 backdrop-blur-xl text-left">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>
      <h2 className="text-lg font-semibold text-white mb-4">{editing ? `Edit ${profile.name}` : 'Add a profile'}</h2>

      <label className="block text-xs text-slate-400 mb-1">Name</label>
      <input className={inputClass} value={name} maxLength={32} onChange={e => setName(e.target.value)} placeholder="Who is this profile for?" autoFocus />
      <label className="block text-xs text-slate-400 mt-4 mb-2">Color</label>
      <ColorPicker value={color} onChange={setColor} />

      {!editing && (
        <>
          <label className="block text-xs text-slate-400 mt-4 mb-1">Password (optional)</label>
          <input className={inputClass} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave empty for no password" />
          {password && <input className={`${inputClass} mt-2`} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type it again" />}
        </>
      )}

      <button onClick={save} disabled={busy} className="mt-5 w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-sm font-semibold text-white">
        {busy ? 'Saving…' : editing ? 'Save' : 'Create profile'}
      </button>

      {editing && (
        <div className="mt-6 pt-5 border-t border-slate-700/70 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><KeyRound className="w-4 h-4 text-cyan-400" /> Password</div>
          {profile.hasPassword && (
            <input className={inputClass} type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Current password" />
          )}
          <input className={inputClass} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={profile.hasPassword ? 'New password' : 'Password'} />
          {password && <input className={inputClass} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type it again" />}
          <div className="flex gap-2">
            <button onClick={() => changePassword(false)} disabled={busy} className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100">
              {profile.hasPassword ? 'Change password' : 'Set password'}
            </button>
            {profile.hasPassword && (
              <button onClick={() => changePassword(true)} disabled={busy} className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">
                Remove password
              </button>
            )}
          </div>
        </div>
      )}

      {canRemove && (
        <div className="mt-6 pt-5 border-t border-slate-700/70">
          {confirmRemove && (
            <p className="text-xs text-rose-300 mb-2">
              This deletes {profile.name}'s Sovereign data on this PC: files, chats, settings and apps. Click again to remove it.
              {profile.hasPassword ? ' Enter its current password above first.' : ''}
            </p>
          )}
          <button onClick={remove} disabled={busy} className="w-full py-2 rounded-lg border border-rose-500/50 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> {confirmRemove ? `Remove ${profile.name}` : 'Remove profile'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

/**
 * The sign-in after the title card: pick whose Sovereign to open. Each profile keeps
 * its own data; a profile can have a password; "Skip sign in" opens the last one used.
 */
export default function ProfilePicker({ onEntered }) {
  const [state, setState] = useState(null);
  const [autostart, setAutostartState] = useState(null);
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(null);
  const [opening, setOpening] = useState(null);
  const passwordRef = useRef(null);

  const refresh = () => getProfilesState().then(setState).catch(err => setError(errorText(err)));

  useEffect(() => {
    getProfilesState()
      .then((first) => {
        setState(first);
        if (first.notice) setMessage(first.notice);
      })
      .catch(err => setError(errorText(err)));
    getAutostart().then(setAutostartState).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) passwordRef.current?.focus();
  }, [selected]);

  const enter = async (profile, pw) => {
    setBusy(true);
    setError('');
    try {
      const result = await enterProfile(profile.id, pw);
      if (result?.relaunching) {
        setOpening(profile);
        return;
      }
      onEntered?.(profile);
    } catch (err) {
      setError(errorText(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const choose = (profile) => {
    setError('');
    setMessage('');
    if (profile.hasPassword) {
      setSelected(profile.id === selected ? null : profile.id);
      setPassword('');
    } else {
      enter(profile);
    }
  };

  const toggleAutostart = async () => {
    try {
      setAutostartState(await setAutostart(!(autostart?.enabled && autostart?.thisApp)));
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (opening) {
    return (
      <div className="fixed inset-0 z-[999980] bg-[#04060d] flex flex-col items-center justify-center gap-4 text-slate-300">
        <Avatar profile={opening} size={96} />
        <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> Opening {opening.name}…</div>
      </div>
    );
  }

  const profiles = state?.profiles || [];
  const skip = skipTarget(state);
  const selectedProfile = profiles.find(p => p.id === selected);
  const autostartOn = Boolean(autostart?.enabled && autostart?.thisApp);

  return (
    <div className="fixed inset-0 z-[999980] overflow-y-auto bg-[#04060d] text-slate-100">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(168,85,247,0.10), transparent 50%)' }}
      />
      <div className="relative min-h-full flex flex-col items-center justify-center px-6 py-12 text-center">
        <img src={logoImg} alt="NovAura" className="w-14 h-14 mb-4 drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]" draggable={false} />

        {panel ? (
          <ProfilePanel
            profile={panel.profile}
            isActive={panel.profile?.id === state?.active}
            onCancel={() => setPanel(null)}
            onDone={(note) => { setPanel(null); setMessage(note || ''); refresh(); }}
          />
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Who's signing in?</h1>
            <p className="mt-2 text-sm text-slate-400">Each profile keeps its own Sovereign: files, chats, settings and apps.</p>

            {message && (
              <div className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200 max-w-lg">
                <Info className="w-3.5 h-3.5 shrink-0" /> {message}
              </div>
            )}

            <div className="mt-10 flex flex-wrap justify-center gap-6 max-w-3xl">
              {profiles.map(profile => (
                <div key={profile.id} className="group relative w-32 flex flex-col items-center">
                  <button
                    onClick={() => choose(profile)}
                    disabled={busy}
                    className={`flex flex-col items-center gap-3 p-3 rounded-2xl transition-all ${selected === profile.id ? 'bg-slate-800/80 ring-1 ring-cyan-400/60' : 'hover:bg-slate-800/50'}`}
                  >
                    <Avatar profile={profile} />
                    <span className="text-sm font-medium max-w-[7.5rem] truncate">{profile.name}</span>
                  </button>
                  <div className="h-4 flex items-center gap-1 text-[10px] text-slate-500">
                    {profile.hasPassword && <Lock className="w-3 h-3" />}
                    {state?.lastUsed === profile.id && <span>Last used</span>}
                  </div>
                  <button
                    onClick={() => setPanel({ profile })}
                    className="absolute top-1 right-1 p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Edit ${profile.name}`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="w-32 flex flex-col items-center">
                <button onClick={() => setPanel({ profile: null })} className="flex flex-col items-center gap-3 p-3 rounded-2xl hover:bg-slate-800/50 transition-all">
                  <div className="w-[84px] h-[84px] rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="text-sm text-slate-400">Add profile</span>
                </button>
              </div>
            </div>

            {selectedProfile && (
              <form
                className="mt-6 flex items-center gap-2 w-full max-w-sm"
                onSubmit={(e) => { e.preventDefault(); enter(selectedProfile, password); }}
              >
                <input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={`${selectedProfile.name}'s password`}
                  className={inputClass}
                />
                <button type="submit" disabled={busy || !password} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-sm font-semibold flex items-center gap-1">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ChevronRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}
            {busy && !selectedProfile && <Loader2 className="mt-6 w-5 h-5 animate-spin text-cyan-400" />}
            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

            <div className="mt-12 w-full max-w-3xl flex flex-wrap items-center justify-between gap-4 text-xs">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none" title={autostart?.command || ''}>
                <input type="checkbox" checked={autostartOn} onChange={toggleAutostart} disabled={!autostart} className="accent-cyan-500 w-4 h-4" />
                Start Sovereign when I sign in to Windows
              </label>
              <button
                onClick={() => skip && enter(skip)}
                disabled={!skip || busy}
                className="flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                title={skip ? `Opens ${skip.name}` : 'The last profile used has a password'}
              >
                Skip sign in <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="mt-6 max-w-xl text-[11px] text-slate-500">
              A profile password keeps other people out of that profile in Sovereign. It doesn't encrypt files on this PC.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
