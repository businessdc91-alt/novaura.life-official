// FactCheckPanel.jsx — Fact & World Canon Verification UI (Auto-Synced with Story Bible Codex)
import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, HelpCircle, RefreshCw, Shield, Trash2, Sparkles
} from 'lucide-react';
import { factChecker } from '../engines/FactChecker.js';
import { storyTimeline } from '../engines/StoryTimeline.js';

export default function FactCheckPanel({ activeDocContent }) {
  const [claims, setClaims] = useState([]);
  const [newCanonClaim, setNewCanonClaim] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [canonList, setCanonList] = useState([]);

  useEffect(() => {
    const syncCanon = () => setCanonList([...factChecker.customFacts]);
    syncCanon();
    window.addEventListener('novaura:canon_updated', syncCanon);
    // Through a ref: this listener is added once, and must read the chapter open now.
    // A Story Bible change can change verdicts, so those are checked again.
    const onBibleChange = () => { factChecker.verificationCache.clear(); extractClaimsRef.current(false); };
    window.addEventListener('novaura:timeline_updated', onBibleChange);
    return () => {
      window.removeEventListener('novaura:canon_updated', syncCanon);
      window.removeEventListener('novaura:timeline_updated', onBibleChange);
    };
  }, []);

  useEffect(() => {
    extractClaims();
  }, [activeDocContent]);

  const extractClaims = (keepResults = true) => {
    if (!activeDocContent) {
      setClaims([]);
      return;
    }
    const detected = factChecker.extractPotentialClaims(activeDocContent);
    if (!keepResults) { setClaims(detected); return; }
    // Sentences that did not change keep their verification result.
    setClaims(prev => detected.map(c => {
      const old = prev.find(p => p.verified && p.sentence === c.sentence);
      return old ? { ...old, id: c.id, category: c.category } : c;
    }));
  };
  const extractClaimsRef = useRef(extractClaims);
  extractClaimsRef.current = extractClaims;

  const handleVerify = async (claimItem) => {
    setVerifyingId(claimItem.id);
    const result = await factChecker.verifyClaim(
      claimItem,
      canonList.map(c => c.claim).join('\n')
    );
    setClaims(prev => prev.map(c => c.id === claimItem.id ? { ...c, ...result, verified: true } : c));
    setVerifyingId(null);
  };

  const handleVerifyAll = async () => {
    if (isVerifyingAll || claims.length === 0) return;
    setIsVerifyingAll(true);
    for (const c of claims) {
      if (!c.verified) {
        await handleVerify(c);
      }
    }
    setIsVerifyingAll(false);
  };

  const handleAddCanonRule = () => {
    if (!newCanonClaim.trim()) return;
    factChecker.addCustomCanonFact(newCanonClaim.trim());
    setCanonList([...factChecker.customFacts]);
    setNewCanonClaim('');
  };

  const handleDeleteCanonRule = (id) => {
    factChecker.deleteCustomCanonFact(id);
    setCanonList([...factChecker.customFacts]);
  };

  const codexCount = storyTimeline.characters.length + storyTimeline.settings.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#f59e0b' }}>
          <CheckCircle2 size={15} />
          <span>FACT & CANON VERIFIER</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {claims.length > 0 && (
            <button
              onClick={handleVerifyAll}
              disabled={isVerifyingAll}
              style={{ padding: '2px 7px', backgroundColor: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Sparkles size={10} />
              <span>{isVerifyingAll ? 'Checking...' : 'Verify All'}</span>
            </button>
          )}
          <button
            onClick={extractClaims}
            title="Re-extract Claims from Chapter"
            style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: '2px' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Add Canon Rule Box */}
      <div style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase' }}>Worldbuilding Canon Rules:</span>
          <span style={{ fontSize: '0.6rem', color: '#38bdf8' }}>Auto-linked to {codexCount} Codex entries</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <input
            value={newCanonClaim}
            onChange={e => setNewCanonClaim(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCanonRule(); }}
            placeholder="e.g. Gravity in Aethelgard is 0.88G; Monad drives overheat after 4 parsecs"
            style={{ flex: 1, padding: '0.25rem 0.45rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.7rem', outline: 'none' }}
          />
          <button
            onClick={handleAddCanonRule}
            disabled={!newCanonClaim.trim()}
            style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.68rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            <Shield size={11} /> + Rule
          </button>
        </div>

        {/* Persisted Canon Rules Pills */}
        {canonList.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '84px', overflowY: 'auto', marginTop: '0.15rem' }}>
            {canonList.map(rule => (
              <div key={rule.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', fontSize: '0.64rem', color: '#fde68a' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.claim}</span>
                <button
                  onClick={() => handleDeleteCanonRule(rule.id)}
                  title="Remove Canon Rule"
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Claims List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <HelpCircle size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0 }}>No factual or canon assertions detected in this passage.</p>
            <p style={{ fontSize: '0.68rem', margin: '0.2rem 0 0' }}>Add narrative text referencing Codex characters, locations, dates, or physical measurements.</p>
          </div>
        ) : (
          claims.map(claim => {
            const isVerified = claim.status === 'VERIFIED';
            const isQuestionable = claim.status === 'QUESTIONABLE';
            const statusColor = isVerified ? '#10b981' : isQuestionable ? '#ef4444' : '#f59e0b';

            return (
              <div
                key={claim.id}
                style={{
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'rgba(2,6,23,0.65)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: `3px solid ${statusColor}`,
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                    {claim.category || 'Assertion'}
                  </span>
                </div>

                <div style={{ fontSize: '0.72rem', color: '#f8fafc', fontStyle: 'italic', lineHeight: '1.3' }}>
                  "{claim.sentence}"
                </div>

                {claim.verified ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: statusColor, textTransform: 'uppercase' }}>
                        ● {claim.status}{Number.isFinite(claim.confidence) ? ` (${claim.confidence}% confidence)` : ''}
                      </span>
                    </div>
                    {claim.explanation && (
                      <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                        {claim.explanation}
                      </div>
                    )}
                    {claim.sources && claim.sources.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.1rem' }}>
                        {claim.sources.map((s, idx) => (
                          <span key={idx} style={{ fontSize: '0.6rem', padding: '1px 5px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderRadius: '3px' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => handleVerify(claim)}
                      disabled={verifyingId === claim.id}
                      style={{ padding: '2px 8px', backgroundColor: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '3px', color: '#fbbf24', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {verifyingId === claim.id ? 'Verifying...' : 'Verify Claim'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
