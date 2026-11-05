import { useEffect, useState } from 'react';
import { AtSign, Search, Loader2, ShieldCheck, Copy, Check, Crown, RefreshCw, Globe } from 'lucide-react';
import { MESH_TLDS, TLD_INFO, parseMeshName } from '../../services/web/novaNames.js';
import {
  nameStatus, requestName, listMyNames, listMyClaims, getMyPub, getOperatorState, installOperatorCert,
  removeOperatorCert, setTldPolicy, listIncomingClaims, approveClaim, denyClaim, grantName, revokeName, listAllRecords,
} from '../../services/web/novaRegistry.js';

const TABS = [['find', 'Find a name', Search], ['mine', 'My names', AtSign], ['operator', 'Operator', Crown]];
const shortKey = (hex) => (hex ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : '');
const day = (ms) => (ms ? new Date(ms).toLocaleDateString() : '—');

function openInBrowser(name) {
  const props = { url: name, openId: `${Date.now()}` };
  window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'browser', props, toggle: false } }));
  window.dispatchEvent(new CustomEvent('novaura:app_context', { detail: { appId: 'browser', props } }));
}

function useRegistryEvents(refresh) {
  useEffect(() => {
    refresh();
    const evs = ['novaura:domain_updated', 'novaura:domain_claims_updated', 'novaura:registry_operator_changed'];
    evs.forEach(e => window.addEventListener(e, refresh));
    return () => evs.forEach(e => window.removeEventListener(e, refresh));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

const STATE_TEXT = {
  available: ['Available', 'text-emerald-300'],
  yours: ['Yours', 'text-cyan-300'],
  registered: ['Taken', 'text-rose-300'],
  grace: ['Lapsed, held for its last owner', 'text-amber-300'],
  revoked: ['Revoked', 'text-rose-300'],
  invalid: ['Not a mesh name', 'text-slate-400'],
};

function FindName({ initialName }) {
  const [input, setInput] = useState(initialName || '');
  const [tld, setTld] = useState('nova');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const fullName = () => {
    const raw = input.trim().toLowerCase();
    return parseMeshName(raw) ? raw : `${raw.replace(/\.+$/, '')}.${tld}`;
  };

  const check = async (name = fullName()) => {
    setBusy(true);
    setMessage('');
    try { setStatus(await nameStatus(name)); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (initialName) {
      setInput(initialName);
      check(initialName);
    }
  }, [initialName]); // eslint-disable-line react-hooks/exhaustive-deps

  const register = async () => {
    setBusy(true);
    setMessage('');
    try {
      const claim = await requestName('register', status.parsed.registrable);
      setMessage(claim?.status === 'done'
        ? 'Registered.'
        : claim?.status === 'review'
          ? `Sent for review: ${claim.reason}`
          : claim?.status === 'rejected'
            ? `Not registered: ${claim.reason}`
            : 'Claim sent. The registry operator signs it when it is online; this PC keeps re-sending it until then. Track it under My names.');
      setStatus(await nameStatus(status.parsed.registrable, { ask: false }));
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const [label, color] = STATE_TEXT[status?.state] || [];
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); check(); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="yourname" className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white outline-none focus:border-cyan-500 select-text" />
        <select value={tld} onChange={(e) => setTld(e.target.value)} className="px-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white">
          {MESH_TLDS.map(t => <option key={t} value={t}>{TLD_INFO[t].label}</option>)}
        </select>
        <button className="px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm flex items-center gap-1">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Check</button>
      </form>

      {status && (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg text-white">{status.parsed?.registrable || input}</span>
            <span className={`text-sm font-semibold ${color}`}>{label}</span>
          </div>
          <div className="text-[12px] text-slate-400">{status.reason}</div>
          {status.record && status.state !== 'available' && (
            <div className="text-[11px] text-slate-500 font-mono">Owner {shortKey(status.record.owner)} · until {day(status.record.expiresAt)}</div>
          )}
          {status.state === 'available' && (
            <button onClick={register} disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40">
              Register {status.parsed.registrable} for a year
            </button>
          )}
          {status.state === 'yours' && (
            <button onClick={() => openInBrowser(status.parsed.registrable)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[12px] flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Open it in the browser to build its site</button>
          )}
          {message && <div className="text-[12px] text-cyan-200">{message}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {MESH_TLDS.map(t => (
          <div key={t} className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="font-mono text-cyan-300 text-sm">{TLD_INFO[t].label}</div>
            <div className="text-[11px] text-slate-400">{TLD_INFO[t].blurb}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-slate-500 leading-relaxed">
        A name is registered to your node key for a year and can be renewed, transferred or released. The registry operator signs each registration; every node checks that signature against the NovAura authority key, so nobody else can fake or take your name. Sites, search and the records themselves travel peer to peer.
      </div>
    </div>
  );
}

function MyNames() {
  const [names, setNames] = useState([]);
  const [claims, setClaims] = useState([]);
  const [transferTo, setTransferTo] = useState({});
  const [message, setMessage] = useState('');
  const refresh = async () => {
    setNames(await listMyNames());
    setClaims(await listMyClaims());
  };
  useRegistryEvents(refresh);

  const act = async (action, name, opts) => {
    setMessage('');
    try {
      const c = await requestName(action, name, opts);
      setMessage(c?.status === 'waiting' ? `${action} sent; waiting for the registry operator.` : `${name}: ${c?.reason || c?.status}`);
    } catch (e) {
      setMessage(e.message);
    }
    refresh();
  };

  return (
    <div className="space-y-5">
      {!getMyPub() && <div className="text-[12px] text-amber-300">Create your node identity in Peering first: names are registered to its key.</div>}
      {message && <div className="text-[12px] text-cyan-200">{message}</div>}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Registered to you</div>
        {!names.length && <div className="text-[12px] text-slate-500">No names yet.</div>}
        {names.map(r => (
          <div key={r.name} className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-white">{r.name}</span>
              <span className="text-[11px] text-slate-400">{r.status === 'active' ? `until ${day(r.expiresAt)}` : r.status}</span>
            </div>
            {r.status === 'active' && (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <button onClick={() => openInBrowser(r.name)} className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">Open</button>
                <button onClick={() => act('renew', r.name)} className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">Renew</button>
                <input value={transferTo[r.name] || ''} onChange={(e) => setTransferTo({ ...transferTo, [r.name]: e.target.value })} placeholder="new owner did:nova:… or key" className="flex-1 min-w-[180px] px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-[11px] select-text" />
                <button onClick={() => act('transfer', r.name, { to: transferTo[r.name] })} disabled={!transferTo[r.name]} className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40">Transfer</button>
                <button onClick={() => window.confirm(`Release ${r.name}? Anyone can register it afterwards.`) && act('release', r.name)} className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-200">Release</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Your requests</div>
        {!claims.length && <div className="text-[12px] text-slate-500">None.</div>}
        {claims.map(c => (
          <div key={c.id} className="flex items-center gap-3 text-[12px] p-2 rounded-lg border border-slate-800">
            <span className="font-mono text-slate-200 w-48 truncate">{c.name}</span>
            <span className="text-slate-400 w-20">{c.claim?.action}</span>
            <span className={`w-20 ${c.status === 'done' ? 'text-emerald-300' : c.status === 'rejected' || c.status === 'expired' ? 'text-rose-300' : 'text-amber-300'}`}>{c.status}</span>
            <span className="flex-1 text-slate-500 truncate" title={c.reason || ''}>{c.reason || (c.status === 'waiting' ? 'Re-sent until the operator answers' : '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Operator() {
  const [state, setState] = useState(null);
  const [token, setToken] = useState('');
  const [pending, setPending] = useState([]);
  const [records, setRecords] = useState([]);
  const [grant, setGrant] = useState({ name: '', owner: '' });
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const refresh = async () => {
    setState(await getOperatorState());
    setPending((await listIncomingClaims()).filter(c => c.status === 'pending'));
    setRecords(await listAllRecords());
  };
  useRegistryEvents(refresh);

  const run = async (fn) => {
    setMessage('');
    try { await fn(); } catch (e) { setMessage(e.message); }
    refresh();
  };

  if (!state) return <Loader2 className="w-5 h-5 animate-spin text-slate-500" />;
  const command = `node scripts/issue_registry_operator.mjs ${state.myPub || '<create a node identity first>'} ${MESH_TLDS.join(',')} 365`;

  return (
    <div className="space-y-5">
      {message && <div className="text-[12px] text-rose-300">{message}</div>}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className={`w-4 h-4 ${state.ok ? 'text-emerald-400' : 'text-slate-500'}`} /> Registry operator</div>
        {state.ok ? (
          <div className="text-[12px] text-slate-300">
            This node runs {state.tlds.map(t => '.' + t).join(' ')} until {day(state.cert.expires * 1000)} (certificate {state.cert.certId}, from {state.cert.kid}).
            <button onClick={() => window.confirm('Stop being the registry operator on this node?') && run(removeOperatorCert)} className="ml-3 text-rose-300 hover:text-rose-200">Remove</button>
          </div>
        ) : (
          <div className="space-y-2 text-[12px] text-slate-400">
            {state.installed && <div className="text-amber-300">{state.reason}</div>}
            <div>The operator decides who owns each name. Only the holder of the NovAura authority key can appoint one: on the machine with that key, run this in the Sovereign folder, then paste the certificate it prints below.</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-cyan-200 break-all select-text">{command}</code>
              <button onClick={() => { navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="p-2 rounded bg-slate-800 hover:bg-slate-700">{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}</button>
            </div>
            <textarea value={token} onChange={(e) => setToken(e.target.value)} placeholder="NOVAREG1.…" rows={3} className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono text-white select-text" />
            <button onClick={() => run(async () => { await installOperatorCert(token); setToken(''); })} disabled={!token.trim()} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40">Install certificate</button>
          </div>
        )}
      </div>

      {state.ok && (
        <>
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Policies</div>
            <div className="grid grid-cols-2 gap-2">
              {state.tlds.map(t => (
                <label key={t} className="flex items-center justify-between p-2 rounded-lg border border-slate-800 text-[12px]">
                  <span className="font-mono text-cyan-300">.{t}</span>
                  <select value={state.policy[t]} onChange={(e) => run(() => setTldPolicy(t, e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-1 text-white">
                    <option value="open">Open: first come, first served</option>
                    <option value="reviewed">Reviewed by you</option>
                  </select>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-slate-500">Reserved names (genesis, registry, admin, …) and names under 3 characters always wait for review, as does an 11th open name for one key.</div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Waiting for you ({pending.length})</div>
            {!pending.length && <div className="text-[12px] text-slate-500">Nothing to review.</div>}
            {pending.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-amber-500/30 bg-amber-950/20 text-[12px]">
                <span className="font-mono text-white w-44 truncate">{c.name}</span>
                <span className="font-mono text-slate-400 w-32 truncate" title={c.owner}>{shortKey(c.owner)}</span>
                <span className="flex-1 text-slate-400 truncate" title={c.reason}>{c.reason}</span>
                <button onClick={() => run(() => approveClaim(c.id))} className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white">Approve</button>
                <button onClick={() => run(() => denyClaim(c.id, window.prompt('Reason (sent to them)', 'Declined by the registry operator.') || undefined))} className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">Decline</button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Grant a name directly</div>
            <div className="flex gap-2">
              <input value={grant.name} onChange={(e) => setGrant({ ...grant, name: e.target.value })} placeholder="genesis.nova" className="w-48 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-[12px] text-white font-mono select-text" />
              <input value={grant.owner} onChange={(e) => setGrant({ ...grant, owner: e.target.value })} placeholder={`owner key (yours: ${shortKey(state.myPub)})`} className="flex-1 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-[12px] text-white font-mono select-text" />
              <button onClick={() => run(async () => { await grantName(grant.name, grant.owner || state.myPub); setGrant({ name: '', owner: '' }); })} disabled={!grant.name} className="px-3 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[12px] disabled:opacity-40">Grant</button>
            </div>
          </div>
        </>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Records this node holds ({records.length})</div>
          <button onClick={refresh} className="text-slate-500 hover:text-slate-300"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        {records.map(r => (
          <div key={r.name} className="flex items-center gap-3 text-[12px] p-1.5 border-b border-slate-900">
            <span className="font-mono text-slate-200 w-48 truncate">{r.name}</span>
            <span className="font-mono text-slate-500 w-32 truncate" title={r.owner}>{shortKey(r.owner)}</span>
            <span className="text-slate-400 w-20">{r.status}</span>
            <span className="text-slate-500 flex-1">until {day(r.expiresAt)}</span>
            {state.ok && r.status === 'active' && state.tlds.includes(parseMeshName(r.name)?.tld) && (
              <button onClick={() => { const why = window.prompt(`Revoke ${r.name}? Reason:`); if (why) run(() => revokeName(r.name, why)); }} className="text-rose-300 hover:text-rose-200">Revoke</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NovaRegistryWindow({ props: windowProps } = {}) {
  const [tab, setTab] = useState('find');
  const [request, setRequest] = useState(windowProps?.openId ? windowProps : null);
  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId === 'nova_registry' && e.detail.props?.openId) {
        setRequest(e.detail.props);
        setTab('find');
      }
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      <div className="px-5 pt-4 pb-3 border-b border-slate-800">
        <div className="text-lg font-bold text-white">Nova Registry</div>
        <div className="text-[12px] text-slate-400">Names for the mesh web: {MESH_TLDS.map(t => TLD_INFO[t].label).join(' ')}</div>
        <div className="flex gap-1 mt-3">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] ${tab === id ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'find' && <FindName initialName={request?.name} key={request?.openId || 'find'} />}
        {tab === 'mine' && <MyNames />}
        {tab === 'operator' && <Operator />}
      </div>
    </div>
  );
}
