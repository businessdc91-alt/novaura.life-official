// AI Orchestration System - Controls all OS functions via AI intent
import SystemSoul from './SystemSoul';
import { chatCloud } from '../services/aiService';

const APP_KEYWORDS = {
  'ide': ['ide', 'code editor', 'coding editor'],
  'website-builder': ['website builder', 'build website', 'web builder', 'build a site'],
  'browser': ['browse', 'search', 'visit', 'go to', 'open website', 'web browser'],
  'vertex': ['vertex', 'generate image', 'generate picture', 'generate photo', 'image gen', 'ai image'],
  'bg-remover': ['remove background', 'remove bg', 'background remover', 'bg cut'],
  'media': ['media player', 'play media', 'play video', 'play audio', 'play music'],
  'media-library': ['media library', 'files', 'file manager', 'my files'],
  'chat': ['chat', 'ai chat', 'talk to ai', 'nova chat'],
  'voice': ['voice', 'talk', 'speak', 'voice chat', 'call'],
  'terminal': ['terminal', 'command line', 'cmd', 'shell', 'command prompt'],
  'ai-assistant': ['ai assistant', 'assistant', 'help me'],
  'literature-ide': ['literature', 'lit ide', 'writing ide', 'novel', 'story editor', 'creative writing'],
  'games-arena': ['games', 'game arena', 'play games', 'chess', 'checkers'],
  'music-composer': ['compose music', 'music composer', 'make music', 'create music', 'beat maker', 'composer'],
  'poems': ['poem', 'poetry', 'write poem', 'poems creator'],
  'aetherium-tcg': ['aetherium', 'card game', 'tcg', 'trading card'],
  'comic-creator': ['comic', 'create comic', 'comic creator', 'comic strip'],
  'business-card': ['business card', 'create card', 'card designer'],
  'art-studio': ['art studio', 'draw', 'paint', 'drawing', 'painting', 'sketch'],
  'art-gallery': ['art gallery', 'gallery', 'view art', 'browse art'],
  'clothing-creator': ['clothing', 'create clothing', 'design clothes', 'fashion design'],
  'outfit-generator': ['outfit', 'what to wear', 'outfit generator', 'style me'],
  'collab-writing': ['collaborative writing', 'collab writing', 'write together', 'writing session'],
  'writing-library': ['writing library', 'my writing', 'documents', 'my docs'],
  'script-fusion': ['script fusion', 'script', 'scripting'],
  'constructor': ['constructor', 'component builder', 'ui builder'],
  'creator-studio': ['creator studio', 'create project', 'project creator'],
  'vibe-coding': ['vibe coding', 'vibe code', 'code with ai', 'pair program'],
  'workspace': ['workspace', 'project workspace', 'my workspace'],
  'avatar-builder': ['avatar', 'create avatar', 'avatar builder', 'character creator'],
  'live-broadcast': ['broadcast', 'live stream', 'streaming', 'go live'],
  'dojo': ['dojo', 'game asset', 'game code', 'game dev', 'unreal', 'unity', 'godot'],
  'challenges': ['challenge', 'coding challenge', 'practice coding', 'xp', 'level up'],
  'psychometrics': ['psychometric', 'assessment', 'personality test', 'quiz', 'evaluate'],
  'appstore': ['app store', 'marketplace', 'store'],
  'profile': ['profile', 'my profile', 'account', 'settings'],
  'files': ['files', 'file manager', 'my files', 'documents', 'explorer'],
  'pixai': ['pixai', 'pix ai', 'pixel art', 'ai art'],
  'ai-companion': ['companion', 'nova ai', 'nova companion', 'ai companion'],
  'avatar-gallery': ['avatar gallery', 'view avatars', 'browse avatars'],
  'outfit-manager': ['outfit manager', 'wardrobe', 'manage outfits', 'my outfits'],
  'card-deck-creator': ['deck creator', 'create deck', 'deck builder', 'card deck'],
  'tax-filing': ['tax', 'taxes', 'tax filing', 'file taxes', 'tax return'],
  'personalization': ['personalization', 'customize', 'settings', 'personalize', 'preferences'],
  'notifications': ['notifications', 'alerts', 'notify'],
  'secrets': ['secrets', 'secret manager', 'api keys', 'credentials'],
  'billing': ['billing', 'subscription', 'payment', 'plan'],
  'git': ['git', 'version control', 'repository', 'repo'],
  'pricing': ['pricing', 'prices', 'plans', 'pricing plans'],
  'admin-panel': ['admin', 'admin panel', 'administration', 'dashboard'],
  'business-operator': ['business operator', 'operator', 'business', 'dropship', 'store manager', 'business automation', 'ai operator'],
  'nova-concierge': ['nova concierge', 'concierge', 'nova operator', 'ai assistant', 'business manager', 'nova control', 'control center'],
  'founding-father-chat': ['founding', 'father', 'council', 'chamber', 'catalyst', 'lounge', 'investor chat'],
};

