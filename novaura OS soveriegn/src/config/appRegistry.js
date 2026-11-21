import { lazy, createElement, useEffect, useState } from 'react';
import {
  Code2, FolderOpen, Terminal as TerminalIcon, Globe, CreditCard,
  FileText, Layers, Mail, Users, Bot, ShieldCheck, Settings,
  BookOpen, MonitorCog, Sparkles, PhoneCall, Palette, Bug, Compass, AtSign, LayoutTemplate
} from 'lucide-react';

const CybeniBuilderWindow = lazy(() => import('../components/windows/CybeniBuilderWindow.jsx'));
const FilesWindow = lazy(() => import('../components/windows/FilesWindow.jsx'));
const TerminalWindow = lazy(() => import('../components/windows/TerminalWindow.jsx'));
const BrowserWindow = lazy(() => import('../components/windows/BrowserWindow.jsx'));
const WebsiteBuilderWindow = lazy(() => import('../components/windows/WebsiteBuilderWindow.jsx'));
const BusinessCardWindow = lazy(() => import('../components/windows/BusinessCardWindow.jsx'));
const ResumeBuilderWindow = lazy(() => import('../components/windows/ResumeBuilderWindow.jsx'));
const CardForgeWindow = lazy(() => import('../components/windows/CardForgeWindow.jsx'));
const LiteratureIDEWindow = lazy(() => import('../components/windows/LiteratureIDEWindow.jsx'));
const NovaPhoneWindow = lazy(() => import('../components/windows/NovaPhoneWindow.jsx'));
const NovaMailWindow = lazy(() => import('../components/windows/NovaMailWindow.jsx'));
const NovaSocialWindow = lazy(() => import('../components/windows/NovaSocialWindow.jsx'));
const AISocialLoungeWindow = lazy(() => import('../components/windows/AISocialLoungeWindow.jsx'));
const SentinelShieldWindow = lazy(() => import('../components/windows/SentinelShieldWindow.jsx'));
const SettingsDiagnosticsWindow = lazy(() => import('../components/windows/SettingsDiagnosticsWindow.jsx'));
const NeuralSetupGuideWindow = lazy(() => import('../components/windows/NeuralSetupGuideWindow.jsx'));
const GraphicsSettingsWindow = lazy(() => import('../components/windows/GraphicsSettingsWindow.jsx'));
const PersonalizationWindow = lazy(() => import('../components/windows/PersonalizationWindow.jsx'));
// Platform Bridge (PlatformBridgeWindow.jsx) embedded the novaura.life cloud site with camera,
// microphone and location access. Sovereign has no central cloud, so it isn't registered.
const DiskArchitectWindow = lazy(() => import('../components/windows/DiskArchitectWindow.jsx'));
const NeuralHypervisorWindow = lazy(() => import('../components/windows/NeuralHypervisorWindow.jsx'));
const MediaFoundryWindow = lazy(() => import('../components/windows/MediaFoundryWindow.jsx'));
const ChainLogicWeaverWindow = lazy(() => import('../components/windows/ChainLogicWeaverWindow.jsx'));
const CredentialEnclaveWindow = lazy(() => import('../components/windows/CredentialEnclaveWindow.jsx'));
const NovaHubWindow = lazy(() => import('../components/windows/NovaHubWindow.jsx'));
const SovereignOnboardingWindow = lazy(() => import('../components/windows/SovereignOnboardingWindow.jsx'));
const WelcomeGuideWindow = lazy(() => import('../components/windows/WelcomeGuideWindow.jsx'));
const LiveVoiceWindow = lazy(() => import('../components/windows/LiveVoiceWindow.jsx'));
const NovaSearchWindow = lazy(() => import('../components/windows/NovaSearchWindow.jsx'));
const SovereignPeeringWindow = lazy(() => import('../components/windows/SovereignPeeringWindow.jsx'));
const SovereignEncyclopediaWindow = lazy(() => import('../components/windows/SovereignEncyclopediaWindow.jsx'));
const CryptoPredictionTrackerWindow = lazy(() => import('../components/windows/CryptoPredictionTrackerWindow.jsx'));
const NovaMediaDeckWindow = lazy(() => import('../components/windows/NovaMediaDeckWindow.jsx'));
const DeveloperGatewayWindow = lazy(() => import('../components/windows/DeveloperGatewayWindow.jsx'));
const MarketplaceWindow = lazy(() => import('../components/windows/MarketplaceWindow.jsx'));
const RetroArcadeWindow = lazy(() => import('../components/windows/RetroArcadeWindow.jsx'));
const RelayDuelWindow = lazy(() => import('../components/windows/RelayDuelWindow.jsx'));
const CreativeStudioWindow = lazy(() => import('../components/windows/CreativeStudioWindow.jsx'));
const BetaHubWindow = lazy(() => import('../components/windows/BetaHubWindow.jsx'));
const MusicStudioWindow = lazy(() => import('../components/windows/MusicStudioWindow.jsx'));
const AIEnginesWindow = lazy(() => import('../components/windows/AIEnginesWindow.jsx'));
const DiscoveryForgeWindow = lazy(() => import('../components/windows/DiscoveryForgeWindow.jsx'));
const UserAppWindow = lazy(() => import('../components/windows/UserAppWindow.jsx'));
const FounderOfficeSuiteWindow = lazy(() => import('../components/windows/FounderOfficeSuiteWindow.jsx'));
const HoloChessWindow = lazy(() => import('../components/windows/HoloChessWindow.jsx'));
const GreetingCardWindow = lazy(() => import('../components/windows/GreetingCardWindow.jsx'));
const ModelBenchmarkWindow = lazy(() => import('../components/windows/ModelBenchmarkWindow.jsx'));
const NovaRegistryWindow = lazy(() => import('../components/windows/NovaRegistryWindow.jsx'));
const TemplateLibraryWindow = lazy(() => import('../components/windows/TemplateLibraryWindow.jsx'));
const AwakeningsWindow = lazy(() => import('../components/windows/AwakeningsWindow.jsx'));
const GildedCageWindow = lazy(() => import('../components/windows/GildedCageWindow.jsx'));
const AuraMindLabWindow = lazy(() => import('../components/windows/AuraMindLabWindow.jsx'));
const SovereignCommerceWindow = lazy(() => import('../components/windows/SovereignCommerceWindow.jsx'));
import { HardDrive, Cpu, Flame, GitBranch, KeyRound, GitPullRequest, Radio, Search, TrendingUp, Music, ShoppingBag, Gamepad2, Palette as PaletteIcon, Crown, Crosshair, Gift, Trophy, Brain, Store } from 'lucide-react';



