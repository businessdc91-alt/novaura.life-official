import React, { useState } from 'react';
import {
  ShieldCheck, ShieldAlert, Key, Globe, CheckCircle2,
  X, AlertTriangle, Cpu, UserCheck, Lock, ExternalLink
} from 'lucide-react';
import { getLocalIdentity } from '../../services/sovereignMesh.js';
import { STANDARD_AUTH_SCOPES, authorizeApp } from '../../services/decentralizedAuthService.js';

export default function SovereignAuthModal({
  authRequest, // { domain, appName, scopes, nonce, origin }
  onAuthorize,
  onDecline,
}) {
  const [authorizing, setAuthorizing] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const identity = getLocalIdentity();

  if (!authRequest) return null;

  const { domain, appName, scopes = ['identity:read', 'node:verify'], nonce } = authRequest;

  const handleApprove = async () => {
    setAuthorizing(true);
    setErrorNotice('');
    try {
      const result = await authorizeApp({
        domain,
        appName,
        scopes,
        nonce,
      });
      if (onAuthorize) onAuthorize(result);
    } catch (err) {
      console.error('[SovereignAuthModal] Authorization error:', err);
      setErrorNotice(err.message || 'Authorization failed');
      setAuthorizing(false);
    }
  };

  const handleDeny = () => {
    if (onDecline) onDecline({ domain, nonce, error: 'User declined authorization request.' });
  };

  const cleanPub = (identity?.publicKey || '').replace(/^0x/, '');
  const shortNodeId = cleanPub ? `did:nova:${cleanPub.substring(0, 10)}...${cleanPub.substring(cleanPub.length - 6)}` : 'did:nova:local';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden flex flex-col font-sans">
        {/* Glowing Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Sign in with NovAura</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  SIWN-v1
                </span>
              </h2>
              <p className="text-xs text-slate-400">Decentralized Cryptographic Authorization</p>
            </div>
          </div>
          <button
            onClick={handleDeny}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* App Card */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            {/* The site is what the tab really shows; the name is what the page says about itself. */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-100 truncate font-mono">{domain}</div>
              {appName && appName !== domain && (
                <div className="text-xs text-slate-400 truncate">calls itself “{appName}”</div>
              )}
              <div className="text-[10px] text-slate-500">You will be signed in to {domain} only.</div>
            </div>
          </div>

          {/* Active Operator Dossier */}
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-2">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center justify-between">
              <span>Authorizing Node Identity</span>
              <span className="text-cyan-400 font-mono text-[10px]">Ed25519 Verified</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-950 text-xs shrink-0 shadow-md"
                style={{ backgroundColor: identity?.avatarColor || '#00f0ff' }}
              >
                {(identity?.handle || 'O')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-200">
                  {identity?.displayName || 'Sovereign Operator'} <span className="text-cyan-400 font-normal">@{identity?.handle || 'operator'}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate" title={identity?.publicKey}>
                  {shortNodeId}
                </div>
              </div>
            </div>
          </div>

          {/* Scopes Requested */}
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Requested Permissions
            </div>
            <div className="space-y-1.5">
              {/* Unknown scopes are not granted (authorizeApp drops them), so they aren't listed. */}
              {scopes.filter(scopeKey => STANDARD_AUTH_SCOPES[scopeKey]).map(scopeKey => {
                const def = STANDARD_AUTH_SCOPES[scopeKey] || {
                  name: scopeKey,
                  description: 'Access basic application data',
                  riskLevel: 'low',
                };
                return (
                  <div key={scopeKey} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-200 flex items-center justify-between">
                        <span>{def.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-mono ${
                          def.riskLevel === 'low' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                        }`}>
                          {def.riskLevel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{def.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">
            <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Zero passwords or cloud OAuth. Authentication is signed locally using your private hardware key.</span>
          </div>

          {errorNotice && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={handleDeny}
            disabled={authorizing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={authorizing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {authorizing ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                <span>Signing Token...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Authorize & Sign Token</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
