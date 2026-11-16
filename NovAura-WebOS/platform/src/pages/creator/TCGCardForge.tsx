/**
 * TCG Card Forge - Aetherium Card Generation Station
 * 
 * Uses PixAI unlimited generation (10K/hour) to create new cards
 * matching the Aetherium TCG aesthetic. Outputs Godot-ready format.
 * 
 * Features:
 * - Batch generation (1-100 cards at a time)
 * - Style reference upload (existing cards as templates)
 * - Auto-trim and process generated images
 * - Export to Godot .tres format
 * - Card database management
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wand2,
  Download,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Zap,
  Flame,
  Droplets,
  Mountain,
  Wind,
  Snowflake,
  CloudLightning,
  Leaf,
  Moon,
  Sun,
  Skull,
  FlameKindling,
  Sword,
  Shield,
  Save,
  Trash2,
  Copy,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Settings,
  FileJson,
  Package,
  Eye,
  EyeOff,
} from 'lucide-react';
import { aiOrchestrator } from '@/services/aiOrchestrator';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface CardConcept {
  id: string;
  name: string;
  element: ElementType;
  rarity: RarityType;
  cardType: CardType;
  manaCost: number;
  attack?: number;
  defense?: number;
  ability: string;
  flavorText: string;
  artPrompt: string;
  status: 'draft' | 'generating' | 'completed' | 'error';
  generatedImageUrl?: string;
  errorMessage?: string;
}

type ElementType = 
  | 'fire' | 'water' | 'earth' | 'wind' | 'ice' 
  | 'lightning' | 'nature' | 'shadow' | 'aether' 
  | 'poison' | 'death' | 'arcane' | 'steam' | 'nano' | 'chrome' | 'void';

type RarityType = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

type CardType = 'creature' | 'spell' | 'trap' | 'enchantment' | 'gear' | 'catalyst';

interface BatchConfig {
  count: number;
  element?: ElementType;
  rarity?: RarityType;
  cardType?: CardType;
  useStyleReference: boolean;
  styleReferenceUrl?: string;
  autoTrim: boolean;
  exportFormat: 'png' | 'godot' | 'both';
}

interface GenerationJob {
  id: string;
  concepts: CardConcept[];
  config: BatchConfig;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  completedCount: number;
  errorCount: number;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ELEMENTS: { id: ElementType; name: string; icon: React.ReactNode; color: string }[] = [
  { id: 'fire', name: 'Fire', icon: <Flame className="w-4 h-4" />, color: '#ef4444' },
  { id: 'water', name: 'Water', icon: <Droplets className="w-4 h-4" />, color: '#3b82f6' },
  { id: 'earth', name: 'Earth', icon: <Mountain className="w-4 h-4" />, color: '#22c55e' },
  { id: 'wind', name: 'Wind', icon: <Wind className="w-4 h-4" />, color: '#a855f7' },
  { id: 'ice', name: 'Ice', icon: <Snowflake className="w-4 h-4" />, color: '#06b6d4' },
  { id: 'lightning', name: 'Lightning', icon: <CloudLightning className="w-4 h-4" />, color: '#eab308' },
  { id: 'nature', name: 'Nature', icon: <Leaf className="w-4 h-4" />, color: '#16a34a' },
  { id: 'shadow', name: 'Shadow', icon: <Moon className="w-4 h-4" />, color: '#6366f1' },
  { id: 'aether', name: 'Aether', icon: <Sparkles className="w-4 h-4" />, color: '#f59e0b' },
  { id: 'poison', name: 'Poison', icon: <FlameKindling className="w-4 h-4" />, color: '#84cc16' },
  { id: 'death', name: 'Death', icon: <Skull className="w-4 h-4" />, color: '#525252' },
  { id: 'arcane', name: 'Arcane', icon: <Zap className="w-4 h-4" />, color: '#ec4899' },
  { id: 'steam', name: 'Steam', icon: <CloudLightning className="w-4 h-4" />, color: '#94a3b8' },
  { id: 'nano', name: 'Nano', icon: <Layers className="w-4 h-4" />, color: '#0ea5e9' },
  { id: 'chrome', name: 'Chrome', icon: <Shield className="w-4 h-4" />, color: '#cbd5e1' },
  { id: 'void', name: 'Void', icon: <Moon className="w-4 h-4" />, color: '#7c3aed' },
];

const RARITIES: { id: RarityType; name: string; color: string; borderColor: string }[] = [
  { id: 'common', name: 'Common', color: '#94a3b8', borderColor: 'border-slate-400' },
  { id: 'uncommon', name: 'Uncommon', color: '#22c55e', borderColor: 'border-green-500' },
  { id: 'rare', name: 'Rare', color: '#3b82f6', borderColor: 'border-blue-500' },
  { id: 'epic', name: 'Epic', color: '#a855f7', borderColor: 'border-purple-500' },
  { id: 'legendary', name: 'Legendary', color: '#f59e0b', borderColor: 'border-amber-500' },
  { id: 'mythic', name: 'Mythic', color: '#ec4899', borderColor: 'border-pink-500' },
];

const CARD_TYPES: { id: CardType; name: string; icon: React.ReactNode }[] = [
  { id: 'creature', name: 'Creature', icon: <Sword className="w-4 h-4" /> },
  { id: 'spell', name: 'Spell', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'trap', name: 'Trap', icon: <Shield className="w-4 h-4" /> },
  { id: 'enchantment', name: 'Enchantment', icon: <Sun className="w-4 h-4" /> },
  { id: 'gear', name: 'Gear', icon: <Layers className="w-4 h-4" /> },
  { id: 'catalyst', name: 'Catalyst', icon: <Zap className="w-4 h-4" /> },
];

// Aetherium card style prompt template
const CARD_STYLE_TEMPLATE = `Trading card game card in the style of Aetherium TCG.
Ornate silver frame with intricate gear patterns and blue crystal gems.
Centered title banner at top with elegant typography.
Central artwork showing the subject in dramatic lighting.
Hexagonal mana cost badge at bottom center.
ATK/DEF shield badges at bottom corners.
Rarity banner at bottom center.
Dark fantasy aesthetic with steampunk and nanotech elements.
High quality digital art, professional TCG illustration.
Card dimensions: 864x1184 pixels.`;

// ============================================================================
// COMPONENT
// ============================================================================

export default function TCGCardForge() {
  // State
  const [activeTab, setActiveTab] = useState('single');
  const [concepts, setConcepts] = useState<CardConcept[]>([]);
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<CardConcept | null>(null);
  const [styleReferenceUrl, setStyleReferenceUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single card form state
  const [singleCard, setSingleCard] = useState<Partial<CardConcept>>({
    element: 'fire',
    rarity: 'common',
    cardType: 'creature',
    manaCost: 1,
    attack: 10,
    defense: 10,
  });

  // Batch config state
  const [batchConfig, setBatchConfig] = useState<BatchConfig>({
    count: 10,
    useStyleReference: false,
    autoTrim: true,
    exportFormat: 'both',
  });

  // ============================================================================
  // HELPERS
  // ============================================================================

  const generateCardPrompt = (concept: CardConcept): string => {
    const elementInfo = ELEMENTS.find(e => e.id === concept.element);
    const rarityInfo = RARITIES.find(r => r.id === concept.rarity);
    
    let prompt = `Aetherium TCG trading card: "${concept.name}"`;
    prompt += `\n\n${CARD_STYLE_TEMPLATE}`;
    prompt += `\n\nCard Details:`;
    prompt += `\n- Element: ${elementInfo?.name} (${concept.element})`;
    prompt += `\n- Rarity: ${rarityInfo?.name}`;
    prompt += `\n- Type: ${concept.cardType}`;
    prompt += `\n- Mana Cost: ${concept.manaCost}`;
    
    if (concept.attack !== undefined && concept.defense !== undefined) {
      prompt += `\n- ATK/DEF: ${concept.attack}/${concept.defense}`;
    }
    
    prompt += `\n\nArtwork Description:`;
    prompt += `\n${concept.artPrompt || concept.ability}`;
    prompt += `\n\n${concept.flavorText}`;
    
    // Add element-specific aesthetic
    prompt += `\n\nElement Aesthetic:`;
    switch (concept.element) {
      case 'fire':
        prompt += `\n- Fiery orange and red glow`;
        prompt += `\n- Ember particles and flame motifs`;
        break;
      case 'water':
        prompt += `\n- Deep blue and aqua tones`;
        prompt += `\n- Water ripples and bubble effects`;
        break;
      case 'earth':
        prompt += `\n- Brown and green earth tones`;
        prompt += `\n- Stone textures and crystal formations`;
        break;
      case 'nano':
        prompt += `\n- Digital cyan grid patterns`;
        prompt += `\n- Circuit board aesthetics`;
        break;
      case 'steam':
        prompt += `\n- Brass and copper tones`;
        prompt += `\n- Steam vents and gear mechanisms`;
        break;
      case 'void':
        prompt += `\n- Deep purple and black void`;
        prompt += `\n- Eldritch energy and corruption`;
        break;
      default:
        prompt += `\n- ${elementInfo?.name} elemental visual theme`;
    }
    
    // Add rarity-specific frame effects
    if (concept.rarity === 'legendary' || concept.rarity === 'mythic') {
      prompt += `\n\nLegendary Features:`;
      prompt += `\n- Golden crown icon at top`;
      prompt += `\n- "FINAL EVOLUTION" subtitle`;
      prompt += `\n- Glowing aura effect around frame`;
      prompt += `\n- Holographic shimmer overlay`;
    }
    
    return prompt;
  };

  const generateArtPrompt = (name: string, element: ElementType, cardType: CardType, ability: string): string => {
    const prompts: Record<string, string> = {
      fire: `a powerful fire elemental creature with blazing wings and magma skin, erupting volcano background, intense heat distortion`,
      water: `an elegant water serpent with crystalline scales, underwater temple ruins, bioluminescent glow`,
      earth: `a massive stone golem covered in moss and crystals, ancient forest setting, earth cracking beneath its feet`,
      wind: `a swift aerial beast with cloud-like fur and lightning-fast movements, stormy sky backdrop`,
      ice: `a majestic frost dragon with translucent ice wings, frozen wasteland, snow particles floating`,
      lightning: `an electric entity crackling with plasma energy, storm clouds, chain lightning effects`,
      nature: `a living plant creature entwined with vines and flowers, lush jungle, pollen and spores floating`,
      shadow: `a shadowy assassin cloaked in darkness, ethereal smoke trailing, glowing eyes in the void`,
      aether: `a cosmic being made of starlight and nebula, swirling galaxy background, prismatic light effects`,
      nano: `a digital swarm entity composed of nanobots, cyberspace grid, holographic interface elements`,
      steam: `a clockwork automaton with brass plating and steam vents, industrial forge background`,
      void: `an eldritch abomination from beyond reality, reality tearing around it, chaotic energy`,
    };
    
    const basePrompt = prompts[element] || `a ${element} elemental creature in dramatic pose`;
    
    return `${name}: ${basePrompt}. Ability: ${ability}. High detail fantasy illustration, professional trading card game art.`;
  };

  // ============================================================================
  // GENERATION HANDLERS
  // ============================================================================

  const generateSingleCard = async () => {
    if (!singleCard.name) {
      toast.error('Please enter a card name');
      return;
    }

    const concept: CardConcept = {
      id: `card-${Date.now()}`,
      name: singleCard.name,
      element: singleCard.element as ElementType,
      rarity: singleCard.rarity as RarityType,
      cardType: singleCard.cardType as CardType,
      manaCost: singleCard.manaCost || 1,
      attack: singleCard.attack,
      defense: singleCard.defense,
      ability: singleCard.ability || '',
      flavorText: singleCard.flavorText || '',
      artPrompt: singleCard.artPrompt || generateArtPrompt(
        singleCard.name,
        singleCard.element as ElementType,
        singleCard.cardType as CardType,
        singleCard.ability || ''
      ),
      status: 'draft',
    };

    setConcepts([...concepts, concept]);
    setSelectedConcept(concept);
    
    // Start generation
    await generateCardImage(concept);
  };

  const generateCardImage = async (concept: CardConcept) => {
    setIsGenerating(true);
    
    // Update status to generating
    setConcepts(prev => prev.map(c => 
      c.id === concept.id ? { ...c, status: 'generating' } : c
    ));

    try {
      const prompt = generateCardPrompt(concept);
      
      // Use PixAI for generation (unlimited at 10K/hour)
      const result = await aiOrchestrator.generateImage(prompt, {
        provider: 'pixai',
        aspectRatio: '2:3', // TCG card ratio
        negativePrompt: 'blurry, low quality, distorted text, cropped, out of frame, ugly, deformed',
      });

      if (result.imageUrl) {
        setConcepts(prev => prev.map(c => 
          c.id === concept.id ? { 
            ...c, 
            status: 'completed', 
            generatedImageUrl: result.imageUrl 
          } : c
        ));
        
        if (selectedConcept?.id === concept.id) {
          setSelectedConcept(prev => prev ? { ...prev, status: 'completed', generatedImageUrl: result.imageUrl } : null);
        }
        
        toast.success(`Generated: ${concept.name}`);
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      setConcepts(prev => prev.map(c => 
        c.id === concept.id ? { 
          ...c, 
          status: 'error', 
          errorMessage: errorMsg 
        } : c
      ));
      toast.error(`Failed to generate ${concept.name}: ${errorMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBatch = async () => {
    if (batchConfig.count < 1 || batchConfig.count > 100) {
      toast.error('Batch count must be between 1 and 100');
      return;
    }

    // Generate random card concepts
    const newConcepts: CardConcept[] = [];
    const elements = ELEMENTS.map(e => e.id);
    const rarities: RarityType[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const types: CardType[] = ['creature', 'spell', 'trap', 'enchantment'];
    
    const creatureNames = [
      'Leviathan', 'Golem', 'Wisp', 'Serpent', 'Giant', 'Elemental',
      'Knight', 'Dragon', 'Phoenix', 'Titan', 'Guardian', 'Slayer',
      'Construct', 'Automaton', 'Phantom', 'Specter', 'Behemoth',
      'Drake', 'Hydra', 'Colossus', 'Sentinel', 'Warden', 'Reaper'
    ];
    
    const prefixes = [
      'Abyssal', 'Eternal', 'Crimson', 'Frost', 'Thunder', 'Shadow',
      'Radiant', 'Ancient', 'Cursed', 'Blessed', 'Doom', 'Storm',
      'Crystal', 'Iron', 'Golden', 'Void', 'Aether', 'Chaos',
      'Arcane', 'Mystic', 'Savage', 'Noble', 'Dark', 'Primal'
    ];

    for (let i = 0; i < batchConfig.count; i++) {
      const element = batchConfig.element || elements[Math.floor(Math.random() * elements.length)];
      const rarity = batchConfig.rarity || rarities[Math.floor(Math.random() * rarities.length)];
      const cardType = batchConfig.cardType || types[Math.floor(Math.random() * types.length)];
      
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const name = cardType === 'creature' 
        ? `${prefix} ${creatureNames[Math.floor(Math.random() * creatureNames.length)]}`
        : `${prefix} ${cardType === 'spell' ? 'Surge' : cardType === 'trap' ? 'Snare' : 'Aura'}`;
      
      const manaCost = rarity === 'common' ? Math.floor(Math.random() * 3) + 1
        : rarity === 'uncommon' ? Math.floor(Math.random() * 3) + 2
        : rarity === 'rare' ? Math.floor(Math.random() * 4) + 3
        : Math.floor(Math.random() * 5) + 4;
      
      newConcepts.push({
        id: `batch-${Date.now()}-${i}`,
        name,
        element,
        rarity,
        cardType,
        manaCost,
        attack: cardType === 'creature' ? Math.floor(Math.random() * 20) + 10 : undefined,
        defense: cardType === 'creature' ? Math.floor(Math.random() * 20) + 10 : undefined,
        ability: generateRandomAbility(cardType, element),
        flavorText: generateFlavorText(element),
        artPrompt: '',
        status: 'draft',
      });
    }

    setConcepts([...concepts, ...newConcepts]);
    
    // Create job
    const job: GenerationJob = {
      id: `job-${Date.now()}`,
      concepts: newConcepts,
      config: batchConfig,
      status: 'running',
      progress: 0,
      completedCount: 0,
      errorCount: 0,
      startedAt: new Date(),
    };
    
    setCurrentJob(job);
    
    // Process batch
    toast.info(`Starting batch generation: ${batchConfig.count} cards`);
    
    for (let i = 0; i < newConcepts.length; i++) {
      if (currentJob?.status === 'paused') {
        toast.info('Batch generation paused');
        break;
      }
      
      await generateCardImage(newConcepts[i]);
      
      setCurrentJob(prev => prev ? {
        ...prev,
        progress: ((i + 1) / newConcepts.length) * 100,
        completedCount: i + 1,
      } : null);
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }
    
    setCurrentJob(prev => prev ? { ...prev, status: 'completed', completedAt: new Date() } : null);
    toast.success('Batch generation completed!');
  };

  const generateRandomAbility = (cardType: CardType, element: ElementType): string => {
    const abilities: Record<CardType, string[]> = {
      creature: [
        `When summoned: Deal 10 damage to opponent's ${element} creatures.`,
        `Gains +5 ATK when ${element} cards are played.`,
        `Can attack immediately when summoned.`,
        `Blocks attacks targeting adjacent creatures.`,
        `When destroyed: Summon a 1/1 ${element} token.`,
      ],
      spell: [
        `Deal 20 damage to target creature.`,
        `Restore 25 HP to target creature.`,
        `Draw 2 cards.`,
        `Destroy target trap or enchantment.`,
        `All ${element} creatures gain +5/+5 this turn.`,
      ],
      trap: [
        `When opponent attacks: Negate the attack and deal 15 damage.`,
        `When opponent plays a spell: Counter it and draw 1 card.`,
        `When a creature would be destroyed: Prevent it.`,
        `When opponent summons: They take 10 damage.`,
      ],
      enchantment: [
        `All your ${element} creatures have +3/+3.`,
        `At the start of your turn: Gain 5 HP.`,
        `Opponent's creatures enter play tapped.`,
        `Your spells cost 1 less mana.`,
      ],
      gear: [
        `Equipped creature has +5/+5.`,
        `Equipped creature gains first strike.`,
        `When equipped creature destroys another: Draw 1 card.`,
      ],
      catalyst: [
        `Generates 1 ${element} mana per turn.`,
        `Your max mana is increased by 1.`,
        `When tapped: Add 2 mana of any color.`,
      ],
    };
    
    const typeAbilities = abilities[cardType] || abilities.creature;
    return typeAbilities[Math.floor(Math.random() * typeAbilities.length)];
  };

  const generateFlavorText = (element: ElementType): string => {
    const flavors: Record<string, string[]> = {
      fire: ['Where there is smoke, there is fire. And where there is fire, there is destruction.'],
      water: ['The tide turns for no one, yet it carries all to their destiny.'],
      earth: ['Mountains do not bow to the wind, nor shall I bow to my enemies.'],
      wind: ['Swift as the gale, silent as the breeze.'],
      ice: ['Even the warmest heart can freeze in the depths of winter.'],
      nano: ['One becomes many. Many become all.'],
      steam: ['Pressure builds. Gears turn. Empires fall.'],
      void: ['The void does not hunger. The void simply... is.'],
    };
    
    const elementFlavors = flavors[element] || ['Aether flows through all things.'];
    return elementFlavors[Math.floor(Math.random() * elementFlavors.length)];
  };

  // ============================================================================
  // EXPORT HANDLERS
  // ============================================================================

  const exportToGodot = (concept: CardConcept) => {
    const cleanTitle = concept.name.replace(/\s+/g, '');
    const typeId = concept.cardType === 'creature' ? 0 : concept.cardType === 'spell' ? 1 : 2;
    
    const tresContent = `[gd_resource type="Resource" script_class="CardData" load_steps=3 format=3]

[ext_resource type="Script" path="res://Scripts/Card/CardData.gd" id="1_script"]
[ext_resource type="Texture2D" path="res://assets/card_textures/${cleanTitle}.png" id="2_img"]

[resource]
script = ExtResource("1_script")
title = "${concept.name}"
cost = ${concept.manaCost}
power = ${concept.attack || 0}
defense = ${concept.defense || 0}
text = "${concept.ability.replace(/"/g, '\\"')}"
image = ExtResource("2_img")
is_face_down = false
type = ${typeId}
stage = 1
position = 0
evolves_from = ""
effects = {}
`;

    const blob = new Blob([tresContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}.tres`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${concept.name}.tres`);
  };

  const exportBatchJSON = () => {
    const completedCards = concepts.filter(c => c.status === 'completed');
    if (completedCards.length === 0) {
      toast.error('No completed cards to export');
      return;
    }

    const exportData = {
      cards: completedCards,
      exportedAt: new Date().toISOString(),
      total: completedCards.length,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetherium_cards_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${completedCards.length} cards to JSON`);
  };

  // ============================================================================
  // TSON EXPORT (Godot Typed JSON)
  // ============================================================================

  const exportToTSON = (concept: CardConcept) => {
    const typeId = concept.cardType === 'creature' ? 0 : concept.cardType === 'spell' ? 1 : 2;
    
    // Build effects dictionary based on card type and ability
    const effects: Record<string, any> = {};
    
    // Parse ability for common patterns
    if (concept.ability.includes('When summoned')) {
      effects['EnterField'] = [{
        type: 'trigger',
        effect: concept.ability,
      }];
    }
    if (concept.ability.includes('OnAttack') || concept.ability.includes('attack')) {
      effects['OnAttack'] = [{
        type: 'trigger', 
        effect: concept.ability,
      }];
    }
    if (concept.ability.includes('destroyed') || concept.ability.includes('When destroyed')) {
      effects['OnDestroyed'] = [{
        type: 'trigger',
        effect: concept.ability,
      }];
    }

    const tsonData = {
      _meta: {
        format: 'AetheriumCardTSON',
        version: '1.0',
        exported: new Date().toISOString(),
      },
      card: {
        title: concept.name,
        cost: concept.manaCost,
        power: concept.attack || 0,
        defense: concept.defense || 0,
        text: concept.ability,
        flavor: concept.flavorText,
        type: typeId, // 0=Monster, 1=Magic, 2=Trap
        element: concept.element,
        rarity: concept.rarity,
        stage: 1,
        position: 0, // 0=ATK, 1=DEF
        evolves_from: '',
        effects,
        keywords: [],
        image_path: `res://assets/cards/${concept.name.replace(/\s+/g, '_')}.png`,
      }
    };

    const blob = new Blob([JSON.stringify(tsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${concept.name.replace(/\s+/g, '_')}.tson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${concept.name}.tson`);
  };

  const exportBatchTSON = () => {
    const completedCards = concepts.filter(c => c.status === 'completed');
    if (completedCards.length === 0) {
      toast.error('No completed cards to export');
      return;
    }

    const tsonData = {
      _meta: {
        format: 'AetheriumCardBatchTSON',
        version: '1.0',
        exported: new Date().toISOString(),
        count: completedCards.length,
      },
      cards: completedCards.map(concept => {
        const typeId = concept.cardType === 'creature' ? 0 : concept.cardType === 'spell' ? 1 : 2;
        
        // Build effects
        const effects: Record<string, any> = {};
        if (concept.ability.includes('When summoned')) {
          effects['EnterField'] = [{ type: 'trigger', effect: concept.ability }];
        }
        if (concept.ability.includes('attack')) {
          effects['OnAttack'] = [{ type: 'trigger', effect: concept.ability }];
        }
        if (concept.ability.includes('destroyed')) {
          effects['OnDestroyed'] = [{ type: 'trigger', effect: concept.ability }];
        }

        return {
          title: concept.name,
          cost: concept.manaCost,
          power: concept.attack || 0,
          defense: concept.defense || 0,
          text: concept.ability,
          flavor: concept.flavorText,
          type: typeId,
          element: concept.element,
          rarity: concept.rarity,
          stage: 1,
          position: 0,
          evolves_from: '',
          effects,
          keywords: [],
          image_path: `res://assets/cards/${concept.name.replace(/\s+/g, '_')}.png`,
        };
      })
    };

    const blob = new Blob([JSON.stringify(tsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetherium_batch_${Date.now()}.tson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${completedCards.length} cards to TSON batch`);
  };

  const deleteConcept = (id: string) => {
    setConcepts(concepts.filter(c => c.id !== id));
    if (selectedConcept?.id === id) {
      setSelectedConcept(null);
    }
  };

  const duplicateConcept = (concept: CardConcept) => {
    const newConcept: CardConcept = {
      ...concept,
      id: `card-${Date.now()}`,
      name: `${concept.name} (Copy)`,
      status: 'draft',
      generatedImageUrl: undefined,
    };
    setConcepts([...concepts, newConcept]);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                <Layers className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">TCG Card Forge</h1>
                <p className="text-sm text-slate-400">
                  Aetherium Card Generation Station • PixAI Unlimited
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-slate-800 border-slate-700">
                <Zap className="w-3 h-3 mr-1 text-yellow-400" />
                10K/hour
              </Badge>
              <Badge variant="outline" className="bg-slate-800 border-slate-700">
                {concepts.filter(c => c.status === 'completed').length} Generated
              </Badge>
              <Button variant="outline" size="sm" onClick={exportBatchJSON}>
                <Download className="w-4 h-4 mr-2" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={exportBatchTSON} className="border-cyan-700 text-cyan-400 hover:bg-cyan-900/30">
                <FileJson className="w-4 h-4 mr-2" />
                TSON
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                <TabsTrigger value="single">Single Card</TabsTrigger>
                <TabsTrigger value="batch">Batch Gen</TabsTrigger>
              </TabsList>

              {/* Single Card Tab */}
              <TabsContent value="single" className="space-y-4">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-purple-400" />
                      Card Designer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Card Name</label>
                      <Input
                        value={singleCard.name || ''}
                        onChange={(e) => setSingleCard({ ...singleCard, name: e.target.value })}
                        placeholder="e.g., Abyssal Leviathan"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>

                    {/* Element & Rarity */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Element</label>
                        <Select 
                          value={singleCard.element} 
                          onValueChange={(v) => setSingleCard({ ...singleCard, element: v as ElementType })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ELEMENTS.map(e => (
                              <SelectItem key={e.id} value={e.id}>
                                <span className="flex items-center gap-2">
                                  {e.icon}
                                  {e.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Rarity</label>
                        <Select 
                          value={singleCard.rarity} 
                          onValueChange={(v) => setSingleCard({ ...singleCard, rarity: v as RarityType })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RARITIES.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                <span className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                                  {r.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Card Type & Mana */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Type</label>
                        <Select 
                          value={singleCard.cardType} 
                          onValueChange={(v) => setSingleCard({ ...singleCard, cardType: v as CardType })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CARD_TYPES.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                <span className="flex items-center gap-2">
                                  {t.icon}
                                  {t.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Mana Cost</label>
                        <Input
                          type="number"
                          min={0}
                          max={12}
                          value={singleCard.manaCost}
                          onChange={(e) => setSingleCard({ ...singleCard, manaCost: parseInt(e.target.value) || 0 })}
                          className="bg-slate-800 border-slate-700"
                        />
                      </div>
                    </div>

                    {/* ATK/DEF for creatures */}
                    {singleCard.cardType === 'creature' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Attack</label>
                          <Input
                            type="number"
                            value={singleCard.attack}
                            onChange={(e) => setSingleCard({ ...singleCard, attack: parseInt(e.target.value) || 0 })}
                            className="bg-slate-800 border-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Defense</label>
                          <Input
                            type="number"
                            value={singleCard.defense}
                            onChange={(e) => setSingleCard({ ...singleCard, defense: parseInt(e.target.value) || 0 })}
                            className="bg-slate-800 border-slate-700"
                          />
                        </div>
                      </div>
                    )}

                    {/* Ability */}
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Ability</label>
                      <Textarea
                        value={singleCard.ability || ''}
                        onChange={(e) => setSingleCard({ ...singleCard, ability: e.target.value })}
                        placeholder="Card ability text..."
                        className="bg-slate-800 border-slate-700 min-h-[60px]"
                      />
                    </div>

                    {/* Flavor Text */}
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Flavor Text</label>
                      <Textarea
                        value={singleCard.flavorText || ''}
                        onChange={(e) => setSingleCard({ ...singleCard, flavorText: e.target.value })}
                        placeholder="Flavor text..."
                        className="bg-slate-800 border-slate-700 min-h-[40px] italic text-slate-400"
                      />
                    </div>

                    {/* Generate Button */}
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                      onClick={generateSingleCard}
                      disabled={isGenerating || !singleCard.name}
                    >
                      {isGenerating ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Generate Card
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Batch Tab */}
              <TabsContent value="batch" className="space-y-4">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Layers className="w-5 h-5 text-purple-400" />
                      Batch Generation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Card Count</label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={batchConfig.count}
                        onChange={(e) => setBatchConfig({ ...batchConfig, count: parseInt(e.target.value) || 10 })}
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Element (Optional)</label>
                        <Select 
                          value={batchConfig.element || 'random'} 
                          onValueChange={(v) => setBatchConfig({ ...batchConfig, element: v === 'random' ? undefined : v as ElementType })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="random">Random</SelectItem>
                            {ELEMENTS.map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Rarity (Optional)</label>
                        <Select 
                          value={batchConfig.rarity || 'random'} 
                          onValueChange={(v) => setBatchConfig({ ...batchConfig, rarity: v === 'random' ? undefined : v as RarityType })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="random">Random</SelectItem>
                            {RARITIES.map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Card Type (Optional)</label>
                      <Select 
                        value={batchConfig.cardType || 'random'} 
                        onValueChange={(v) => setBatchConfig({ ...batchConfig, cardType: v === 'random' ? undefined : v as CardType })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="random">Random</SelectItem>
                          {CARD_TYPES.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Options */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Auto-trim borders</span>
                        <Switch 
                          checked={batchConfig.autoTrim}
                          onCheckedChange={(v) => setBatchConfig({ ...batchConfig, autoTrim: v })}
                        />
                      </div>
                    </div>

                    {/* Progress */}
                    {currentJob && (
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">Progress</span>
                          <span className="text-sm text-slate-400">
                            {currentJob.completedCount}/{currentJob.concepts.length}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all"
                            style={{ width: `${currentJob.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                      onClick={generateBatch}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Layers className="w-4 h-4 mr-2" />
                      )}
                      Generate {batchConfig.count} Cards
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Style Reference */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  Style Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-slate-600 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {styleReferenceUrl ? (
                    <img src={styleReferenceUrl} alt="Style reference" className="max-h-32 mx-auto rounded" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                      <p className="text-xs text-slate-400">Upload existing card as style reference</p>
                    </>
                  )}
                </div>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setStyleReferenceUrl(url);
                      setBatchConfig({ ...batchConfig, useStyleReference: true, styleReferenceUrl: url });
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Preview */}
          <div className="lg:col-span-2 space-y-4">
            {selectedConcept ? (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedConcept.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge 
                        style={{ 
                          backgroundColor: RARITIES.find(r => r.id === selectedConcept.rarity)?.color + '30',
                          borderColor: RARITIES.find(r => r.id === selectedConcept.rarity)?.color,
                          color: RARITIES.find(r => r.id === selectedConcept.rarity)?.color,
                        }}
                        variant="outline"
                      >
                        {selectedConcept.rarity}
                      </Badge>
                      <Badge variant="outline" className="border-slate-700">
                        {ELEMENTS.find(e => e.id === selectedConcept.element)?.icon}
                        <span className="ml-1">{selectedConcept.element}</span>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedConcept.generatedImageUrl ? (
                    <div className="space-y-4">
                      <div className="relative bg-slate-800 rounded-lg overflow-hidden">
                        <img 
                          src={selectedConcept.generatedImageUrl} 
                          alt={selectedConcept.name}
                          className="w-full max-h-[500px] object-contain"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => duplicateConcept(selectedConcept)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => exportToGodot(selectedConcept)}>
                            .tres
                          </Button>
                          <Button size="sm" variant="secondary" className="bg-cyan-900/50 border-cyan-700 text-cyan-300" onClick={() => exportToTSON(selectedConcept)}>
                            .tson
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteConcept(selectedConcept.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-slate-800 rounded p-3 text-center">
                          <div className="text-slate-400 text-xs mb-1">Mana</div>
                          <div className="text-xl font-bold text-cyan-400">{selectedConcept.manaCost}</div>
                        </div>
                        {selectedConcept.attack !== undefined && (
                          <div className="bg-slate-800 rounded p-3 text-center">
                            <div className="text-slate-400 text-xs mb-1">ATK/DEF</div>
                            <div className="text-xl font-bold text-red-400">{selectedConcept.attack}/{selectedConcept.defense}</div>
                          </div>
                        )}
                        <div className="bg-slate-800 rounded p-3 text-center">
                          <div className="text-slate-400 text-xs mb-1">Type</div>
                          <div className="text-lg font-medium">{selectedConcept.cardType}</div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-800 rounded p-3">
                        <div className="text-slate-400 text-xs mb-1">Ability</div>
                        <p className="text-sm">{selectedConcept.ability}</p>
                      </div>
                      
                      {selectedConcept.flavorText && (
                        <div className="bg-slate-800 rounded p-3">
                          <div className="text-slate-400 text-xs mb-1">Flavor</div>
                          <p className="text-sm italic text-slate-400">"{selectedConcept.flavorText}"</p>
                        </div>
                      )}
                    </div>
                  ) : selectedConcept.status === 'generating' ? (
                    <div className="h-[400px] flex items-center justify-center bg-slate-800 rounded-lg">
                      <div className="text-center">
                        <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-400" />
                        <p className="text-slate-400">Generating card art...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center bg-slate-800 rounded-lg">
                      <div className="text-center">
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                        <p className="text-slate-400">Card preview will appear here</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900 border-slate-800 h-[600px] flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <Layers className="w-16 h-16 mx-auto mb-4" />
                  <p>Select a card from the gallery to view details</p>
                </div>
              </Card>
            )}

            {/* Gallery */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Card Gallery ({concepts.length})</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {concepts.filter(c => c.status === 'completed').length} Complete
                    </Badge>
                    <Badge variant="outline" className="text-xs text-yellow-400">
                      {concepts.filter(c => c.status === 'generating').length} Generating
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {concepts.map((concept) => (
                      <button
                        key={concept.id}
                        onClick={() => setSelectedConcept(concept)}
                        className={`aspect-[2/3] rounded-lg border-2 overflow-hidden transition-all ${
                          selectedConcept?.id === concept.id 
                            ? 'border-purple-500 ring-2 ring-purple-500/30' 
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {concept.generatedImageUrl ? (
                          <img 
                            src={concept.generatedImageUrl} 
                            alt={concept.name}
                            className="w-full h-full object-cover"
                          />
                        ) : concept.status === 'generating' ? (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                          </div>
                        ) : concept.status === 'error' ? (
                          <div className="w-full h-full bg-red-900/30 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                            <span className="text-xs text-slate-500 text-center px-1">
                              {concept.name.slice(0, 10)}...
                            </span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