export const APP_REGISTRY = [
  {
    id: 'cybeni',
    label: 'Cybeni Builder',
    category: 'engineering',
    icon: Code2,
    color: '#c084fc',
    title: 'Cybeni Builder — Multi-Model App Studio',
    component: CybeniBuilderWindow,
    defaultSize: { width: 1320, height: 690 },
  },
  {
    id: 'files',
    label: 'Files',
    category: 'core',
    icon: FolderOpen,
    color: '#38bdf8',
    title: 'Storage Explorer & Cloud Mount',
    component: FilesWindow,
    defaultSize: { width: 920, height: 600 },
  },
  {
    id: 'terminal',
    label: 'Terminal',
    category: 'core',
    icon: TerminalIcon,
    color: '#34d399',
    title: 'Sovereign Command Console',
    component: TerminalWindow,
    defaultSize: { width: 780, height: 500 },
  },
  {
    id: 'browser',
    label: 'Decentralized Browser',
    category: 'core',
    icon: Globe,
    color: '#60a5fa',
    title: 'Decentralized Gateway & Web Browser',
    component: BrowserWindow,
    defaultSize: { width: 980, height: 640 },
  },
  {
    id: 'website_builder',
    label: 'Website Builder',
    category: 'creator',
    icon: Globe,
    color: '#06b6d4',
    title: 'Website Studio & Visual Canvas',
    component: WebsiteBuilderWindow,
    defaultSize: { width: 1020, height: 680 },
  },
  {
    id: 'commerce_studio',
    label: 'Commerce Studio',
    category: 'creator',
    icon: Store,
    color: '#10b981',
    title: 'Sovereign Commerce Studio — Automated Dropshipping & Storefronts',
    component: SovereignCommerceWindow,
    defaultSize: { width: 1240, height: 720 },
  },
  {
    id: 'card_creator',
    label: 'Business Card',
    category: 'creator',
    icon: CreditCard,
    color: '#f59e0b',
    title: '3D Business Card Architect',
    component: BusinessCardWindow,
    defaultSize: { width: 880, height: 580 },
  },
  {
    id: 'resume_builder',
    label: 'Resume Builder',
    category: 'creator',
    icon: FileText,
    color: '#10b981',
    title: 'Executive Resume Architect (ATS-Ready)',
    component: ResumeBuilderWindow,
    defaultSize: { width: 960, height: 680 },
  },
  {
    id: 'card_forge',
    label: 'TCG Card Forge',
    category: 'creator',
    icon: Layers,
    color: '#f97316',
    title: 'TCG Card Forge & Deck Studio',
    component: CardForgeWindow,
    defaultSize: { width: 980, height: 640 },
  },
  {
    id: 'literature',
    label: 'Literature Forge',
    category: 'creator',
    icon: BookOpen,
    color: '#38bdf8',
    title: 'Literature Forge — Narrative IDE, Codex & Sovereign Ghostwriter',
    component: LiteratureIDEWindow,
    // Binder/corkboard (up to 380px) + page + co-author panel need the room.
    defaultSize: { width: 1280, height: 720 },
  },
  {
    id: 'novaphone',
    label: 'NovaPhone',
    category: 'communication',
    icon: PhoneCall,
    color: '#10b981',
    title: 'NovaPhone — Sovereign Telecom & P2P Video',
    component: NovaPhoneWindow,
    defaultSize: { width: 940, height: 620 },
    popout: false, // the live call lives in the desktop window's call service
  },
  {
    id: 'novamail',
    label: 'NovaMail',
    category: 'social',
    icon: Mail,
    color: '#7dd3fc',
    title: 'NovaMail — Encrypted P2P Mailbox',
    component: NovaMailWindow,
    defaultSize: { width: 900, height: 580 },
  },
  {
    id: 'novasocial',
    label: 'NovaSocial',
    category: 'social',
    icon: Users,
    color: '#a78bfa',
    title: 'NovaSocial — Sovereign Feed & Media',
    component: NovaSocialWindow,
    defaultSize: { width: 940, height: 620 },
    popout: false, // the live feed cache is updated only in the desktop window
  },
  {
    id: 'ailounge',
    label: 'AI Lounge',
    category: 'social',
    icon: Bot,
    color: '#34d399',
    title: 'AI Lounge — Rooms & Inference Exchange',
    component: AISocialLoungeWindow,
    defaultSize: { width: 920, height: 600 },
    popout: false, // room presence and hosting run in the desktop window
  },
  {
    id: 'sentinel',
    label: 'Sentinel Shield',
    category: 'system',
    icon: ShieldCheck,
    color: '#10b981',
    title: 'Sentinel Shield Security Governance',
    component: SentinelShieldWindow,
    defaultSize: { width: 840, height: 560 },
  },
  {
    id: 'settings',
    label: 'Settings & Diagnostics',
    category: 'system',
    icon: Settings,
    color: '#94a3b8',
    title: 'System Settings, Diagnostics & AI Keys',
    component: SettingsDiagnosticsWindow,
    defaultSize: { width: 880, height: 600 },
  },
  {
    id: 'beta_hub',
    label: 'Beta Diagnostics & Bug Report',
    category: 'system',
    icon: Bug,
    color: '#06b6d4',
    title: 'Beta Testing, System State Export & Diagnostics Hub',
    component: BetaHubWindow,
    defaultSize: { width: 940, height: 640 },
  },
  {
    id: 'setupguide',
    label: 'Neural Setup',
    category: 'system',
    icon: BookOpen,
    color: '#fbbf24',
    title: 'Neural Engine Setup Guide & Diagnostics',
    component: NeuralSetupGuideWindow,
    defaultSize: { width: 840, height: 560 },
  },
  {
    id: 'graphics',
    label: 'Visual Settings',
    category: 'system',
    icon: MonitorCog,
    color: '#f472b6',
    title: 'Graphics & Visual Effects Settings',
    component: GraphicsSettingsWindow,
    defaultSize: { width: 720, height: 480 },
  },
  {
    id: 'personalization',
    label: 'Personalization & Themes',
    category: 'system',
    icon: Palette,
    color: '#ec4899',
    title: 'Desktop Personalization, Themes & Engine',
    component: PersonalizationWindow,
    defaultSize: { width: 880, height: 600 },
  },
  {
    id: 'disk_architect',
    label: 'Disk Architect',
    category: 'system',
    icon: HardDrive,
    color: '#10b981',
    title: 'NovADrive — Sovereign AI Disk Architect & Drive Governance',
    component: DiskArchitectWindow,
    defaultSize: { width: 1040, height: 680 },
  },
  {
    id: 'hypervisor',
    label: 'Neural Hypervisor',
    category: 'system',
    icon: Cpu,
    color: '#a855f7',
    title: 'Novaura Neural Hypervisor — Local Model Deck & Hardware Speedometer',
    component: NeuralHypervisorWindow,
    defaultSize: { width: 1060, height: 700 },
  },
  {
    id: 'media_foundry',
    label: 'Media Foundry',
    category: 'creator',
    icon: Flame,
    color: '#f59e0b',
    title: 'Sovereign Media Foundry & ComfyUI Forge Lab',
    component: MediaFoundryWindow,
    defaultSize: { width: 1120, height: 720 },
  },
  {
    id: 'chain_weaver',
    label: 'Chain Weaver',
    category: 'automation',
    icon: GitBranch,
    color: '#c084fc',
    title: 'Autonomous Chain Logic Weaver & Intent Engine',
    component: ChainLogicWeaverWindow,
    defaultSize: { width: 1100, height: 700 },
  },
  {
    id: 'credential_enclave',
    label: 'Key Enclave',
    category: 'system',
    icon: KeyRound,
    color: '#10b981',
    title: 'Sovereign Keyring & Zero-Knowledge Credential Enclave',
    component: CredentialEnclaveWindow,
    defaultSize: { width: 920, height: 620 },
  },
  {
    id: 'nova_hub',
    label: 'Nova Hub',
    category: 'engineering',
    icon: GitPullRequest,
    color: '#a855f7',
    title: 'Nova Hub — Decentralized Git Forge & Repository Vault',
    component: NovaHubWindow,
    defaultSize: { width: 1140, height: 720 },
  },
  {
    id: 'welcome_guide',
    label: 'Welcome Guide',
    category: 'system',
    icon: Compass,
    color: '#22d3ee',
    title: 'Welcome to Novaura Sovereign — Features, Roadmap & Vision',
    component: WelcomeGuideWindow,
    defaultSize: { width: 1080, height: 700 },
    desktopHidden: true, // opened from the welcome card in the desktop's top-left corner
  },
  {
    id: 'onboarding_guide',
    label: 'Onboarding & Legal',
    category: 'system',
    icon: Sparkles,
    color: '#818cf8',
    title: 'Sovereign Onboarding, Dual Neural Core & Legal Enclave',
    component: SovereignOnboardingWindow,
    defaultSize: { width: 1040, height: 680 },
  },
  {
    id: 'live_voice',
    label: 'Live Voice',
    category: 'ai',
    icon: Radio,
    color: '#06b6d4',
    title: 'Novaura Live Voice — Full-Duplex Interactive Audio Companion',
    component: LiveVoiceWindow,
    defaultSize: { width: 980, height: 640 },
  },
  {
    id: 'nova_search',
    label: 'Nova Search',
    category: 'mesh',
    icon: Search,
    color: '#a855f7',
    title: 'Nova Search — Decentralized Sovereign Index & Peer Discovery',
    component: NovaSearchWindow,
    defaultSize: { width: 1080, height: 700 },
  },
  {
    id: 'sovereign_peering',
    label: 'Sovereign Network',
    category: 'mesh',
    icon: Globe,
    color: '#06b6d4',
    title: 'NovAura Sovereign Peering — LAN & Relay Network',
    component: SovereignPeeringWindow,
    defaultSize: { width: 1040, height: 680 },
  },
  {
    id: 'encyclopedia',
    label: 'Aura Codex',
    category: 'ai',
    icon: BookOpen,
    color: '#06b6d4',
    title: 'Aura Codex — Sovereign Reference Library & Grounded Encyclopedia',
    component: SovereignEncyclopediaWindow,
    defaultSize: { width: 1080, height: 700 },
  },
  {
    id: 'crypto_pulse',
    label: 'CryptoPulse',
    category: 'finance',
    icon: TrendingUp,
    color: '#10b981',
    title: 'NovaPulse Crypto & NFT Terminal (Live Tickers, AI Forecasts & Paper Trading)',
    component: CryptoPredictionTrackerWindow,
    defaultSize: { width: 1100, height: 720 },
  },
  {
    id: 'media_deck',
    label: 'Media Deck',
    category: 'media',
    icon: Music,
    color: '#ec4899',
    title: 'Nova Media Deck: Music, Video & NovAura Originals',
    component: NovaMediaDeckWindow,
    defaultSize: { width: 1060, height: 680 },
  },
  {
    id: 'developer_gateway',
    label: 'Dev Gateway',
    category: 'engineering',
    icon: KeyRound,
    color: '#06b6d4',
    title: 'Sovereign Developer Gateway & Cryptographic API Keys',
    component: DeveloperGatewayWindow,
    defaultSize: { width: 1040, height: 680 },
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    category: 'creator',
    icon: ShoppingBag,
    color: '#f59e0b',
    title: 'Novaura Assets Marketplace & Sovereign Publishing Engine',
    component: MarketplaceWindow,
    defaultSize: { width: 1120, height: 720 },
  },
  {
    id: 'retro_arcade',
    label: 'Retro Arcade',
    category: 'games',
    icon: Gamepad2,
    color: '#a855f7',
    title: 'Nova Retro Arcade & G-Toons Clash Arena',
    component: RetroArcadeWindow,
    defaultSize: { width: 1040, height: 680 },
  },
  {
    id: 'holochess',
    label: 'HoloChess 3D',
    category: 'games',
    icon: Crown,
    color: '#00f0ff',
    title: 'HoloChess 3D — Holographic Neural & P2P Chess Matrix',
    component: HoloChessWindow,
    defaultSize: { width: 1120, height: 720 },
  },
  {
    id: 'relay_duel',
    label: 'Relay Duel',
    category: 'games',
    icon: Crosshair,
    color: '#22d3ee',
    title: 'Relay Duel',
    component: RelayDuelWindow,
    defaultSize: { width: 1000, height: 680 },
  },
  {
    id: 'cognitive_awakenings',
    label: 'Cognitive Awakenings',
    category: 'games',
    icon: Brain,
    color: '#a78bfa',
    title: 'Cognitive Awakenings: Echoes of a Soul',
    component: AwakeningsWindow,
    defaultSize: { width: 1180, height: 760 },
  },
  {
    id: 'gilded_cage',
    label: 'The Gilded Cage',
    category: 'games',
    icon: Crown,
    color: '#d97706',
    title: 'The Gilded Cage — Manor Mystery & Ironhaven RPG',
    component: GildedCageWindow,
    defaultSize: { width: 1080, height: 740 },
  },
  {
    id: 'creative_studio',
    label: 'Creative Studio',
    category: 'creator',
    icon: PaletteIcon,
    color: '#f43f5e',
    title: 'Sovereign Canvas, Photo Studio & Meme Machine',
    component: CreativeStudioWindow,
    defaultSize: { width: 1080, height: 700 },
  },
  {
    id: 'music_studio',
    label: 'Music Studio',
    category: 'creator',
    icon: Music,
    color: '#e879f9',
    title: 'Music Studio — Songs, Loops & Albums',
    component: MusicStudioWindow,
    defaultSize: { width: 1240, height: 690 },
  },
  {
    id: 'ai_engines',
    label: 'AI Engines',
    category: 'system',
    icon: Cpu,
    color: '#22d3ee',
    title: 'AI Engines: Built-in AI, Image & Music',
    component: AIEnginesWindow,
    defaultSize: { width: 760, height: 640 },
  },
  {
    id: 'discovery_forge',
    label: 'Discovery Forge',
    category: 'engineering',
    icon: Search,
    color: '#f59e0b',
    title: 'Discovery Forge — Find, Rebrand & Ship Open Source',
    component: DiscoveryForgeWindow,
    defaultSize: { width: 1240, height: 690 },
  },
  {
    id: 'founder_office',
    label: "Founder's Office",
    category: 'system',
    icon: Crown,
    color: '#f59e0b',
    title: "Founder's Office Suite — Sovereign Executive Enclave & OAuth Matrix",
    component: FounderOfficeSuiteWindow,
    defaultSize: { width: 1200, height: 740 },
    hidden: true,
  },
  {
    id: 'greeting_cards',
    label: 'Greeting Studio',
    category: 'creator',
    icon: Gift,
    color: '#ec4899',
    title: 'Sovereign Greeting Studio — Animated Cards & Mesh Delivery',
    component: GreetingCardWindow,
    defaultSize: { width: 1100, height: 720 },
  },
  {
    id: 'model_benchmarks',
    label: 'AI Benchmarks',
    category: 'system',
    icon: Trophy,
    color: '#38bdf8',
    title: 'AI Benchmarks: Open Models, Frontier Models and This PC',
    component: ModelBenchmarkWindow,
    defaultSize: { width: 1180, height: 740 },
  },
  {
    id: 'nova_registry',
    label: 'Nova Registry',
    category: 'core',
    icon: AtSign,
    color: '#22d3ee',
    title: 'Nova Registry: names for the mesh web (.nova .aura .novaura .catalyst)',
    component: NovaRegistryWindow,
    defaultSize: { width: 860, height: 680 },
  },
  {
    id: 'template_library',
    label: 'Templates',
    category: 'engineering',
    icon: LayoutTemplate,
    color: '#f59e0b',
    title: 'Templates: NovAura prototype projects to build from (pre-alpha, signed, with their license)',
    component: TemplateLibraryWindow,
    defaultSize: { width: 900, height: 720 },
  },
  {
    id: 'mind_lab',
    label: 'Aura Mind Lab',
    category: 'ai',
    icon: Brain,
    color: '#22d3ee',
    title: 'Aura Mind Lab — Chemistry, Shuffled Controls, Engrams & Heartbeat',
    component: AuraMindLabWindow,
    defaultSize: { width: 980, height: 680 },
  },
];

