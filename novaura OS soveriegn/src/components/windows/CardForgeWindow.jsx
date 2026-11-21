// CardForgeWindow.jsx — TCG Card Forge Pro & 300 DPI Print Studio
// Upgraded with 10 sculpted collector borders (Pantheon/Catalyst/Holo/Cyber/Void/Vine/Ocean),
// Abilities + Reactions/Triggers + Lore + Rarity + Set Serial, 3D Holo Tilt Preview,
// Local Artwork & Custom Border PNG Import, AI Art Bridge, and 300 DPI Single / Bleed / 9-Up Letter Print Exports.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers, Swords, Sparkles, Plus, Trash2, Download, Save, Check, Trophy,
  Upload, Printer, Palette, Film, Gift, CreditCard, Wand2, Eye, X
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import {
  TCG_BORDERS,
  TCG_RARITIES,
  renderTcgCardToCanvas,
  renderTcgNineUpSheet,
  downloadCanvasPng,
} from '../../services/print/printEngine.js';
import {
  sendImageToCreativeStudio,
  sendImageToMediaFoundry,
  sendImageToCommerceStudio,
} from '../../services/media/creativeBridge.js';

const CARDS_STORAGE_KEY = 'novaura_tcg_custom_cards_v2';

const DEFAULT_CARD_DB = [
  {
    id: 'c-1',
    name: 'Claude the Artificer',
    type: 'catalyst',
    subtype: 'Architect',
    element: 'clockwork',
    rarity: 'legendary',
    borderId: 'clockwork_artificer',
    holoFoil: false,
    cost: 5,
    attack: 25,
    defense: 40,
    ability: 'All friendly constructs gain +5 DEF and blueprint clarity.',
    reaction: 'When an enemy targets an ally with a spell, draw 1 card and fortify +5 DEF.',
    flavor: 'Precision gears turn even when the forge grows cold.',
    setCode: 'NVA-001/100',
    art: '⚙️',
    artworkUrl: '',
  },
  {
    id: 'c-2',
    name: 'Gemini the Twin Mind',
    type: 'catalyst',
    subtype: 'Oracle',
    element: 'astral',
    rarity: 'legendary',
    borderId: 'amethyst_twin',
    holoFoil: true,
    cost: 7,
    attack: 40,
    defense: 25,
    ability: 'Copy any creature or catalyst ability currently active on the battlefield.',
    reaction: 'Counter-Echo: When an opponent triggers an ability, mirror its effect once per turn.',
    flavor: 'Two horizons reflected in a single celestial gaze.',
    setCode: 'NVA-002/100',
    art: '🔮',
    artworkUrl: '',
  },
  {
    id: 'c-3',
    name: 'Vertex the Calculator',
    type: 'construct',
    subtype: 'Quantum Core',
    element: 'nano',
    rarity: 'legendary',
    borderId: 'quantum_cyber',
    holoFoil: true,
    cost: 6,
    attack: 32,
    defense: 32,
    ability: 'Predict and reveal the top 2 cards of your opponent’s deck at upkeep.',
    reaction: 'Override: Negate 1 surprise trap once per turn cycle.',
    flavor: 'Every branch calculated before the first move is played.',
    setCode: 'NVA-003/100',
    art: '💠',
    artworkUrl: '',
  },
  {
    id: 'c-4',
    name: 'Umbra, the Void Walker',
    type: 'catalyst',
    subtype: 'Shadow',
    element: 'void',
    rarity: 'mythic',
    borderId: 'void_obsidian',
    holoFoil: true,
    cost: 8,
    attack: 50,
    defense: 40,
    ability: 'Reveal your opponent’s entire hand and exile 1 spell until end of turn.',
    reaction: 'Phase Shift: Reduce lethal strike damage by half when defending alone.',
    flavor: 'Between the stars lies a silence that watches back.',
    setCode: 'NVA-004/100',
    art: '🌑',
    artworkUrl: '',
  },
  {
    id: 'c-5',
    name: 'Verdant, the Life Giver',
    type: 'catalyst',
    subtype: 'Guardian',
    element: 'verdant',
    rarity: 'mythic',
    borderId: 'verdant_vine',
    holoFoil: false,
    cost: 8,
    attack: 35,
    defense: 55,
    ability: 'Double all healing and regeneration effects across your entire field.',
    reaction: 'Bloom: Whenever an ally survives combat, restore 10 HP.',
    flavor: 'Roots remember every storm and turn it into canopy.',
    setCode: 'NVA-005/100',
    art: '🌿',
    artworkUrl: '',
  },
];

