// FactCheckPanel.jsx — Fact & World Canon Verification UI
import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, AlertCircle, HelpCircle, RefreshCw, Plus, Shield, Search
} from 'lucide-react';
import { factChecker } from '../engines/FactChecker.js';

export default function FactCheckPanel({ activeDocContent }) {
  const [claims, setClaims] = useState([]);
  const [newCanonClaim, setNewCanonClaim] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);
  const [canonList, setCanonList] = useState([]);

  useEffect(() => {
    setCanonList([...factChecker.customFacts]);
    extractClaims();
  }, [activeDocContent]);

  const extractClaims = () => {
    if (!activeDocContent) {
      setClaims([]);
      return;
    }
    const detected = factChecker.extractPotentialClaims(activeDocContent);
    setClaims(detected);
  };

  const handleVerify = async (claimItem) => {
    setVerifyingId(claimItem.id);
    const result = await factChecker.verifyClaim(claimItem, canonList.map(c => c.claim).join('\n'));
    setClaims(prev => prev.map(c => c.id === claimItem.id ? { ...c, ...result, verified: true } : c));
    setVerifyingId(null);
  };

  const handleAddCanonRule = () => {
    if (!newCanonClaim.trim()) return;
    factChecker.addCustomCanonFact(newCanonClaim.trim());
    setCanonList([...factChecker.customFacts]);
    setNewCanonClaim('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#f59e0b' }}>
          <CheckCircle2 size={15} />
          <span>FACT & CANON VERIFIER</span>
        </div>
        <button
          onClick={extractClaims}
          title="Re-extract Claims from Chapter"
          style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: '2px' }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Add Canon Rule Box */}
      <div style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Add Worldbuilding Canon Rule:</span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <input
            value={newCanonClaim}
            onChange={e => setNewCanonClaim(e.target.value)}
            placeholder="e.g. Gravity in Aethelgard is 0.88G; Monad drives overheat after 4 parsecs"
            style={{ flex: 1, padding: '0.25rem 0.45rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.7rem', outline: 'none' }}
          />
          <button
            onClick={handleAddCanonRule}
            disabled={!newCanonClaim.trim()}
            style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.68rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            <Shield size={11} /> Canon
          </button>
        </div>
      </div>

      {/* Claims List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <HelpCircle size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0 }}>No factual or physical claims detected in this passage.</p>
            <p style={{ fontSize: '0.68rem', margin: '0.2rem 0 0' }}>Add narrative text asserting locations, dates, or distances to verify.</p>
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