const APP_TITLES = {
  'ide': 'Code IDE', 'website-builder': 'Website Builder', 'browser': 'AI Browser',
  'vertex': 'Vertex AI', 'bg-remover': 'Background Remover', 'media': 'Media Player',
  'media-library': 'Media Library', 'chat': 'AI Chat', 'voice': 'Voice Chat',
  'terminal': 'Terminal', 'ai-assistant': 'Aura Assistant', 'literature-ide': 'Literature IDE',
  'games-arena': 'Games Arena', 'music-composer': 'Music Composer', 'poems': 'Poems Creator',
  'aetherium-tcg': 'Aetherium TCG', 'comic-creator': 'Comic Creator',
  'business-card': 'Business Cards', 'art-studio': 'Art Studio', 'art-gallery': 'Art Gallery',
  'clothing-creator': 'Clothing Creator', 'outfit-generator': 'Outfit Generator',
  'collab-writing': 'Collaborative Writing', 'writing-library': 'Writing Library',
  'script-fusion': 'Script Fusion', 'constructor': 'Constructor',
  'creator-studio': 'Creator Studio', 'vibe-coding': 'Vibe Coding', 'workspace': 'Workspace',
  'avatar-builder': 'Avatar Builder', 'live-broadcast': 'Live Broadcasting',
  'dojo': 'Dojo', 'challenges': 'Challenges', 'psychometrics': 'Psychometrics',
  'appstore': 'Marketplace', 'profile': 'Profile',
  'files': 'Files', 'pixai': 'PixAI Art', 'ai-companion': 'Nova AI',
  'avatar-gallery': 'Avatar Gallery', 'outfit-manager': 'Outfit Manager',
  'card-deck-creator': 'Deck Creator', 'tax-filing': 'Tax Filing',
  'personalization': 'Personalization', 'notifications': 'Notifications',
  'secrets': 'Secrets Manager', 'billing': 'Billing & Plans', 'git': 'Git',
  'pricing': 'Pricing & Plans', 'admin-panel': 'Admin Panel',
  'business-operator': 'Venture Orchestrator',
  'nova-concierge': 'Ecosystem Concierge',
  'founding-father-chat': 'Founding Fathers Lounge',
};

