import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import ParticleBackground from './components/ParticleBackground';
import ChatBar from './components/ChatBar';
import Toolbar from './components/Toolbar';
import WindowManager from './components/WindowManager';
import MobileLayout from './components/MobileLayout';
import { LayoutToggle } from './components/LayoutToggle';
import SetupPage from './pages/SetupPage';
import AuthPage from './pages/AuthPage';
import CinematicIntro from './components/CinematicIntro';
import ParticleTextAnimation from './components/ParticleTextAnimation';
import { Toaster } from './components/ui/sonner';
import { LeftSidebar, RightSidebar } from './components/Sidebar';
import AvatarButton from './components/AvatarButton';
import OnboardingWizard, { HelpButton } from './components/OnboardingWizard';
import TipsWidget from './components/TipsWidget';
import CommandPalette from './components/CommandPalette';
import AuraChatHistory from './components/AuraChatHistory';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useLayoutMode } from './hooks/useLayoutMode';
import { toast } from 'sonner';
import { MessageSquare, Shield, Smartphone } from 'lucide-react';
import { AIOrchestrator } from './utils/AIOrchestrator';
import { smartChat } from './services/aiService';
import { auth, isFirebaseConfigured } from './config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { loadUserPrefs, saveUserPref, recordSession } from './services/userService';
// Nova — persistent AI companion (always visible, kernel-connected)
const NovaChatFloating = lazy(() => import('./components/windows/NovaChatWindow'));
import { kernelStorage } from './kernel/kernelStorage.js';

