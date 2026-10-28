import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Swords, Sparkles, Shield, Heart, Zap, Plus, Trash2,
  Download, Save, Play, Bot, ArrowLeft, Check, RefreshCw, Trophy
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';

const DEFAULT_CARD_DB = [
  { id: 'c-1', name: 'Clockwork Sentinel', type: 'construct', element: 'steam', cost: 2, attack: 2, defense: 3, ability: 'Vigilance: Can block even if tapped.', flavor: 'Ever watchful, never resting.', art: '⚙️' },
  { id: 'c-2', name: 'Nanite Swarm', type: 'construct', element: 'nano', cost: 1, attack: 1, defense: 1, ability: 'Replicate: Spawns duplicate on kill.', flavor: 'One becomes billions.', art: '🔬' },
  { id: 'c-3', name: 'Void Goliath', type: 'construct', element: 'void', cost: 6, attack: 6, defense: 6, ability: 'Obliterate: Deals 2 damage to all enemies on summon.', flavor: 'Shadow made incarnate.', art: '💀' },
  { id: 'c-4', name: 'Overclock Pulse', type: 'spell', element: 'steam', cost: 2, attack: 0, defense: 0, ability: 'Target gains +3 ATK and strikes immediately.', flavor: 'Push past redline.', art: '⚡' },
  { id: 'c-5', name: 'Quantum Barrier', type: 'trap', element: 'nano', cost: 2, attack: 0, defense: 0, ability: 'Negates the next incoming lethal strike.', flavor: 'Event horizon defense.', art: '🛡️' },
];