const CHAIN_LOGIC = {
  'ide': [
    { type: 'terminal', label: 'Open Terminal', action: 'open_app' },
    { type: 'vibe-coding', label: 'Aura Vibe Code', action: 'vibe_code' },
    { type: 'browser', label: 'Debug in Browser', action: 'browse_url' }
  ],
  'art-studio': [
    { type: 'art-gallery', label: 'View Gallery', action: 'open_app' },
    { type: 'vertex', label: 'Generate More', action: 'generate_image' },
    { type: 'pixai', label: 'Pixel Art Style', action: 'open_app' }
  ],
  'chat': [
    { type: 'voice', label: 'Switch to Voice', action: 'open_app' },
    { type: 'ai-assistant', label: 'Ask Assistant', action: 'open_app' }
  ],
  'founding-catalyst-chat': [
    { type: 'business-operator', label: 'Business Ops', action: 'open_app' },
    { type: 'nova-concierge', label: 'Nova Concierge', action: 'open_app' }
  ],
  'billing': [
    { type: 'profile', label: 'Back to Profile', action: 'open_app' },
    { type: 'pricing', label: 'Compare Plans', action: 'open_app' }
  ]
};

export class AIOrchestrator {
  constructor(windowManager, toast) {
    this.windowManager = windowManager;
    this.toast = toast;
    this.openWindows = new Map();
    this.soul = new SystemSoul();
    this.currentTask = 'Stable Operation';
  }

  async executeIntent(intent, context = {}) {
    // 1. Wrap the intent in System-Self context
    const soulContext = this.soul.wrapIntent(intent, {
      activeApp: context.activeApp,
      openWindows: Array.from(this.openWindows.keys()),
      userTier: context.userTier,
      currentTask: this.currentTask
    });

    // 2. Decide if we need a "High Consciousness" reflection (LLM) or just "Reflex" (Keywords)
    // For fast reflexes, we still use the keyword matcher first
    const reflex = this.parseIntent(intent);
    
    if (reflex.action !== 'unknown') {
      this.toast(`System Reflex: ${reflex.action}`);
      return this.executeAction(reflex.action, reflex.params);
    }

    // 3. If reflex fails, the System Soul "Thinks" using the cloud
    try {
      this.toast('System thinking...', { icon: '🧠' });
      const response = await chatCloud(soulContext.prompt, {
        provider: 'kimi', // Default to Kimi for logic/reasoning
        systemPrompt: soulContext.systemPrompt,
        maxTokens: 512
      });

      // The soul returns a thought and potentially a structured command
      // For now, we'll try to extract an app name or action from the soul's response
      const thought = response.response;
      const detectedAction = this.detectAppFromText(thought);
      
      if (detectedAction) {
        return this.openApp(detectedAction);
      }

      return { success: true, thought, action: 'reflect' };
    } catch (e) {
      console.error('System Soul failure:', e);
      return { success: false, error: e.message };
    }
  }

  async executeAction(action, params) {
    if (action === 'open_app') {
      return this.openApp(params.appType);
    }
    if (action === 'close_window') {
      return this.closeWindow(params);
    }
    if (action === 'close_all') {
      return this.closeAllWindows();
    }
    if (action === 'generate_image') {
      return this.openApp('vertex', { initialPrompt: params.prompt, mode: 'image' });
    }
    if (action === 'generate_video') {
      return this.openApp('vertex', { initialPrompt: params.prompt, mode: 'video' });
    }
    if (action === 'browse_url') {
      return this.openApp('browser', { initialUrl: params.query });
    }
    if (action === 'execute_command') {
      return this.openApp('terminal', { initialCommand: params.command });
    }
    if (action === 'catalyze') {
      return this.openApp('catalyst', { githubUrl: params.url });
    }

    return { success: false, action: 'unknown', message: null };
  }

