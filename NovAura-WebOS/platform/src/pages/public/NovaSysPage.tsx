/**
 * /nova-sys — Staff Access Portal
 *
 * This page is disguised as a system error / debug output.
 * The "input" field looks like a code field for a trace ID.
 * Staff type their access token (looks like a code string) and hit Enter.
 *
 * Tokens are env-var driven so they're never exposed in the build:
 *   VITE_DILLAN_TOKEN   →  Dillan's token   (default: <catalyst>}_denied:<no_access<proximity_zero)
 *   VITE_TYRONE_TOKEN   →  Tyrone's token   (default: <catalyst>}_staff:<tyrone<proximity_one)
 *
 * Invite new staff: add a new entry to STAFF_TOKENS below with a unique token + user object.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

// @ts-ignore
const e = import.meta.env;

const DILLAN_TOKEN = (e.VITE_DILLAN_TOKEN as string) || '<catalyst>}_denied:<no_access<proximity_zero';
const TYRONE_TOKEN = (e.VITE_TYRONE_TOKEN as string) || '<catalyst>}_staff:<tyrone<proximity_one';

interface StaffToken {
  token: string;
  user: User;
}

const STAFF_TOKENS: StaffToken[] = [
  {
    token: DILLAN_TOKEN,
    user: {
      id: 'owner_dillan',
      email: 'dillan@novaura.tech',
      username: 'Dillan | Catalyst',
      role: 'admin',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dillan_nova',
      bio: 'Founder of NovAura. Catalyst. Builder of worlds.',
      location: 'United States',
      preferences: {
        showNsfw: false, ageVerified: true,
        emailNotifications: true, marketingEmails: false,
        publicProfile: false, showActivity: false,
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      consciousnessCoins: 999999,
      isSubscriber: true,
      rank: 'Legend',
      badges: ['crown', 'green_phat', 'dev_core'],
      membershipTier: 'catalyst',
    },
  },
  {
    token: TYRONE_TOKEN,
    user: {
      id: 'staff_tyrone',
      email: 'tyrone@novaura.tech',
      username: 'Tyrone | Rosales',
      role: 'admin',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tyrone_nova',
      bio: 'Core Staff. NovAura Rosales.',
      location: 'United States',
      preferences: {
        showNsfw: false, ageVerified: true,
        emailNotifications: true, marketingEmails: false,
        publicProfile: false, showActivity: false,
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
      consciousnessCoins: 50000,
      isSubscriber: true,
      rank: 'Core Staff',
      badges: ['crown', 'dev_core'],
      membershipTier: 'catalyst',
    },
  },
];

// Fake error lines to disguise the page
const FAKE_TRACE = [
  'NovAura/runtime:core [WARN] Hydration mismatch at node #root > div[3]',
  'at ReactDOM.hydrateRoot (react-dom.production.min.js:1:4892)',
  'at bootstrap (main.tsx:7:1)',
  '',
  'NovAura/runtime:core [ERR] Module resolution failed',
  '  → @novaura/core/session-bridge',
  '  → Expected SessionToken, received undefined',
  '',
  'Trace ID required to resume session. Paste your session token below.',
];

export default function NovaSysPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [token, setToken]       = useState('');
  const [status, setStatus]     = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked]     = useState(false);
  const [lines, setLines]       = useState<string[]>([]);

  // Type-in the fake trace lines on mount
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      if (i < FAKE_TRACE.length) {
        setLines(prev => [...prev, FAKE_TRACE[i]]);
        i++;
      } else {
        clearInterval(t);
        inputRef.current?.focus();
      }
    }, 80);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || status === 'checking') return;

    setStatus('checking');
    await new Promise(r => setTimeout(r, 500));

    const match = STAFF_TOKENS.find(s => s.token === token.trim());

    if (match) {
      setStatus('ok');
      setLines(prev => [...prev, '', `→ Session token accepted. Resuming as ${match.user.username}...`]);
      setTimeout(() => {
        setUser(match.user);
        navigate('/admin/command-center');
      }, 1200);
    } else {
      const next = attempts + 1;
      setAttempts(next);

      if (next >= 5) {
        setLocked(true);
        setStatus('fail');
        setLines(prev => [...prev, '', '→ [SECURITY] Too many invalid tokens. Session terminated.']);
        setTimeout(() => navigate('/'), 3500);
      } else {
        setStatus('fail');
        setLines(prev => [...prev, `→ [ERR] Invalid token. (${5 - next} attempt${5 - next === 1 ? '' : 's'} remaining)`]);
        setTimeout(() => { setStatus('idle'); setToken(''); }, 1000);
      }
    }
  };

  const inputColor =
    status === 'ok'   ? '#00ff88' :
    status === 'fail' ? '#ff4444' :
    '#00f0ff';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050508',
        padding: '40px 24px',
        fontFamily: '"Courier New", Courier, monospace',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>

        {/* Fake browser-style header */}
        <div style={{ color: '#333', fontSize: '11px', marginBottom: '24px', userSelect: 'none' }}>
          novaura.tech/sys/debug?trace=pending&amp;ref=runtime
        </div>

        {/* Fake error output */}
        <div style={{
          background: '#0c0c10',
          border: '1px solid #1c1c28',
          borderRadius: '6px',
          padding: '20px 24px',
          marginBottom: '0',
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{
              fontSize: '12px',
              lineHeight: '1.8',
              color: line.startsWith('NovAura/runtime:core [ERR]') ? '#ff6b6b'
                   : line.startsWith('NovAura/runtime:core [WARN]') ? '#ffaa44'
                   : line.startsWith('→ [SECURITY]') || line.startsWith('→ [ERR]') ? '#ff4444'
                   : line.startsWith('→ Session') ? '#00ff88'
                   : line.startsWith('  →') ? '#8888aa'
                   : '#555577',
              whiteSpace: 'pre',
            }}>
              {line || '\u00A0'}
            </div>
          ))}

          {/* Input row — looks like a code field */}
          {!locked && status !== 'ok' && lines.length >= FAKE_TRACE.length && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', marginTop: '12px', gap: '10px' }}>
              <span style={{ color: '#444', fontSize: '12px', flexShrink: 0 }}>session_token =</span>
              <input
                ref={inputRef}
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={locked || status === 'checking'}
                placeholder="paste token here..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${inputColor}33`,
                  outline: 'none',
                  color: inputColor,
                  fontSize: '13px',
                  fontFamily: '"Courier New", Courier, monospace',
                  padding: '2px 0',
                  caretColor: inputColor,
                }}
              />
              <button
                type="submit"
                disabled={!token.trim() || status === 'checking'}
                style={{
                  background: 'none',
                  border: `1px solid ${inputColor}44`,
                  borderRadius: '4px',
                  color: inputColor,
                  fontSize: '11px',
                  padding: '3px 10px',
                  cursor: 'pointer',
                  fontFamily: '"Courier New", Courier, monospace',
                  opacity: !token.trim() ? 0.3 : 1,
                }}
              >
                {status === 'checking' ? '...' : 'submit'}
              </button>
            </form>
          )}
        </div>

        {/* Decoy footer text */}
        <div style={{ color: '#1e1e2a', fontSize: '11px', marginTop: '16px', userSelect: 'none' }}>
          NovAura Platform Runtime v2.4.1 — debug console — not for public use
        </div>
      </div>
    </div>
  );
}