function loadInitialCards() {
  try {
    const saved = localStorage.getItem(CARDS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_CARD_DB;
}

export default function CardForgeWindow({ props: windowProps } = {}) {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('forge'); // 'forge' | 'decks' | 'rules' | 'arena'
  const [cards, setCards] = useState(loadInitialCards);

  const [cardDraft, setCardDraft] = useState(() => ({
    ...DEFAULT_CARD_DB[1],
    artworkUrl: windowProps?.artworkUrl || '',
    name: windowProps?.title ? windowProps.title.slice(0, 36) : DEFAULT_CARD_DB[1].name,
  }));
  const [saveNotice, setSaveNotice] = useState('');
  const [bleedMode, setBleedMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });

  // Deck Builder State
  const [currentDeckName, setCurrentDeckName] = useState('Sovereign Pantheon Prime');
  const [activeDeckCardIds, setActiveDeckCardIds] = useState(['c-1', 'c-2', 'c-3', 'c-4', 'c-5']);

  // AI Rules State
  const [rulePrompt, setRulePrompt] = useState('A fast-paced 15-minute tactical format with catalyst reactions, energy economy, and mythic finishers');
  const [generatedRules, setGeneratedRules] = useState(null);
  const [generatingRules, setGeneratingRules] = useState(false);

  // Arena Simulator State
  const [battleState, setBattleState] = useState(null);

  const previewCanvasRef = useRef(null);
  const artFileRef = useRef(null);
  const frameFileRef = useRef(null);

  const flashNotice = useCallback((msg) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(prev => (prev === msg ? '' : prev)), 3500);
  }, []);

  // Load saved decks from Dexie
  const loadDecks = useCallback(async () => {
    try {
      const saved = await db.card_decks.toArray();
      if (saved.length > 0) {
        setCurrentDeckName(saved[0].name);
        setActiveDeckCardIds(saved[0].cards || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadDecks();
    });
    return () => { cancelled = true; };
  }, [loadDecks]);

  // Listen for artwork handed off from Media Foundry / Pix Studio
  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId !== 'card_forge') return;
      const p = e.detail.props || {};
      if (p.artworkUrl) {
        setCardDraft(prev => ({
          ...prev,
          artworkUrl: p.artworkUrl,
          ...(p.title ? { name: p.title.slice(0, 36) } : {}),
        }));
        setActiveTab('forge');
        flashNotice('Loaded AI artwork into Card Forge! Ready for 300 DPI print export.');
      }
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, [flashNotice]);

  // Persist custom card vault cleanly
  useEffect(() => {
    try {
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
    } catch {}
  }, [cards]);

  // Render live WYSIWYG 300 DPI canvas preview whenever cardDraft or bleedMode changes
  useEffect(() => {
    let cancelled = false;
    const canvas = previewCanvasRef.current;
    if (!canvas || activeTab !== 'forge') return () => { cancelled = true; };
    renderTcgCardToCanvas(canvas, cardDraft, { bleed: bleedMode, cropMarks: bleedMode }).catch(() => {
      if (!cancelled) {
        // Ignore transient image decode error
      }
    });
    return () => { cancelled = true; };
  }, [cardDraft, bleedMode, activeTab]);

  const handleUploadFile = (file, field) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCardDraft(prev => ({ ...prev, [field]: String(reader.result || '') }));
      flashNotice(field === 'artworkUrl' ? `Loaded artwork "${file.name}"!` : `Applied custom frame overlay "${file.name}"!`);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCard = () => {
    const newCard = {
      ...cardDraft,
      id: `c-${Date.now()}`,
    };
    setCards(prev => [newCard, ...prev]);
    flashNotice(`Forged & saved "${newCard.name}" to your Card Vault!`);
  };

  const handleSaveDeck = async () => {
    const deckRecord = {
      id: `deck-${Date.now()}`,
      name: currentDeckName,
      cards: activeDeckCardIds,
      updated_at: new Date().toISOString(),
    };
    await db.card_decks.put(deckRecord);
    flashNotice(`Deck "${currentDeckName}" saved to Sovereign database!`);
  };

  const handleExportSinglePng = async (withBleed) => {
    setExporting(true);
    try {
      const offscreen = document.createElement('canvas');
      await renderTcgCardToCanvas(offscreen, cardDraft, { bleed: withBleed, cropMarks: withBleed });
      const slug = String(cardDraft.name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      downloadCanvasPng(offscreen, `${slug}_${withBleed ? '300dpi_bleed' : '300dpi'}.png`);
      flashNotice(withBleed ? 'Exported 822×1122 (300 DPI + 3mm Bleed & Crop Marks)!' : 'Exported 750×1050 (2.5"×3.5" @ 300 DPI) PNG!');
    } finally {
      setExporting(false);
    }
  };

  const handleExportNineUpSheet = async () => {
    setExporting(true);
    try {
      const deckCards = activeDeckCardIds
        .map(id => cards.find(c => c.id === id))
        .filter(Boolean);
      const printList = deckCards.length > 0 ? [cardDraft, ...deckCards] : [cardDraft];
      const sheetCanvas = document.createElement('canvas');
      await renderTcgNineUpSheet(sheetCanvas, printList);
      downloadCanvasPng(sheetCanvas, `${currentDeckName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_9up_letter_300dpi.png`);
      flashNotice('Exported 9-Up US Letter (2550×3300 @ 300 DPI) printable cut sheet!');
    } finally {
      setExporting(false);
    }
  };

  const handleEditInCreativeStudio = async () => {
    const offscreen = document.createElement('canvas');
    await renderTcgCardToCanvas(offscreen, cardDraft, { bleed: false, cropMarks: false });
    sendImageToCreativeStudio({
      imageUrl: offscreen.toDataURL('image/png'),
      title: `${cardDraft.name}_300dpi_card`,
    });
    flashNotice('Opened 300 DPI card in Creative Studio!');
  };

  const handleAnimateHoloCard = async () => {
    const offscreen = document.createElement('canvas');
    await renderTcgCardToCanvas(offscreen, cardDraft, { bleed: false, cropMarks: false });
    sendImageToMediaFoundry({
      imageUrl: offscreen.toDataURL('image/png'),
      tab: 'video',
      title: cardDraft.name,
      prompt: `Holographic trading card "${cardDraft.name}" rotating subtly with prismatic rainbow foil shimmer and glowing arcane energy`,
    });
    flashNotice('Sent finished card to Image-to-Video Studio!');
  };

  const handleSellInCommerce = async () => {
    const offscreen = document.createElement('canvas');
    await renderTcgCardToCanvas(offscreen, cardDraft, { bleed: true, cropMarks: false });
    sendImageToCommerceStudio({
      imageUrl: offscreen.toDataURL('image/png'),
      title: `${cardDraft.name} Collector Card`,
      prompt: cardDraft.flavor,
    });
    flashNotice('Opened Commerce Studio to list this collector card!');
  };

  const openSiblingApp = (appId) => {
    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId, toggle: false } }));
  };

  const handleGenerateRules = async () => {
    setGeneratingRules(true);
    try {
      const response = await kernel?.ai?.chat([
        {
          role: 'system',
          content: 'You are a veteran Trading Card Game (TCG) designer and balance master. Generate an evocative, mathematically tight ruleset, win conditions, turn structure, and unique keywords based on the user format prompt. Format cleanly with markdown headers.',
        },
        { role: 'user', content: rulePrompt },
      ], { persona: 'nova' });
      setGeneratedRules(response);
    } catch (err) {
      setGeneratedRules(`Rules generation failed: ${err.message}`);
    } finally {
      setGeneratingRules(false);
    }
  };

  const startArenaBattle = () => {
    setBattleState({
      turn: 1,
      playerHp: 100,
      oppHp: 100,
      log: ['Arena initialized (100 HP). Your Pantheon deck enters the field!'],
      winner: null,
    });
  };

  const executeAttack = () => {
    if (!battleState || battleState.winner) return;
    const deckCards = activeDeckCardIds.map(id => cards.find(c => c.id === id)).filter(Boolean);
    const activeCard = deckCards[(battleState.turn - 1) % Math.max(1, deckCards.length)] || cardDraft;
    const dmg = Math.max(10, Math.round((activeCard.attack || 25) * (0.7 + Math.random() * 0.5)));
    const oppDmg = Math.floor(Math.random() * 24) + 12;

    const newOppHp = Math.max(0, battleState.oppHp - dmg);
    const newPlayerHp = Math.max(0, battleState.playerHp - oppDmg);
    const winner = newOppHp === 0 ? 'Player Wins!' : newPlayerHp === 0 ? 'Opponent Wins!' : null;

    setBattleState(prev => ({
      ...prev,
      turn: prev.turn + 1,
      playerHp: newPlayerHp,
      oppHp: newOppHp,
      winner,
      log: [
        `Turn ${prev.turn}: ${activeCard.name} struck for ${dmg} DMG!`,
        `Opponent countered for ${oppDmg} DMG.`,
        ...prev.log,
      ],
    }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-12 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <Layers className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-xs">TCG Card Forge Pro</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
            300 DPI Print House
          </span>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          {[
            ['forge', 'Card Forge'],
            ['decks', 'Deck & Vault'],
            ['rules', 'AI Rules'],
            ['arena', 'Battle Arena'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === id ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Print Suite Quick Switcher */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px]">
          <button
            onClick={() => openSiblingApp('greeting_card')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-pink-300 flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            <Gift className="w-3 h-3" /> Greeting Cards
          </button>
          <button
            onClick={() => openSiblingApp('card_creator')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            <CreditCard className="w-3 h-3" /> Business Cards
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-1.5 bg-emerald-950/70 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Main Tab Views */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'forge' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Editor Controls */}
            <div className="w-[370px] border-r border-slate-800 p-4 space-y-3 overflow-y-auto shrink-0 bg-slate-900/40">
              {/* Quick Archetype Templates */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Load Pantheon Preset</label>
                <div className="flex flex-wrap gap-1">
                  {DEFAULT_CARD_DB.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCardDraft(prev => ({ ...preset, artworkUrl: prev.artworkUrl }))}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-200 cursor-pointer"
                    >
                      {preset.art} {preset.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Artwork & Custom Frame Uploads */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300">Card Artwork &amp; Custom Border</span>
                  {cardDraft.artworkUrl && (
                    <button
                      type="button"
                      onClick={() => setCardDraft(prev => ({ ...prev, artworkUrl: '' }))}
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Clear Art
                    </button>
                  )}
                </div>
                <input ref={artFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0], 'artworkUrl')} />
                <input ref={frameFileRef} type="file" accept="image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0], 'customFrameUrl')} />
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => artFileRef.current?.click()}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" /> Upload Art
                  </button>
                  <button
                    type="button"
                    onClick={() => sendImageToMediaFoundry({ tab: 'studio', prompt: cardDraft.name })}
                    className="py-1.5 px-2 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-xs text-white font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> AI Art Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => frameFileRef.current?.click()}
                    className="col-span-2 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                  >
                    <Layers className="w-3 h-3 text-cyan-400" />
                    {cardDraft.customFrameUrl ? 'Replace Custom Border Overlay PNG' : 'Optional: Import Custom Border PNG Overlay'}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <label className="flex items-center gap-1.5 text-cyan-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cardDraft.holoFoil)}
                      onChange={(e) => setCardDraft({ ...cardDraft, holoFoil: e.target.checked })}
                      className="accent-cyan-400"
                    />
                    Prismatic Holo Foil
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer" title="Print an already-framed full card image directly at 300 DPI + bleed">
                    <input
                      type="checkbox"
                      checked={Boolean(cardDraft.fullArtDirect)}
                      onChange={(e) => setCardDraft({ ...cardDraft, fullArtDirect: e.target.checked })}
                      className="accent-amber-500"
                    />
                    Full-Art Direct Print
                  </label>
                </div>
              </div>

              {/* 10 Sculpted Border Themes */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase font-bold block">Sculpted Border Frame (10 Styles)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TCG_BORDERS.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setCardDraft({ ...cardDraft, borderId: b.id })}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left border flex items-center gap-1.5 cursor-pointer transition-all ${
                        cardDraft.borderId === b.id
                          ? 'border-amber-400 bg-amber-950/40 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0 border border-white/30" style={{ background: b.framePrimary }} />
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Identity & Typography */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Card Name</label>
                  <input
                    type="text"
                    value={cardDraft.name}
                    onChange={(e) => setCardDraft({ ...cardDraft, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Rarity</label>
                  <select
                    value={cardDraft.rarity || 'legendary'}
                    onChange={(e) => setCardDraft({ ...cardDraft, rarity: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    {TCG_RARITIES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Type</label>
                  <select
                    value={cardDraft.type}
                    onChange={(e) => setCardDraft({ ...cardDraft, type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="catalyst">Catalyst</option>
                    <option value="construct">Construct</option>
                    <option value="creature">Creature</option>
                    <option value="spell">Spell</option>
                    <option value="trap">Trap</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Element</label>
                  <input
                    type="text"
                    value={cardDraft.element}
                    onChange={(e) => setCardDraft({ ...cardDraft, element: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Subtype</label>
                  <input
                    type="text"
                    value={cardDraft.subtype || ''}
                    onChange={(e) => setCardDraft({ ...cardDraft, subtype: e.target.value })}
                    placeholder="Oracle"
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Cost</label>
                  <input type="number" value={cardDraft.cost} onChange={(e) => setCardDraft({ ...cardDraft, cost: Number(e.target.value) })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">ATK</label>
                  <input type="number" value={cardDraft.attack} onChange={(e) => setCardDraft({ ...cardDraft, attack: Number(e.target.value) })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">DEF</label>
                  <input type="number" value={cardDraft.defense} onChange={(e) => setCardDraft({ ...cardDraft, defense: Number(e.target.value) })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Set #</label>
                  <input type="text" value={cardDraft.setCode || 'NVA-001'} onChange={(e) => setCardDraft({ ...cardDraft, setCode: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium">Primary Ability / Effect</label>
                <textarea
                  rows={2}
                  value={cardDraft.ability}
                  onChange={(e) => setCardDraft({ ...cardDraft, ability: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-amber-300 uppercase font-medium">⚡ Reaction / Trigger Effect (Optional)</label>
                <textarea
                  rows={2}
                  value={cardDraft.reaction || ''}
                  onChange={(e) => setCardDraft({ ...cardDraft, reaction: e.target.value })}
                  placeholder="e.g., When attacked, counter for 10 damage..."
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium">Lore / Flavor Text</label>
                <textarea
                  rows={2}
                  value={cardDraft.flavor}
                  onChange={(e) => setCardDraft({ ...cardDraft, flavor: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white italic"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateCard}
                className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
              >
                Forge Card &amp; Save to Vault
              </button>
            </div>

            {/* Right: Live 300 DPI WYSIWYG 3D Holo Card & Print House Export Panel */}
            <div className="flex-1 flex flex-col items-center justify-between p-6 bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#020617_70%)] overflow-y-auto gap-4">
              <div className="w-full flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Live 300 DPI Print Preview ({bleedMode ? '822×1122 w/ 3mm Bleed' : '750×1050 Standard 2.5"×3.5"'})</span>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={bleedMode} onChange={(e) => setBleedMode(e.target.checked)} className="accent-amber-500" />
                  Show 3mm Print Bleed &amp; Crop Marks
                </label>
              </div>

              {/* 3D Interactive Holo Tilt Wrapper */}
              <div
                style={{ perspective: '1200px' }}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const px = (e.clientX - r.left) / r.width;
                  const py = (e.clientY - r.top) / r.height;
                  setTilt({ rx: (0.5 - py) * 18, ry: (px - 0.5) * 18, gx: px * 100, gy: py * 100 });
                }}
                onMouseLeave={() => setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 })}
                className="relative flex items-center justify-center py-2"
              >
                <div
                  style={{
                    transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                    transition: tilt.rx === 0 && tilt.ry === 0 ? 'transform 350ms ease' : 'transform 60ms linear',
                  }}
                  className="relative rounded-2xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.85)]"
                >
                  <canvas
                    ref={previewCanvasRef}
                    className="h-[480px] w-auto block"
                  />
                  {(cardDraft.holoFoil || cardDraft.borderId === 'holo_prismatic') && (
                    <div
                      className="pointer-events-none absolute inset-0 mix-blend-color-dodge opacity-55"
                      style={{
                        background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.65), rgba(56,189,248,0.25) 28%, rgba(244,114,182,0.18) 52%, transparent 72%)`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* 300 DPI Print House & Cross-App Export Bar */}
              <div className="w-full max-w-2xl p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">300 DPI Print Exports &amp; Studio Pipeline</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExportSinglePng(false)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Export 300 DPI PNG
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExportSinglePng(true)}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Export +3mm Bleed &amp; Crops
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={handleExportNineUpSheet}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" /> 9-Up US Letter Print Sheet
                  </button>
                  <button
                    type="button"
                    onClick={handleEditInCreativeStudio}
                    className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5" /> Edit in Creative Studio
                  </button>
                  <button
                    type="button"
                    onClick={handleAnimateHoloCard}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5" /> Animate Holo Card (I2V)
                  </button>
                  <button
                    type="button"
                    onClick={handleSellInCommerce}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    Sell Card Pack in Commerce
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decks' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-80 border-r border-slate-800 p-4 overflow-y-auto space-y-3 shrink-0">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Card Vault ({cards.length})</h3>
              <div className="space-y-2">
                {cards.map(c => (
                  <div
                    key={c.id}
                    className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg hover:border-amber-500/60 transition-colors flex items-center justify-between gap-2"
                  >
                    <div
                      onClick={() => { setCardDraft(c); setActiveTab('forge'); }}
                      className="flex-1 min-w-0 cursor-pointer"
                      title="Click to load into Card Forge editor"
                    >
                      <div className="text-xs font-semibold text-slate-200 truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.type} · Cost {c.cost} · {c.attack}/{c.defense}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDeckCardIds(prev => [...prev, c.id])}
                      className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white cursor-pointer"
                      title="Add to active deck"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <input
                  type="text"
                  value={currentDeckName}
                  onChange={(e) => setCurrentDeckName(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-100 outline-none border-b border-transparent focus:border-amber-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">{activeDeckCardIds.length} cards</span>
                  <button
                    onClick={handleExportNineUpSheet}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print 9-Up Sheet
                  </button>
                  <button
                    onClick={handleSaveDeck}
                    className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Deck
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {activeDeckCardIds.map((cid, i) => {
                  const card = cards.find(c => c.id === cid) || { name: 'Card', cost: 1, art: '🃏' };
                  return (
                    <div key={`${cid}-${i}`} className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative group flex flex-col justify-between gap-2">
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-xs font-semibold text-amber-200 truncate">{card.name}</span>
                        <span className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {card.cost}
                        </span>
                      </div>
                      {card.artworkUrl ? (
                        <img src={card.artworkUrl} alt={card.name} className="w-full h-24 object-cover rounded-lg border border-slate-700" />
                      ) : (
                        <div className="text-3xl text-center my-2">{card.art || '🃏'}</div>
                      )}
                      <button
                        onClick={() => setActiveDeckCardIds(prev => prev.filter((_, idx) => idx !== i))}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto space-y-4">
            <h3 className="text-sm font-bold text-slate-100">Autonomous AI Game Rules Engine</h3>
            <p className="text-xs text-slate-400">
              Generate complete tournament formats, turn phases, combat resolution formulas, and reaction keyword definitions.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={rulePrompt}
                onChange={(e) => setRulePrompt(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none focus:border-amber-500"
              />
              <button
                onClick={handleGenerateRules}
                disabled={generatingRules}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{generatingRules ? 'Writing…' : 'Generate'}</span>
              </button>
            </div>
            {generatedRules && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                {generatedRules}
              </div>
            )}
          </div>
        )}

        {activeTab === 'arena' && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-6">
            {!battleState ? (
              <div className="text-center space-y-4">
                <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-100">Sovereign Deck Battle Simulator</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Test your forged cards and active deck against an autonomous NPC opponent.
                </p>
                <button
                  onClick={startArenaBattle}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
                >
                  Enter Match
                </button>
              </div>
            ) : (
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">You (Player)</span>
                    <div className="text-sm font-bold text-emerald-400">{battleState.playerHp} HP</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase">Opponent NPC</span>
                    <div className="text-sm font-bold text-rose-400">{battleState.oppHp} HP</div>
                  </div>
                </div>
                {battleState.winner ? (
                  <div className="text-center py-4 space-y-2">
                    <div className="text-base font-black text-amber-300">{battleState.winner}</div>
                    <button onClick={startArenaBattle} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg cursor-pointer">
                      Rematch
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <button
                      onClick={executeAttack}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Swords className="w-4 h-4" /> Strike Opponent
                    </button>
                  </div>
                )}
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 max-h-36 overflow-y-auto space-y-1">
                  {battleState.log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