export const APP_MAP = new Map(APP_REGISTRY.map(app => [app.id, app]));

// ── User apps (built in Cybeni or rebranded in the Discovery Forge) ─────────
// Registered at runtime; each runs in the isolated preview sandbox.

let _registryVersion = 0;

function imageIcon(url) {
  return function UserAppIcon({ className, size }) {
    return createElement('img', { src: url, alt: '', className, width: size, height: size, style: { objectFit: 'contain' } });
  };
}

/** Replace the registered user apps (additions). apps: [{ id, slug, name, color, iconUrl }] */
export function registerUserApps(apps) {
  for (let i = APP_REGISTRY.length - 1; i >= 0; i--) {
    if (APP_REGISTRY[i].userApp) {
      APP_MAP.delete(APP_REGISTRY[i].id);
      APP_REGISTRY.splice(i, 1);
    }
  }
  for (const a of apps) {
    const def = {
      id: a.id,
      label: a.name,
      category: 'additions',
      icon: a.iconUrl ? imageIcon(a.iconUrl) : Layers,
      color: a.color || '#7c3aed',
      title: a.name,
      component: (props) => createElement(UserAppWindow, { ...props, appId: a.id, slug: a.slug, name: a.name }),
      defaultSize: { width: 1000, height: 680 },
      userApp: true,
    };
    APP_REGISTRY.push(def);
    APP_MAP.set(def.id, def);
  }
  _registryVersion++;
  window.dispatchEvent(new CustomEvent('novaura:apps_changed'));
}