// Lazy load window components for mobile layout
const windowComponents = {
  ide: lazy(() => import('./components/windows/IDEWindow')),
  'website-builder': lazy(() => import('./components/windows/WebsiteBuilderWindow')),
  browser: lazy(() => import('./components/windows/BrowserWindow')),
  media: lazy(() => import('./components/windows/MediaWindow')),
  'media-library': lazy(() => import('./components/windows/MediaLibraryWindow')),
  voice: lazy(() => import('./components/windows/VoiceChatWindow')),
  terminal: lazy(() => import('./components/windows/TerminalWindow')),
  'ai-assistant': lazy(() => import('./components/windows/AIAssistantWindow')),
  'vertex': lazy(() => import('./components/windows/VertexAIWindow')),
  'bg-remover': lazy(() => import('./components/windows/BackgroundRemoverWindow')),
  'appstore': lazy(() => import('./components/windows/AppStoreWindow')),
  'profile': lazy(() => import('./components/windows/ProfileWindow')),
  'game': lazy(() => import('./components/windows/GameWindow')),
  'literature-ide': lazy(() => import('./components/windows/LiteratureIDEWindow')),
  'games-arena': lazy(() => import('./components/windows/GamesArenaWindow')),
  'music-composer': lazy(() => import('./components/windows/MusicComposerWindow')),
  'poems': lazy(() => import('./components/windows/PoemsCreatorWindow')),
  'aetherium-tcg': lazy(() => import('./components/windows/AetheriumTCGWindow')),
  'comic-creator': lazy(() => import('./components/windows/ComicCreatorWindow')),
  'art-studio': lazy(() => import('./components/windows/ArtStudioWindow')),
  'art-gallery': lazy(() => import('./components/windows/ArtGalleryWindow')),
  'clothing-creator': lazy(() => import('./components/windows/ClothingCreatorWindow')),
  'outfit-generator': lazy(() => import('./components/windows/OutfitGeneratorWindow')),
  'collab-writing': lazy(() => import('./components/windows/CollaborativeWritingWindow')),
  'writing-library': lazy(() => import('./components/windows/WritingLibraryWindow')),
  'script-fusion': lazy(() => import('./components/windows/ScriptFusionWindow')),
  'constructor': lazy(() => import('./components/windows/ConstructorWindow')),
  'creator-studio': lazy(() => import('./components/windows/CreatorStudioWindow')),
  'vibe-coding': lazy(() => import('./components/windows/VibeCodingWindow')),
  'workspace': lazy(() => import('./components/windows/WorkspaceWindow')),
  'avatar-builder': lazy(() => import('./components/windows/AvatarBuilderWindow')),
  'live-broadcast': lazy(() => import('./components/windows/LiveBroadcastWindow')),
  'dojo': lazy(() => import('./components/windows/DojoWindow')),
  'challenges': lazy(() => import('./components/windows/ChallengesWindow')),
  'psychometrics': lazy(() => import('./components/windows/PsychometricsWindow')),
  'ai-companion': lazy(() => import('./components/windows/AICompanionWindow')),
  'notifications': lazy(() => import('./components/windows/NotificationsWindow')),
  'avatar-gallery': lazy(() => import('./components/windows/AvatarGalleryWindow')),
  'outfit-manager': lazy(() => import('./components/windows/OutfitManagerWindow')),
  'inventory': lazy(() => import('./components/windows/InventoryWindow')),
  'tax-filing': lazy(() => import('./components/windows/TaxFilingWindow')),
  'admin-panel': lazy(() => import('./components/windows/AdminPanelWindow')),
  'personalization': lazy(() => import('./components/windows/PersonalizationWindow')),
  'secrets': lazy(() => import('./components/windows/SecretsWindow')),
  'social': lazy(() => import('./components/windows/SocialNetworkWindow')),
  'git': lazy(() => import('./components/windows/GitWindow')),
  'billing': lazy(() => import('./components/windows/BillingWindow')),
  'files': lazy(() => import('./components/windows/FilesWindow')),
  'pixai': lazy(() => import('./components/windows/PixAIWindow')),
  'business-operator': lazy(() => import('./components/windows/BusinessOperatorWindow')),
  'nova-concierge': lazy(() => import('./components/windows/NovaConciergeWindow')),
  'graphics-settings': lazy(() => import('./components/windows/GraphicsSettingsWindow')),
  'imagen': lazy(() => import('./components/windows/ImagenWindow')),
  'live-ai': lazy(() => import('./components/windows/LiveAIWindow')),
  'weather': lazy(() => import('./components/windows/WeatherWindow')),
  'crypto': lazy(() => import('./components/windows/CryptoWindow')),
  'calculator': lazy(() => import('./components/windows/CalculatorWindow')),
  'gilded-cage': lazy(() => import('./components/games/GildedCageGame')),
  'voice-studio': lazy(() => import('./components/windows/VoiceStudioWindow')),
  'music-studio': lazy(() => import('./components/windows/MusicStudioWindow')),
  'practice-tools': lazy(() => import('./components/windows/PracticeToolsWindow')),
  'glb-game': lazy(() => import('./components/windows/GLBGameWindow')),
  'system-diagnostics': lazy(() => import('./components/windows/SystemDiagnosticsWindow')),
  'nova-chat': lazy(() => import('./components/windows/NovaChatWindow')),
  'security-monitor': lazy(() => import('./components/windows/SecurityMonitorWindow')),
  'card-deck-creator': lazy(() => import('./components/windows/CardDeckCreatorWindow')),
  'avatar-creator': lazy(() => import('./components/windows/LivingAvatarCreator')),
  'business-card': lazy(() => import('./components/windows/BusinessCardWindow')),
  'deploy': lazy(() => import('./components/windows/DeployWindow')),
  'music-tools': lazy(() => import('./components/windows/MusicToolsWindow')),
  'admin-key-hub': lazy(() => import('./components/windows/AdminKeyHubWindow')),
  'user-key-hub': lazy(() => import('./components/windows/UserKeyHubWindow')),
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [llmConfig, setLlmConfig] = useState(null);
  const [windows, setWindows] = useState([]);
  const [particleConfig, setParticleConfig] = useState('idle');
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [nextZIndex, setNextZIndex] = useState(1000);
  const [theme, setTheme] = useState('cosmic');
  const [showOS, setShowOS] = useState(false);
  const [pendingWindow, setPendingWindow] = useState(null);
  const [showAuraHistory, setShowAuraHistory] = useState(false);
  const [auraHistory, setAuraHistory] = useState([]);
  const [promptLibrary, setPromptLibrary] = useState([]);
  const [introComplete, setIntroComplete] = useState(() => {
    // Only show intro once per session
    return sessionStorage.getItem('novaura-intro-shown') === 'true';
  });
  const [showParticleWelcome, setShowParticleWelcome] = useState(() => {
    // Only show particle welcome once per session
    return sessionStorage.getItem('novaura-particles-shown') === 'true';
  });
  const [userTier, setUserTier] = useState('free');
  const orchestratorRef = useRef(null);
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();
  
  // Layout mode for mobile/desktop toggle
  const { 
    layoutMode, 
    isMobile, 
    isDesktop,
    isHeadless,
    isAutoMode,
    setMode, 
    setAuto, 
    toggleMode 
  } = useLayoutMode();

  useEffect(() => {
    // Load saved theme
    const savedTheme = kernelStorage.getItem('novaura-theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    // Restore last session windows (type + title + safe props only)
    try {
      const savedSession = kernelStorage.getItem('novaura_session_windows');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const restored = parsed.map((w, i) => ({
            id: `window-restored-${Date.now()}-${i}`,
            type: w.type,
            title: w.title,
            zIndex: 1000 + i,
            props: w.props || {},
          }));
          setWindows(restored);
          setNextZIndex(1000 + restored.length);
        }
      }
    } catch (e) {
      console.error('Error restoring session windows:', e);
    }
    // Load Aura history and prompt library
    try {
      const savedHistory = kernelStorage.getItem('novaura_aura_history');
      if (savedHistory) setAuraHistory(JSON.parse(savedHistory));
      const savedLibrary = kernelStorage.getItem('novaura_prompt_library');
      if (savedLibrary) setPromptLibrary(JSON.parse(savedLibrary));
    } catch (e) {
      console.error('Error loading Aura memory:', e);
    }
  }, []);

  // Auto-save open windows to session storage whenever they change
  useEffect(() => {
    try {
      const saveable = windows.map(w => ({ type: w.type, title: w.title, props: w.props || {} }));
      kernelStorage.setItem('novaura_session_windows', JSON.stringify(saveable));
    } catch (e) { /* ignore */ }
  }, [windows]);

  // Firebase Auth — sole source of truth. No localStorage bypass.
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get a fresh token (auto-refreshes when expired)
        const token = await firebaseUser.getIdToken().catch(() => firebaseUser.uid);
        kernelStorage.setItem('auth_token', token);
        kernelStorage.setItem('novaura-auth-token', token);

        const userData = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL || null,
          avatar: firebaseUser.photoURL || null,
        };
        kernelStorage.setItem('user_data', JSON.stringify(userData));
        setCurrentUser(userData);
        setIsAuthenticated(true);
        
        // Load user's membership tier
        try {
          const { getUserTier } = await import('./services/creditService');
          const tier = await getUserTier(firebaseUser.uid);
          setUserTier(tier);
        } catch (e) {
          console.log('Could not load user tier:', e);
        }
        
        const savedConfig = kernelStorage.getItem('llm_config');
        if (savedConfig) { setLlmConfig(JSON.parse(savedConfig)); setIsSetupComplete(true); }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        kernelStorage.removeItem('auth_token');
        kernelStorage.removeItem('novaura-auth-token');
        kernelStorage.removeItem('user_data');
      }
    });

    return () => unsubscribe();
  }, []);

  // URL deep-link support — WebOS lives at /os, always show OS
  const location = useLocation();
  useEffect(() => {
    // WebOS is always the OS — the Platform landing page handles /
    setShowOS(true);
  }, []);
  
  // Persist Aura history
  useEffect(() => {
    if (auraHistory.length > 0) {
      kernelStorage.setItem('novaura_aura_history', JSON.stringify(auraHistory));
    }
  }, [auraHistory]);

  const handleAuthComplete = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleSetupComplete = (config) => {
    setLlmConfig(config);
    setIsSetupComplete(true);

    const windowManagerAPI = { openWindow, closeWindow, focusWindow };
    orchestratorRef.current = new AIOrchestrator(windowManagerAPI, toast);

    toast.success('AI Environment Ready!', {
      description: `Using ${config.useLocalLLM ? 'Local LLM + ' : ''}Gemini AI`,
    });
  };

  const openWindow = useCallback((type, title, props = {}) => {
    const newWindow = {
      id: `window-${Date.now()}-${Math.random()}`,
      type,
      title,
      zIndex: nextZIndex,
      props
    };
    setWindows(prev => [...prev, newWindow]);
    setNextZIndex(prev => prev + 1);

    setParticleConfig('active');
    setTimeout(() => setParticleConfig('idle'), 2000);

    return newWindow.id;
  }, [nextZIndex]);

  const closeWindow = useCallback((id) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id) => {
    setWindows(prev => {
      const win = prev.find(w => w.id === id);
      if (!win) return prev;
      const newZIndex = nextZIndex;
      setNextZIndex(newZIndex + 1);
      return prev.map(w => w.id === id ? { ...w, zIndex: newZIndex } : w);
    });
  }, [nextZIndex]);

  // AI chat — routes through centralized service (local LLM or cloud provider)
  const chatWithAI = async (message, taskCategory = 'general') => {
    return await smartChat(message, taskCategory, llmConfig || {});
  };

  const handleChatSubmit = async (message) => {
    setParticleConfig('active');
    setTimeout(() => setParticleConfig('idle'), 1500);

    // Add user message to history
    const userMsg = { role: 'user', text: message, timestamp: Date.now() };
    setAuraHistory(prev => [...prev, userMsg]);

    try {
      toast.loading('AI is processing...', { id: 'ai-response' });

      const responseData = await chatWithAI(message, 'conversations');

      if (responseData.function_calls && orchestratorRef.current) {
        for (const functionCall of responseData.function_calls) {
          await executeFunctionCall(functionCall);
        }
      }

      // Local orchestrator fallback — if AI returned no function calls, try local intent parsing
      if (!responseData.function_calls && orchestratorRef.current) {
        const localResult = await orchestratorRef.current.executeIntent(message);
        if (localResult.success) {
          toast.success(localResult.message, { id: 'ai-response', duration: 3000 });
          // Add Aura response to history
          setAuraHistory(prev => [...prev, { 
            role: 'assistant', 
            text: localResult.message, 
            timestamp: Date.now() 
          }]);
          return;
        }
      }

      if (responseData.response) {
        toast.success(`AI Response (${responseData.source || 'cloud'})`, {
          id: 'ai-response',
          description: responseData.response.substring(0, 300),
          duration: 5000,
        });
        // Add AI response to history
        setAuraHistory(prev => [...prev, { 
          role: 'assistant', 
          text: responseData.response, 
          timestamp: Date.now(),
          source: responseData.source
        }]);
      } else {
        toast.dismiss('ai-response');
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast.error('AI Error', {
        id: 'ai-response',
        description: error.message || 'Failed to get AI response',
      });
      // Add error to history
      setAuraHistory(prev => [...prev, { 
        role: 'assistant', 
        text: `Error: ${error.message}`, 
        timestamp: Date.now(),
        error: true
      }]);
    }
  };

  const executeFunctionCall = async (functionCall) => {
    if (!orchestratorRef.current) return;

    const { name, args } = functionCall;

    try {
      switch (name) {
        case 'open_window':
          openWindow(args.window_type, getWindowTitle(args.window_type), args.params || {});
          break;
        case 'generate_code':
          openWindow('ide', 'Code IDE', { language: args.language, initialCode: `// ${args.description}\n\n` });
          toast.info('IDE opened', { description: 'Ready to code: ' + args.description });
          break;
        case 'browse_web':
          openWindow('browser', 'AI Browser', { initialUrl: args.url || args.search_query, aiMode: args.ai_mode !== false });
          break;
        case 'generate_image':
          openWindow('vertex', 'Vertex AI', { initialPrompt: args.prompt, mode: 'image', aspectRatio: args.aspect_ratio });
          toast.info('Generating image', { description: args.prompt });
          break;
        case 'generate_video':
          openWindow('vertex', 'Vertex AI', { initialPrompt: args.prompt, mode: 'video' });
          toast.info('Generating video', { description: args.prompt });
          break;
        case 'build_website':
          openWindow('website-builder', 'Website Builder', { initialPrompt: args.description, template: args.template, features: args.features });
          toast.info('Website Builder opened', { description: args.description });
          break;
        case 'remove_background':
          openWindow('bg-remover', 'Background Remover', {});
          break;
        case 'execute_terminal_command':
          openWindow('terminal', 'Terminal', { initialCommand: args.command });
          break;
        case 'control_media':
          openWindow('media', 'Media Player', { action: args.action });
          break;
        case 'open_media_library':
          openWindow('media-library', 'Media Library', {});
          break;
        case 'compose_music':
          openWindow('music-composer', 'Music Composer', { initialPrompt: args.prompt, genre: args.genre });
          toast.info('Music Composer opened', { description: args.prompt || args.genre });
          break;
        case 'open_art_studio':
          openWindow('art-studio', 'Art Studio', { initialPrompt: args.prompt, style: args.style });
          break;
        case 'open_literature_ide':
          openWindow('literature-ide', 'Literature IDE', { initialPrompt: args.prompt, genre: args.genre });
          break;
        case 'create_avatar':
          openWindow('avatar-builder', 'Avatar Builder', { initialPrompt: args.prompt });
          break;
        case 'create_comic':
          openWindow('comic-creator', 'Comic Creator', { initialPrompt: args.prompt });
          break;
        case 'design_clothing':
          openWindow('clothing-creator', 'Clothing Creator', { initialPrompt: args.prompt });
          break;
        case 'open_game':
          openWindow('games-arena', 'Games Arena', { gameId: args.game_id });
          break;
        case 'file_taxes':
          openWindow('tax-filing', 'Tax Filing', {});
          break;
        case 'open_chat':
          // Nova is always visible as the floating companion — no window needed
          toast.info('Nova is always available in the bottom-right corner.');
          break;
        case 'voice_call':
          openWindow('voice', 'Voice Chat', {});
          break;
        case 'close_windows':
          if (args.close_all) {
            setWindows([]);
            toast.info('All windows closed');
          } else if (args.window_type) {
            const windowToClose = windows.find(w => w.type === args.window_type);
            if (windowToClose) closeWindow(windowToClose.id);
          }
          break;
        default:
          // Fallback: if the function name matches a window type, just open it
          if (getWindowTitle(name) !== 'Window') {
            openWindow(name, getWindowTitle(name), args || {});
          } else {
            console.warn('Unknown function call:', name);
          }
      }
    } catch (error) {
      console.error('Error executing function:', error);
    }
  };

  const getWindowTitle = (type) => {
    const titles = {
      'ide': 'Cybeni IDE',
      'website-builder': 'Website Builder',
      'browser': 'AI Browser',
      'vertex': 'Vertex AI',
      'bg-remover': 'Background Remover',
      'media': 'Media Player',
      'media-library': 'Media Library',
      'chat': 'AI Chat',
      'voice': 'Voice Chat',
      'terminal': 'Terminal',
      'ai-assistant': 'AI Assistant',
      'literature-ide': 'Literature IDE',
      'games-arena': 'Games Arena',
      'music-composer': 'Music Composer',
      'poems': 'Poems Creator',
      'aetherium-tcg': 'Aetherium TCG',
      'comic-creator': 'Comic Creator',
      'business-card': 'Business Cards',
      'appstore': 'Repo Station',
      'inventory': 'Inventory',
      'profile': 'Profile',
      'game': 'Game',
      'art-studio': 'Art Studio',
      'art-gallery': 'Art Gallery',
      'clothing-creator': 'Clothing Creator',
      'outfit-generator': 'Outfit Generator',
      'collab-writing': 'Collaborative Writing',
      'writing-library': 'Writing Library',
      'script-fusion': 'Script Fusion',
      'constructor': 'Constructor',
      'creator-studio': 'Creator Studio',
      'vibe-coding': 'Vibe Coding',
      'workspace': 'Workspace',
      'avatar-builder': 'Avatar Builder',
      'live-broadcast': 'Live Broadcasting',
      'dojo': 'Dojo',
      'challenges': 'Challenges',
      'psychometrics': 'Psychometrics',
      'notifications': 'Notifications',
      'ai-companion': 'Aura AI',
      'avatar-gallery': 'Avatar Gallery',
      'outfit-manager': 'Outfit Manager',
      'card-deck-creator': 'Deck Creator',
      'tax-filing': 'Tax Filing',
      'admin-panel': 'Admin Panel',
      'personalization': 'Personalization',
      'pricing': 'Pricing & Plans',
      'secrets': 'Secrets Manager',
      'social': 'Community',
      'billing': 'Billing & Plans',
      'git': 'Git',
      'files': 'Files',
      'imagen': 'Imagen',
      'pixai': 'PixAI Art',
      'business-operator': 'Business Operator',
      'nova-concierge': 'Concierge',
      'weather': 'Weather',
      'crypto': 'Crypto Markets',
      'calculator': 'Calculator',
      'system-diagnostics': 'System Diagnostics',
      'nova-chat': 'Nova',
      'security-monitor': 'Sentinel Shield',
      'avatar-creator': 'Living Avatar',
      'live-ai': 'Nova Live',
      'graphics-settings': 'Graphics Settings',
      'gilded-cage': 'The Gilded Cage',
      'voice-studio': 'Voice Studio',
      'music-studio': 'Music Studio',
      'practice-tools': 'Practice Tools',
      'glb-game': 'GLB Game',
      'admin-key-hub': 'Admin Key Hub',
      'user-key-hub': 'User Key Hub',
      'deploy': 'Deploy',
      'music-tools': 'Music Tools',
    };
    return titles[type] || 'Window';
  };

  // Handle launching OS from landing page
  const handleLaunchOS = (windowType) => {
    if (windowType) {
      setPendingWindow(windowType);
    }
    setShowOS(true);
  };

  // Handle login from within OS
  const handleLogin = () => {
    // Clear current session and go to auth
    setIsAuthenticated(false);
    setCurrentUser(null);
    kernelStorage.removeItem('auth_token');
    kernelStorage.removeItem('user_data');
  };
  
  const handleLogout = () => {
    // Clear auth state
    setIsAuthenticated(false);
    setCurrentUser(null);
    kernelStorage.removeItem('auth_token');
    kernelStorage.removeItem('user_data');
    toast.info('Logged out successfully', {
      description: 'See you next time!',
    });
    // Reload to reset app state
    window.location.reload();
  };
  
  // Open pending window from landing page deep-link
  // (must be before conditional returns to satisfy React hooks rules)
  useEffect(() => {
    if (pendingWindow && isSetupComplete) {
      openWindow(pendingWindow, getWindowTitle(pendingWindow));
      setPendingWindow(null);
    }
  }, [isSetupComplete, pendingWindow]);

  // Show cinematic intro on first load
  if (!introComplete) {
    return (
      <CinematicIntro 
        onComplete={() => {
          sessionStorage.setItem('novaura-intro-shown', 'true');
          setIntroComplete(true);
        }} 
      />
    );
  }

  // Auth screen (when launching OS but not authenticated)
  if (!isAuthenticated) {
    return (
      <>
        <AuthPage onAuthComplete={handleAuthComplete} />
        <Toaster position="top-right" />
      </>
    );
  }

  // Setup screen
  if (!isSetupComplete) {
    return (
      <>
        <SetupPage onComplete={handleSetupComplete} />
        <Toaster position="top-right" />
      </>
    );
  }

  // Particle welcome animation
  if (!showParticleWelcome) {
    return (
      <>
        <ParticleTextAnimation 
          userTier={userTier}
          onComplete={() => {
            sessionStorage.setItem('novaura-particles-shown', 'true');
            setShowParticleWelcome(true);
          }}
        />
        <Toaster position="top-right" />
      </>
    );
  }

  // Headless Mode (Tauri mobile / embedded) — kernel runs, no desktop chrome
  if (isHeadless) {
    return (
      <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-xs text-white/30 font-mono">NovAura Kernel — headless mode</p>
          <p className="text-[10px] text-white/20">Kernel ready. Use IPC or API to interact.</p>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  // Mobile Layout Render
  if (isMobile) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-background">
        {/* Particle Background - simplified for mobile */}
        <ParticleBackground config="idle" theme={theme} />
        
        {/* Mobile Layout */}
        <MobileLayout
          windows={windows}
          onOpenWindow={openWindow}
          onCloseWindow={closeWindow}
          onFocusWindow={focusWindow}
          onToggleLayout={toggleMode}
          windowComponents={windowComponents}
        />
        
        <Toaster position="top-center" />
        
        {/* Command Palette - Global Cmd+K */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={closeCommandPalette}
          onSelect={(commandId) => {
            const windowMap = {
              'ide': () => openWindow('ide', 'Cybeni IDE'),
              'terminal': () => openWindow('terminal', 'Terminal'),
              'browser': () => openWindow('browser', 'AI Browser'),
              'git': () => openWindow('git', 'Git'),
              'files': () => openWindow('files', 'Files'),
              'pixai': () => openWindow('pixai', 'PixAI Art Studio'),
              'secrets': () => openWindow('secrets', 'Secrets Manager'),
              'settings': () => openWindow('personalization', 'Settings'),
              'diagnostics': () => openWindow('system-diagnostics', 'System Diagnostics'),
              'nova': () => openWindow('nova-chat', 'Nova'),
              'security': () => openWindow('security-monitor', 'Sentinel Shield'),
              'profile': () => openWindow('profile', 'Profile'),
              'billing': () => openWindow('billing', 'Billing'),
            };
            
            if (windowMap[commandId]) {
              windowMap[commandId]();
              toast.success(`Opened ${commandId}`);
            } else if (commandId === 'dark-mode') {
              const newTheme = theme === 'cosmic' ? 'blue-night' : 'cosmic';
              setTheme(newTheme);
              kernelStorage.setItem('novaura-theme', newTheme);
              document.documentElement.setAttribute('data-theme', newTheme);
              toast.success(`Theme: ${newTheme}`);
            } else if (commandId === 'logout') {
              handleLogout();
            }
          }}
        />
        
        {/* Onboarding Wizard - shows on first launch */}
        <OnboardingWizard 
          onComplete={() => {
            toast.success('You\'re all set! 🎉', {
              description: 'Start by opening an app from the bottom menu.',
            });
          }}
          onSkip={() => {
            toast.info('Skipped onboarding', {
              description: 'You can restart it from Settings > Help.',
            });
          }}
        />
      </div>
    );
  }

  // Desktop Layout Render
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* Particle Background */}
      <ParticleBackground config={particleConfig} theme={theme} />

      {/* Window Manager */}
      <WindowManager
        windows={windows}
        onClose={closeWindow}
        onFocus={focusWindow}
        onOpenWindow={openWindow}
        onAIChat={chatWithAI}
        theme={theme}
        onThemeChange={(newTheme) => {
          setTheme(newTheme);
          kernelStorage.setItem('novaura-theme', newTheme);
          document.documentElement.setAttribute('data-theme', newTheme);
        }}
      />

      {/* Sidebars */}
      <LeftSidebar 
        windowCount={windows.length} 
        onOpenWindow={openWindow}
        onExitToPlatform={() => {
          toast.info('Returning to NovAura Platform...');
          window.location.href = 'https://novaura.life';
        }}
      />
      <RightSidebar 
        onOpenWindow={openWindow} 
        onOpenGame={(gameId, title) => openWindow('game', title, { gameId, title })}
        onLogout={handleLogout}
      />

      {/* Avatar Chat Button — opens Nova chat window for deep conversation */}
      <div className="fixed bottom-28 right-6 z-[850] pointer-events-auto">
        <AvatarButton
          onClick={() => openWindow('nova-chat', 'Nova')}
          mood="idle"
        />
      </div>

      {/* Bottom UI Layer */}
      <div className="fixed bottom-0 left-0 right-0 z-[900] flex flex-col items-center pointer-events-none">
        {/* Toolbar — slides up from behind ChatBar */}
        <div className={`pointer-events-auto transition-all duration-300 ease-in-out ${toolbarOpen ? 'max-h-20 opacity-100 mb-2' : 'max-h-0 opacity-0 overflow-hidden mb-0'}`}>
          <Toolbar onOpenWindow={(type, label) => { openWindow(type, label); setToolbarOpen(false); }} />
        </div>

        {/* Chat Bar with toggle tab */}
        <div className="pointer-events-auto w-full px-6 pb-4">
          <div className="relative">
            <button
              onClick={() => setToolbarOpen(!toolbarOpen)}
              className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-0.5 bg-black/80 border border-white/10 rounded-t-lg text-white/40 hover:text-white/80 hover:border-white/20 transition-all backdrop-blur-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-300 ${toolbarOpen ? 'rotate-180' : ''}`}>
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <ChatBar onSubmit={handleChatSubmit} llmConfig={llmConfig} />
          </div>
        </div>
      </div>
      
      {/* Layout Mode Toggle - Desktop */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000]">
        <LayoutToggle 
          layoutMode={layoutMode}
          isAutoMode={isAutoMode}
          onSetMode={setMode}
          onSetAuto={setAuto}
          onToggle={toggleMode}
          variant="compact"
        />
      </div>

      <Toaster position="top-right" />
      
      {/* Aura Chat History - Top Right Panel */}
      <AuraChatHistory
        isOpen={showAuraHistory}
        onClose={() => setShowAuraHistory(false)}
        messages={auraHistory}
        onSendMessage={handleChatSubmit}
        savedPrompts={promptLibrary}
        onSavePrompt={(prompt) => {
          setPromptLibrary(prev => {
            const exists = prev.some(p => p.text === prompt.text);
            if (exists) return prev;
            const updated = [...prev, prompt];
            kernelStorage.setItem('novaura_prompt_library', JSON.stringify(updated));
            return updated;
          });
        }}
        onDeletePrompt={(promptId) => {
          setPromptLibrary(prev => {
            const updated = prev.filter(p => p.id !== promptId);
            kernelStorage.setItem('novaura_prompt_library', JSON.stringify(updated));
            return updated;
          });
        }}
      />
      
      {/* Auth/Login Button - Top Right */}
      {!isAuthenticated && (
        <button
          onClick={handleLogin}
          className="fixed top-4 right-20 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-black/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all backdrop-blur-sm"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Login</span>
        </button>
      )}

      {/* Aura Memory Toggle Button - Top Right */}
      <button
        onClick={() => setShowAuraHistory(!showAuraHistory)}
        className={`fixed top-4 right-4 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
          showAuraHistory 
            ? 'bg-primary/20 border-primary/40 text-primary' 
            : 'bg-black/50 border-white/10 text-gray-300 hover:bg-white/10'
        } backdrop-blur-sm`}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">Aura Memory</span>
        {promptLibrary.length > 0 && (
          <span className="text-[9px] px-1 rounded bg-primary/30 text-primary">
            {promptLibrary.length}
          </span>
        )}
      </button>
      
      {/* Command Palette - Global Cmd+K */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        onSelect={(commandId) => {
          // Map commands to window openings
          const windowMap = {
            'ide': () => openWindow('ide', 'Cybeni IDE'),
            'terminal': () => openWindow('terminal', 'Terminal'),
            'browser': () => openWindow('browser', 'AI Browser'),
            'git': () => openWindow('git', 'Git'),
            'files': () => openWindow('files', 'Files'),
            'pixai': () => openWindow('pixai', 'PixAI Art Studio'),
            'secrets': () => openWindow('secrets', 'Secrets Manager'),
            'settings': () => openWindow('personalization', 'Settings'),
            'diagnostics': () => openWindow('system-diagnostics', 'System Diagnostics'),
            'nova': () => openWindow('nova-chat', 'Nova'),
            'security': () => openWindow('security-monitor', 'Sentinel Shield'),
            'profile': () => openWindow('profile', 'Profile'),
            'billing': () => openWindow('billing', 'Billing'),
          };
          
          if (windowMap[commandId]) {
            windowMap[commandId]();
            toast.success(`Opened ${commandId}`);
          } else if (commandId === 'dark-mode') {
            const newTheme = theme === 'cosmic' ? 'blue-night' : 'cosmic';
            setTheme(newTheme);
            kernelStorage.setItem('novaura-theme', newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            toast.success(`Theme: ${newTheme}`);
          } else if (commandId === 'logout') {
            handleLogout();
          }
        }}
      />
      
      {/* Onboarding Wizard - shows on first launch */}
      <OnboardingWizard 
        onComplete={() => {
          toast.success('You\'re all set! 🎉', {
            description: 'Start by opening an app from the sidebar.',
          });
        }}
        onSkip={() => {
          toast.info('Skipped onboarding', {
            description: 'You can restart it from Settings > Help.',
          });
        }}
      />
      
      {/* Help Button - always visible */}
      <HelpButton />
      
      {/* Nova — persistent AI companion, always visible, kernel-connected */}
      <Suspense fallback={null}>
        <NovaChatFloating isPopout={true} />
      </Suspense>

      {/* Tips Widget - rotating helpful hints */}
      <TipsWidget />
    </div>
  );
}
