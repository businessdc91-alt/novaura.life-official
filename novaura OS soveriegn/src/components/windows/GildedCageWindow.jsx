// GildedCageWindow.jsx — The Gilded Cage, a steampunk mystery RPG bundled as a
// web build in public/games/gilded-cage.
//
// In the app the game is served from its own origin (the cygame protocol,
// src-tauri/src/games.rs), so it keeps its own saves but cannot reach the OS's
// storage, keys or commands. It contains mature themes, so it opens behind a
// content notice that each profile accepts once.
import React, { useEffect, useState } from 'react';
import { Crown, RotateCcw, Sparkles, Maximize2, Minimize2, BookOpen, Shield, Compass, AlertTriangle } from 'lucide-react';
import { openWindow } from '../../services/desktopActions.js';
import { db } from '../../database/sovereignDatabase.js';

const NOTICE_KEY = 'gilded_cage_mature_notice_v1';
const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

function gameUrl() {
  if (!isTauri()) return './games/gilded-cage/index.html'; // plain-browser development only
  // Tauri serves custom protocols as http://<scheme>.localhost on Windows.
  return /Windows/i.test(navigator.userAgent) ? 'http://cygame.localhost/gilded-cage/index.html' : 'cygame://localhost/gilded-cage/index.html';
}
// On its own origin the game may use that origin's storage (allow-same-origin).
// In a plain browser there is no separate origin, so it runs without it.
const SANDBOX = isTauri() ? 'allow-scripts allow-same-origin allow-forms allow-modals' : 'allow-scripts allow-forms allow-modals';

export default function GildedCageWindow() {
  const [accepted, setAccepted] = useState(null); // null = still checking
  const [declined, setDeclined] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [cinematicFill, setCinematicFill] = useState(false);

  useEffect(() => {
    db.getSetting(NOTICE_KEY, false).then(v => setAccepted(v === true)).catch(() => setAccepted(false));
  }, []);
  const accept = () => { setAccepted(true); setDeclined(false); db.setSetting(NOTICE_KEY, true).catch(() => {}); };

  if (accepted !== true) {
    return (
      <div className="h-full flex items-center justify-center bg-[#120d07] text-amber-50 p-6">
        {accepted === null ? (
          <Crown className="w-10 h-10 text-amber-400 animate-pulse" />
        ) : (
          <div className="max-w-md w-full rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#241a0e] to-[#160f07] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-base font-bold">Mature content notice</h2>
            </div>
            <p className="text-sm text-amber-100/85 leading-relaxed">
              <b>The Gilded Cage</b> includes romance, suggestive character art, intimate moments between characters and other adult themes.
              It is intended for players <b>18 and over</b>.
            </p>
            <p className="text-xs text-amber-200/60">Your answer is remembered for this profile.</p>
            {declined ? (
              <p className="text-sm text-amber-200/80">No problem. The game stays closed. You can close this window.</p>
            ) : (
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setDeclined(true)} className="px-3 py-1.5 rounded-lg text-sm bg-black/40 border border-amber-500/25 text-amber-200/80 hover:text-amber-100">
                  Not for me
                </button>
                <button type="button" onClick={accept} className="px-4 py-1.5 rounded-lg text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:brightness-110">
                  I'm 18 or older, enter
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#161009] text-amber-50 select-none overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-[#241a0e] via-[#1c140a] to-[#241a0e] border-b border-amber-500/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Crown className="w-4 h-4 text-amber-50" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-amber-200">The Gilded Cage</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">18+</span>
            </div>
            <p className="text-[11px] text-amber-200/60">Manor mystery, steampunk town, dungeon floors and a tavern card table</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openWindow('cognitive_awakenings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-violet-600 to-cyan-600 hover:brightness-110 text-white shadow-md shadow-violet-500/20 border border-violet-400/30 transition-all"
            title="Open the full edition of Cognitive Awakenings: Echoes of a Soul"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Cognitive Awakenings</span>
          </button>
          <button
            type="button"
            onClick={() => setShowGuide(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${showGuide ? 'bg-amber-500/25 border-amber-400 text-amber-100' : 'bg-black/40 border-amber-500/25 text-amber-200/80 hover:text-amber-100'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Codex</span>
          </button>
          <button
            type="button"
            onClick={() => setCinematicFill(v => !v)}
            className="p-1.5 rounded-lg bg-black/40 border border-amber-500/25 text-amber-200/80 hover:text-amber-100"
            title={cinematicFill ? 'Show framed view' : 'Expand frame'}
          >
            {cinematicFill ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setLoading(true); setFrameKey(k => k + 1); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-black/40 border border-amber-500/25 text-amber-200/80 hover:text-amber-100"
            title="Reload game"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="px-4 py-3 bg-[#1e150c] border-b border-amber-500/25 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs shrink-0">
          <div className="p-2.5 rounded-lg bg-black/30 border border-amber-500/15">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1"><Compass className="w-3.5 h-3.5" /><span>Act I: The Gilded Manor</span></div>
            <p className="text-amber-100/70 leading-relaxed">Get to know Willow, Pip, Seraphina and Lyra inside the manor, and uncover the clues that open Act II.</p>
          </div>
          <div className="p-2.5 rounded-lg bg-black/30 border border-amber-500/15">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1"><Shield className="w-3.5 h-3.5" /><span>Act II: Ironhaven</span></div>
            <p className="text-amber-100/70 leading-relaxed">Explore the steampunk districts, forge clockwork gear, take on quests and delve the dungeon floors.</p>
          </div>
          <div className="p-2.5 rounded-lg bg-black/30 border border-amber-500/15 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-violet-300 mb-1"><Sparkles className="w-3.5 h-3.5" /><span>Brass Boiler Tavern: the Echo Lattice table</span></div>
              <p className="text-amber-100/70 leading-relaxed">Patrons wager gold on Cognitive Awakenings, a card duel of AI minds. The full edition, with campaign, collection and mesh duels, opens as its own app.</p>
            </div>
            <button type="button" onClick={() => openWindow('cognitive_awakenings')} className="mt-2 py-1 px-2.5 rounded bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/40 text-violet-200 font-semibold self-start">
              Open Cognitive Awakenings →
            </button>
          </div>
        </div>
      )}

      <div className={`flex-1 relative bg-black ${cinematicFill ? '' : 'p-2 sm:p-3'}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#120d07]">
            <Crown className="w-10 h-10 text-amber-400 animate-pulse mb-3" />
            <p className="text-sm font-semibold text-amber-200">Opening The Gilded Cage…</p>
          </div>
        )}
        <iframe
          key={frameKey}
          src={gameUrl()}
          title="The Gilded Cage"
          onLoad={() => setLoading(false)}
          sandbox={SANDBOX}
          className={`w-full h-full border border-amber-500/20 ${cinematicFill ? 'rounded-none border-0' : 'rounded-xl shadow-2xl'} bg-[#1a1209]`}
        />
      </div>
    </div>
  );
}