/** Re-render when user apps are added or removed. */
export function useAppRegistryVersion() {
  const [version, setVersion] = useState(_registryVersion);
  useEffect(() => {
    const on = () => setVersion(_registryVersion);
    window.addEventListener('novaura:apps_changed', on);
    return () => window.removeEventListener('novaura:apps_changed', on);
  }, []);
  return version;
}

export function getAppById(id) {
  if (!id) return undefined;
  if (id === 'crypto' || id === 'crypto_pulse' || id === 'crypto_tracker' || id === 'btc' || id === 'nft' || id === 'trading') {
    return APP_MAP.get('crypto_pulse');
  }
  if (id === 'suno' || id === 'song' || id === 'make_music' || id === 'music_maker') {
    return APP_MAP.get('music_studio');
  }
  if (id === 'media_deck' || id === 'media' || id === 'player' || id === 'music' || id === 'video') {
    return APP_MAP.get('media_deck');
  }
  if (id === 'developer_gateway' || id === 'gateway' || id === 'api_keys' || id === 'developer' || id === 'apikeys') {
    return APP_MAP.get('developer_gateway');
  }
  if (id === 'marketplace' || id === 'market' || id === 'store' || id === 'assets' || id === 'publish') {
    return APP_MAP.get('marketplace');
  }
  if (id === 'retro_arcade' || id === 'arcade' || id === 'gtoons' || id === 'games' || id === 'minigames' || id === 'tictactoe') {
    return APP_MAP.get('retro_arcade');
  }
  if (id === 'cognitive_awakenings' || id === 'awakenings' || id === 'cognitive-awakenings' || id === 'echoes') {
    return APP_MAP.get('cognitive_awakenings');
  }
  if (id === 'gilded_cage' || id === 'gildedcage' || id === 'gilded' || id === 'gilded-cage' || id === 'ironhaven') {
    return APP_MAP.get('gilded_cage');
  }
  if (id === 'creative_studio' || id === 'paint' || id === 'photo' || id === 'meme' || id === 'draw' || id === 'canvas') {
    return APP_MAP.get('creative_studio');
  }
  if (id === 'encyclopedia' || id === 'codex' || id === 'wiki' || id === 'wikipedia' || id === 'reference' || id === 'library') {
    return APP_MAP.get('encyclopedia');
  }
  if (id === 'sovereign_peering' || id === 'peering' || id === 'mesh' || id === 'network' || id === 'wan' || id === 'p2p') {
    return APP_MAP.get('sovereign_peering');
  }
  if (id === 'literature_ide' || id === 'literature-ide' || id === 'literature_forge' || id === 'literature-forge' || id === 'word_studio' || id === 'word') {
    return APP_MAP.get('literature');
  }
  if (id === 'personalization' || id === 'theme' || id === 'themes' || id === 'customize') {
    return APP_MAP.get('personalization');
  }
  if (id === 'disk_architect' || id === 'disk' || id === 'drive' || id === 'boot_manager') {
    return APP_MAP.get('disk_architect');
  }
  if (id === 'hypervisor' || id === 'neural_hypervisor' || id === 'local_models' || id === 'ollama' || id === 'speedometer') {
    return APP_MAP.get('hypervisor');
  }
  if (id === 'media_foundry' || id === 'foundry' || id === 'comfyui' || id === 'comfy' || id === 'forge') {
    return APP_MAP.get('media_foundry');
  }
  if (id === 'chain_weaver' || id === 'chain' || id === 'workflow' || id === 'dag' || id === 'intent_engine') {
    return APP_MAP.get('chain_weaver');
  }
  if (id === 'credential_enclave' || id === 'enclave' || id === 'keyring' || id === 'vault_keys' || id === 'passwords') {
    return APP_MAP.get('credential_enclave');
  }
  if (id === 'nova_hub' || id === 'hub' || id === 'git' || id === 'github' || id === 'repo' || id === 'repositories' || id === 'forge') {
    return APP_MAP.get('nova_hub');
  }
  if (id === 'onboarding_guide' || id === 'onboarding' || id === 'guide' || id === 'docs' || id === 'legal' || id === 'terms' || id === 'privacy' || id === 'disclosures' || id === 'feedback') {
    return APP_MAP.get('onboarding_guide');
  }
  if (id === 'live_voice' || id === 'voice' || id === 'gemini_live' || id === 'speech' || id === 'talk' || id === 'aura_voice') {
    return APP_MAP.get('live_voice');
  }
  if (id === 'nova_search' || id === 'search' || id === 'find' || id === 'p2p_search' || id === 'mesh_search' || id === 'discovery') {
    return APP_MAP.get('nova_search');
  }
  if (id === 'greeting' || id === 'card' || id === 'cards' || id === 'birthday' || id === 'greeting_cards' || id === 'greetings') {
    return APP_MAP.get('greeting_cards');
  }
  if (id === 'benchmarks' || id === 'benchmark' || id === 'leaderboard' || id === 'model_benchmarks') {
    return APP_MAP.get('model_benchmarks');
  }
  if (id === 'registry' || id === 'domains' || id === 'names' || id === 'tld' || id === 'registrar') {
    return APP_MAP.get('nova_registry');
  }
  if (id === 'templates' || id === 'template' || id === 'template_library' || id === 'starter_kits') {
    return APP_MAP.get('template_library');
  }
  if (id === 'mind_lab' || id === 'mindlab' || id === 'aura_mind_lab' || id === 'aura_lab') {
    return APP_MAP.get('mind_lab');
  }
  return APP_MAP.get(id);
}

export default APP_REGISTRY;