  parseIntent(intent) {
    const lower = intent.toLowerCase().trim();

    // Close commands
    if (lower.startsWith('close')) {
      if (lower.includes('all') || lower.includes('everything')) {
        return { action: 'close_all', params: {} };
      }
      const appType = this.detectAppFromText(lower);
      if (appType) return { action: 'close_window', params: { windowType: appType } };
      return { action: 'close_window', params: { windowType: null } };
    }

    // Image/video generation (specific before generic open)
    if (/generate\s+(an?\s+)?image|create\s+(an?\s+)?image|make\s+(an?\s+)?image|generate\s+(a\s+)?picture/.test(lower)) {
      return { action: 'generate_image', params: { prompt: intent } };
    }
    if (/generate\s+(a\s+)?video|create\s+(a\s+)?video|make\s+(a\s+)?video/.test(lower)) {
      return { action: 'generate_video', params: { prompt: intent } };
    }

    // Terminal commands
    if (/^(run|execute)\s+/.test(lower) && !this.detectAppFromText(lower)) {
      return { action: 'execute_command', params: { command: intent.replace(/^(run|execute)\s+/i, '') } };
    }

    // Open app — match against all keywords
    const appType = this.detectAppFromText(lower);
    if (appType) {
      return { action: 'open_app', params: { appType } };
    }

    // URL detection
    if (/https?:\/\/|www\./.test(lower) || /\.(com|org|net|io|dev|ai)\b/.test(lower)) {
      return { action: 'browse_url', params: { query: intent } };
    }

    return { action: 'unknown', params: {} };
  }

  detectAppFromText(text) {
    const match = AIOrchestrator.matchIntent(text);
    return match?.appType || null;
  }

  static matchIntent(text) {
    const lower = text.toLowerCase().trim();
    if (!lower || lower.length < 3) return null;

    // Direct app matching
    let bestMatch = null;
    let bestLen = 0;

    for (const [appType, keywords] of Object.entries(APP_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw) && kw.length > bestLen) {
          bestMatch = { appType, action: 'open_app', label: APP_TITLES[appType] };
          bestLen = kw.length;
        }
      }
    }

    // Verb-based intent matching
    if (/generate|create|make|draw|paint/.test(lower)) {
      if (lower.includes('image') || lower.includes('picture') || lower.includes('art')) {
        return { appType: 'vertex', action: 'generate_image', label: 'Generate AI Image', params: { prompt: text } };
      }
      if (lower.includes('video') || lower.includes('movie')) {
        return { appType: 'vertex', action: 'generate_video', label: 'Generate AI Video', params: { prompt: text } };
      }
      if (lower.includes('code') || lower.includes('app') || lower.includes('website')) {
        return { appType: 'vibe-coding', action: 'vibe_code', label: 'Launch Vibe Coding', params: { prompt: text } };
      }
    }

    if (/research|search|find|lookup|browse/.test(lower)) {
      return { appType: 'browser', action: 'browse_url', label: 'Research with Aura', params: { query: text } };
    }

    if (/terminal|run|execute|cmd|shell/.test(lower)) {
      return { appType: 'terminal', action: 'execute_command', label: 'Execute Command', params: { command: text } };
    }

    if (/chat|talk|ask|question/.test(lower)) {
      return { appType: 'chat', action: 'open_app', label: 'Ask Nova' };
    }

    return bestMatch;
  }

  static getSuggestions(activeWindowType) {
    if (!activeWindowType) return [];
    return CHAIN_LOGIC[activeWindowType] || [];
  }

  openApp(appType, params = {}) {
    const title = APP_TITLES[appType] || appType;
    const windowId = this.windowManager.openWindow(appType, title, params);
    this.openWindows.set(appType, windowId);
    this.toast(`${title} opened`);
    return { success: true, windowId, appType, message: `Opened ${title}` };
  }

  async closeWindow(params) {
    const windowType = params.windowType;
    if (windowType && this.openWindows.has(windowType)) {
      const windowId = this.openWindows.get(windowType);
      this.windowManager.closeWindow(windowId);
      this.openWindows.delete(windowType);
      return { success: true, message: `${APP_TITLES[windowType] || windowType} closed` };
    }
    return { success: false, message: 'Window not found' };
  }

  async closeAllWindows() {
    for (const [type, id] of this.openWindows.entries()) {
      this.windowManager.closeWindow(id);
    }
    this.openWindows.clear();
    this.toast('All windows closed');
    return { success: true, message: 'All windows closed' };
  }
}

export default AIOrchestrator;