export default function CardForgeWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('forge'); // 'forge' | 'decks' | 'rules' | 'arena'
  const [cards, setCards] = useState(DEFAULT_CARD_DB);

  // Card Creator State
  const [cardDraft, setCardDraft] = useState({
    name: 'Aether Chimera',
    type: 'construct',
    element: 'steam',
    cost: 3,
    attack: 3,
    defense: 4,
    ability: 'On Summon: Draw 1 card and gain +1 DEF.',
    flavor: 'Forged in the heart of the brass furnace.',
    art: '🐉'
  });
  const [saveNotice, setSaveNotice] = useState('');

  // Deck Builder State
  const [decks, setDecks] = useState([]);
  const [currentDeckName, setCurrentDeckName] = useState('Sovereign Prime');
  const [activeDeckCardIds, setActiveDeckCardIds] = useState(['c-1', 'c-1', 'c-2', 'c-4', 'c-5']);

  // AI Rules State
  const [rulePrompt, setRulePrompt] = useState('A fast-paced 15-minute cyberpunk tactical format with speed tokens and overclock reactions');
  const [generatedRules, setGeneratedRules] = useState(null);
  const [generatingRules, setGeneratingRules] = useState(false);

  // Arena Simulator State
  const [battleState, setBattleState] = useState(null);

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    try {
      const saved = await db.card_decks.toArray();
      setDecks(saved);
      if (saved.length > 0) {
        setCurrentDeckName(saved[0].name);
        setActiveDeckCardIds(saved[0].cards || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCard = () => {
    const newCard = {
      id: `c-${Date.now()}`,
      ...cardDraft,
    };
    setCards(prev => [...prev, newCard]);
    setSaveNotice(`Created "${newCard.name}" in library!`);
    setTimeout(() => setSaveNotice(''), 3000);
  };

  const handleSaveDeck = async () => {
    const deckRecord = {
      id: `deck-${Date.now()}`,
      name: currentDeckName,
      cards: activeDeckCardIds,
      updated_at: new Date().toISOString(),
    };
    await db.card_decks.put(deckRecord);
    loadDecks();
    setSaveNotice(`Deck "${currentDeckName}" saved to database!`);
    setTimeout(() => setSaveNotice(''), 3000);
  };

  const addCardToDeck = (cardId) => {
    setActiveDeckCardIds(prev => [...prev, cardId]);
  };

  const removeCardFromDeck = (index) => {
    setActiveDeckCardIds(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateRules = async () => {
    setGeneratingRules(true);
    try {
      const response = await kernel?.ai?.chat([
        {
          role: 'system',
          content: 'You are a veteran Trading Card Game (TCG) designer and balance master. Generate an evocative, mathematically tight ruleset, win conditions, turn structure, and unique keywords based on the user format prompt. Format cleanly with markdown headers.'
        },
        { role: 'user', content: rulePrompt }
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
      playerHp: 20,
      oppHp: 20,
      playerEnergy: 3,
      log: ['Arena initialized. Match begins!'],
      winner: null,
    });
  };

  const executeAttack = () => {
    if (!battleState || battleState.winner) return;
    const dmg = Math.floor(Math.random() * 4) + 2;
    const oppDmg = Math.floor(Math.random() * 3) + 1;

    const newOppHp = Math.max(0, battleState.oppHp - dmg);
    const newPlayerHp = Math.max(0, battleState.playerHp - oppDmg);

    let winner = null;
    if (newOppHp === 0) winner = 'Player Wins!';
    else if (newPlayerHp === 0) winner = 'Opponent Wins!';

    setBattleState(prev => ({
      ...prev,
      turn: prev.turn + 1,
      playerHp: newPlayerHp,
      oppHp: newOppHp,
      winner,
      log: [
        `Turn ${prev.turn}: You dealt ${dmg} damage to Opponent.`,
        `Opponent counter-struck for ${oppDmg} damage.`,
        ...prev.log
      ]
    }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-12 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-xs">TCG Card Forge & Deck Studio</span>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('forge')}
            className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'forge' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Card Forge
          </button>
          <button
            onClick={() => setActiveTab('decks')}
            className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'decks' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Deck Builder
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'rules' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
          >
            AI Rules Generator
          </button>
          <button
            onClick={() => setActiveTab('arena')}
            className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'arena' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Battle Arena
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-1.5 bg-emerald-950/60 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Main Tab Views */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'forge' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Editor Sidebar */}
            <div className="w-80 border-r border-slate-800 p-4 space-y-3 overflow-y-auto shrink-0">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Card Parameters</h3>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-medium">Card Name</label>
                <input
                  type="text"
                  value={cardDraft.name}
                  onChange={(e) => setCardDraft({ ...cardDraft, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Type</label>
                  <select
                    value={cardDraft.type}
                    onChange={(e) => setCardDraft({ ...cardDraft, type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none"
                  >
                    <option value="construct">Construct</option>
                    <option value="spell">Spell</option>
                    <option value="trap">Trap</option>
                    <option value="catalyst">Catalyst</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Element</label>
                  <select
                    value={cardDraft.element}
                    onChange={(e) => setCardDraft({ ...cardDraft, element: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none"
                  >
                    <option value="steam">Steam (Brass)</option>
                    <option value="nano">Nano (Cyber)</option>
                    <option value="void">Void (Shadow)</option>
                    <option value="chrome">Chrome (Steel)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Cost</label>
                  <input
                    type="number"
                    value={cardDraft.cost}
                    onChange={(e) => setCardDraft({ ...cardDraft, cost: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Attack</label>
                  <input
                    type="number"
                    value={cardDraft.attack}
                    onChange={(e) => setCardDraft({ ...cardDraft, attack: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium">Defense</label>
                  <input
                    type="number"
                    value={cardDraft.defense}
                    onChange={(e) => setCardDraft({ ...cardDraft, defense: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-medium">Card Ability</label>
                <textarea
                  rows={2}
                  value={cardDraft.ability}
                  onChange={(e) => setCardDraft({ ...cardDraft, ability: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-medium">Flavor Text</label>
                <textarea
                  rows={2}
                  value={cardDraft.flavor}
                  onChange={(e) => setCardDraft({ ...cardDraft, flavor: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 italic outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleCreateCard}
                className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
              >
                Forge Card & Save
              </button>
            </div>

            {/* Visual Card Canvas */}
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-900/40">
              <div className="w-[300px] h-[430px] rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 p-4 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                {/* Cost badge */}
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-amber-200">{cardDraft.name}</h3>
                  <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-black text-white shadow">
                    {cardDraft.cost}
                  </div>
                </div>

                {/* Art Frame */}
                <div className="w-full h-40 bg-slate-950/80 rounded-xl border border-amber-500/30 flex items-center justify-center text-6xl shadow-inner my-2">
                  {cardDraft.art}
                </div>

                {/* Abilities */}
                <div className="flex-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <p className="text-[11px] text-slate-200 leading-snug">{cardDraft.ability}</p>
                  <p className="text-[10px] text-slate-500 italic border-t border-slate-800 pt-1 mt-1">{cardDraft.flavor}</p>
                </div>

                {/* Stats Footer */}
                {cardDraft.type === 'construct' && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{cardDraft.element}</span>
                    <div className="flex gap-2">
                      <span className="flex items-center gap-1 text-xs font-black text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40">
                        <Swords className="w-3 h-3" /> {cardDraft.attack}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                        <Shield className="w-3 h-3" /> {cardDraft.defense}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decks' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Library list */}
            <div className="w-72 border-r border-slate-800 p-4 overflow-y-auto space-y-3 shrink-0">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Card Vault ({cards.length})</h3>
              <div className="space-y-2">
                {cards.map(c => (
                  <div
                    key={c.id}
                    onClick={() => addCardToDeck(c.id)}
                    className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer hover:border-amber-500/60 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.type} · Cost: {c.cost}</div>
                    </div>
                    <Plus className="w-4 h-4 text-amber-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Current Deck */}
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
                    onClick={handleSaveDeck}
                    className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Deck</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {activeDeckCardIds.map((cid, i) => {
                  const card = cards.find(c => c.id === cid) || { name: 'Card', cost: 1, art: '🃏' };
                  return (
                    <div
                      key={i}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative group flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-amber-200">{card.name}</span>
                        <span className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold">
                          {card.cost}
                        </span>
                      </div>
                      <div className="text-3xl text-center my-3">{card.art}</div>
                      <button
                        onClick={() => removeCardFromDeck(i)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-300 flex items-center justify-center gap-1 pt-1"
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
              Generate complete tournament formats, turn phases, combat resolution formulas, and keyword definitions.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={rulePrompt}
                onChange={(e) => setRulePrompt(e.target.value)}
                placeholder="Describe your desired card game genre or rule mechanic..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none focus:border-amber-500"
              />
              <button
                onClick={handleGenerateRules}
                disabled={generatingRules}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate</span>
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
                  Test your crafted cards and active deck against an autonomous NPC opponent.
                </p>
                <button
                  onClick={startArenaBattle}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                >
                  Enter Match
                </button>
              </div>
            ) : (
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <div className="text-left">
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
                    <button
                      onClick={startArenaBattle}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg"
                    >
                      Rematch
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={executeAttack}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                    >
                      <Swords className="w-4 h-4" />
                      <span>Strike Opponent</span>
                    </button>
                  </div>
                )}

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 max-h-32 overflow-y-auto space-y-1">
                  {battleState.log.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
