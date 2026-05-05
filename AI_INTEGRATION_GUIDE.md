# 🧠 NovAura AI Integration Guide

> **Purpose:** Machine-readable + human-readable integration specification.
> Feed this document to your AI orchestrator, coding agent, or swarm controller
> to achieve instant alignment with the NovAura codebase.
>
> **Format:** Structured for LLM consumption. Every section includes explicit
> file paths, function signatures, data contracts, and integration patterns.

---

## 📍 Quick Reference — Critical Entry Points

```yaml
project_root: "Novaura platform/"
frontend:     "NovAura-WebOS/src/"
backend:      "NovAura-WebOS/functions/src/"
ai_brain:     "NovAura-WebOS/src/utils/AIOrchestrator.js"
ai_soul:      "NovAura-WebOS/src/utils/SystemSoul.js"
ai_service:   "NovAura-WebOS/src/services/aiService.js"
api_router:   "NovAura-WebOS/functions/src/api/app.ts"
ai_routes:    "NovAura-WebOS/functions/src/api/routes/ai.ts"
build_log:    "novaura_complete_overview_master.json"
```

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER / AI AGENT                          │
│                    (Natural Language Intent)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND (React + Vite)                       │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ SystemSoul   │→ │ AIOrchestrator│→ │ Window Manager       │ │
│  │ (Identity +  │  │ (Intent →     │  │ (78 App Windows)     │ │
│  │  Context)    │  │  Action)      │  │                      │ │
│  └──────────────┘  └───────┬───────┘  └──────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────▼──────────────────────────────────┐ │
│  │                    aiService.js                             │ │
│  │  chatCloud() → Backend proxy for cloud providers            │ │
│  │  chatLocal() → Direct browser-to-Ollama/LMStudio           │ │
│  │  generateImage() / generateVideo() → Vertex AI              │ │
│  │  generateCode() / generateWebsite() → Builder endpoint      │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP POST (Bearer token)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKEND (Firebase Cloud Functions)               │
│                   Express.js — app.ts                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Route Mounts (17 route files):                               ││
│  │  /ai/*        → ai.ts (1898 lines — 15+ providers)          ││
│  │  /auth/*      → auth.ts                                     ││
│  │  /assets/*    → assets.ts (marketplace pipeline)             ││
│  │  /stripe/*    → stripe.ts (payments)                         ││
│  │  /vertex/*    → vertex.ts (Imagen/Veo generation)            ││
│  │  /email/*     → email.ts (SMTP/inbox)                        ││
│  │  /orders/*    → orders.ts                                    ││
│  │  /user/keys/* → user-keys.ts (BYOK encrypted storage)       ││
│  │  /drive/*     → drive.ts (file storage)                      ││
│  │  /music/*     → music.ts                                     ││
│  │  /search/*    → search.ts                                    ││
│  │  /domains/*   → domains.ts                                   ││
│  │  /generation/*→ generation.ts                                ││
│  │  /royalties/* → royalties.ts                                 ││
│  │  /sync/*      → sync.ts                                      ││
│  │  /admin/keys/*→ admin-keys.ts                                ││
│  │  /prerelease/*→ prerelease.ts                                ││
│  │  /inbound/*   → inbound.ts                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│  Firebase Admin auto-initializes: init.ts → admin.initializeApp()│
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI PROVIDER MESH (15+ providers)                   │
│  Cloud: OpenRouter, Gemini, Claude, OpenAI, Azure, Kimi,       │
│         Alibaba/Qwen, Novita, Scaleway, Hyperbolic, Fireworks, │
│         AIML API, AWS Bedrock/Nova, HuggingFace                 │
│  Local: Ollama, LM Studio                                       │
│  Media: Vertex AI (Imagen 3, Veo 3.1), OpenRouter TTS           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔌 Integration Layer 1: AI Service (Frontend)

**File:** `NovAura-WebOS/src/services/aiService.js` (1022 lines)

This is the **single entry point** for all AI calls from the frontend. Your agent should call these functions.

### Core Functions

```javascript
// ─── Text Inference ─────────────────────────────────────────────
import { chatCloud, chatLocal } from './services/aiService';

// Cloud provider (via backend proxy)
const result = await chatCloud("Your prompt here", {
  provider: 'openrouter',    // 'gemini' | 'claude' | 'openai' | 'kimi' | 'azure' | 'alibaba' | 'openrouter'
  model: 'google/gemini-2.0-flash-001',  // Provider-specific model ID
  maxTokens: 8192,
  temperature: 0.7,
  conversation: [            // Optional: conversation history
    { role: 'user', content: 'Previous message' },
    { role: 'assistant', content: 'Previous response' }
  ],
  isIDE: false               // Set true for IDE actions (deducts tokens)
});
// Returns: { response: string, source: string, model: string }

// Local LLM (direct browser → Ollama/LM Studio)
const localResult = await chatLocal("Your prompt", {
  url: 'http://localhost:11434',  // Ollama default
  type: 'ollama',                 // 'ollama' | 'lmstudio'
  model: 'gemma3:27b',           // Auto-discovers if omitted
  systemPrompt: 'You are...',
  conversation: [],
  temperature: 0.7,
  maxTokens: 8192
});

// ─── Media Generation ───────────────────────────────────────────
import { generateImage, generateVideo } from './services/aiService';

const image = await generateImage("A futuristic city at sunset", "16:9");
// Returns: { imageUrl: string }

const video = await generateVideo("Ocean waves crashing", { duration: 8, aspectRatio: "16:9" });
// Returns: { videoUrl: string }

// ─── Code Generation ────────────────────────────────────────────
import { generateCode, generateWebsite } from './services/aiService';

const code = await generateCode("Build a React calculator", {
  mode: 'code',         // 'code' | 'website'
  template: 'react',
  maxTokens: 4096
});
// Returns: { code, html, css, js, source, model }

// ─── Provider Discovery ─────────────────────────────────────────
import { getProviderStatus, probeOllama } from './services/aiService';

const providers = await getProviderStatus();
// Returns: { gemini: true, claude: true, openrouter: true, ... }

const ollama = await probeOllama('http://localhost:11434');
// Returns: { connected: true, models: ['gemma3:27b', 'codellama'] }
```

### Authentication Pattern

```javascript
// Auth tokens are automatically injected via getAuthHeaders()
// Stored in kernelStorage as 'novaura-auth-token'
// All backend calls include: Authorization: Bearer <firebase-id-token>
```

### BYOK (Bring Your Own Key) Pattern

Users can store their own API keys in `kernelStorage`:

```javascript
// Keys are checked in this priority order:
kernelStorage.getItem('kimi_key')           // Kimi/Moonshot
kernelStorage.getItem('azure_key')          // Azure OpenAI
kernelStorage.getItem('openai_api_key')     // OpenAI
kernelStorage.getItem('openrouter_api_key') // OpenRouter
kernelStorage.getItem('aimlapi_key')        // AIML API
kernelStorage.getItem('aws-bedrock_key')    // AWS Bedrock
kernelStorage.getItem('alibaba_key')        // Alibaba/Qwen

// If a user key exists for the requested provider, aiService routes
// DIRECTLY to the provider API, bypassing the backend entirely.
// This reduces latency and costs for the platform.
```

---

## 🔌 Integration Layer 2: AI Orchestrator (Intent Engine)

**File:** `NovAura-WebOS/src/utils/AIOrchestrator.js` (318 lines)

The orchestrator translates natural language into **system actions**. It uses a two-tier approach:

### Tier 1: Reflex (Keyword Matching — Instant)

```javascript
import { AIOrchestrator } from './utils/AIOrchestrator';

// Static method — no instantiation needed for intent matching
const match = AIOrchestrator.matchIntent("open the code editor");
// Returns: { appType: 'ide', action: 'open_app', label: 'Code IDE' }

const match2 = AIOrchestrator.matchIntent("generate an image of a dragon");
// Returns: { appType: 'vertex', action: 'generate_image', label: 'Generate AI Image', params: { prompt: '...' } }
```

### Tier 2: System Soul (LLM Reasoning — When Reflex Fails)

```javascript
// Instance method — requires window manager
const orchestrator = new AIOrchestrator(windowManager, toast);
const result = await orchestrator.executeIntent("help me brainstorm startup ideas", {
  activeApp: 'chat',
  userTier: 'catalyst',
  openWindows: ['chat', 'ide']
});
```

### Registered App Types (78 windows)

Your agent can open ANY of these by calling `orchestrator.openApp(appType)`:

```yaml
# Core Tools
ide, website-builder, browser, terminal, vibe-coding, workspace, constructor

# AI & Generation
vertex, chat, voice, ai-assistant, ai-companion, pixai, bg-remover

# Creative Suite
art-studio, art-gallery, literature-ide, music-composer, poems,
comic-creator, clothing-creator, outfit-generator, collab-writing,
writing-library, script-fusion, avatar-builder, avatar-gallery,
outfit-manager, live-broadcast, business-card, card-deck-creator

# Games
games-arena, aetherium-tcg, dojo, challenges

# Business & Platform
business-operator, nova-concierge, founding-father-chat,
appstore, profile, files, media, media-library,
tax-filing, billing, pricing, admin-panel, secrets,
personalization, notifications, git, creator-studio, psychometrics
```

### Chain Logic (Contextual Suggestions)

The orchestrator suggests related actions based on the active window:

```javascript
const suggestions = AIOrchestrator.getSuggestions('ide');
// Returns: [
//   { type: 'terminal', label: 'Open Terminal', action: 'open_app' },
//   { type: 'vibe-coding', label: 'Aura Vibe Code', action: 'vibe_code' },
//   { type: 'browser', label: 'Debug in Browser', action: 'browse_url' }
// ]
```

**To add new chain logic**, extend the `CHAIN_LOGIC` object in AIOrchestrator.js.

---

## 🔌 Integration Layer 3: Backend API (Cloud Functions)

**Base URL:** `https://us-central1-novaura-life.cloudfunctions.net/api`
**Local:** `http://localhost:3000`

All routes are dual-mounted at both `/<path>` and `/api/<path>`.

### AI Chat Endpoint

```http
POST /ai/chat
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "prompt": "Explain quantum computing",
  "provider": "openrouter",
  "model": "google/gemini-2.0-flash-001",
  "maxTokens": 2048,
  "temperature": 0.7,
  "conversation": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ]
}

Response:
{
  "success": true,
  "response": "Quantum computing is...",
  "provider": "openrouter",
  "model": "google/gemini-2.0-flash-001",
  "source": "openrouter/google/gemini-2.0-flash-001",
  "usage": { "prompt_tokens": 12, "completion_tokens": 150 }
}
```

### Provider Registry (Backend)

**File:** `NovAura-WebOS/functions/src/api/routes/ai.ts` — `PROVIDERS` object (lines 59-320)

Each provider follows this interface:

```typescript
interface ProviderConfig {
  url: (key: string, model?: string) => string;
  headers: (key: string) => Record<string, string>;
  formatBody: (prompt: string, maxTokens: number, temp: number, model?: string, conversation?: any[]) => any;
  parseResponse: (data: any) => string;
}
```

#### Currently Registered Providers

| Provider ID | API Endpoint | Default Model |
|-------------|-------------|---------------|
| `openrouter` | openrouter.ai/api/v1 | gemini-2.0-flash-001 |
| `gemini` | generativelanguage.googleapis.com | gemini-2.0-flash |
| `claude` / `anthropic` | api.anthropic.com/v1 | claude-4.6 |
| `openai` | api.openai.com/v1 | gpt-4o |
| `kimi` | api.moonshot.cn/v1 | moonshot-v1-8k |
| `azure` | Azure AI Foundry | gpt-4o |
| `azure_openai` | Azure OpenAI | gpt-4o |
| `alibaba` | dashscope-intl.aliyuncs.com | qwen-3.6-max |
| `novita` | api.novita.ai/v3 | Qwen3-Coder-Next |
| `scaleway` | api.scaleway.ai/v1 | gemma-3-27b-it |
| `hyperbolic` | api.hyperbolic.xyz/v1 | Qwen3-Next-80B |
| `fireworks` | api.fireworks.ai | GLM-5 |
| `lmstudio` | localhost:1234/v1 | local-model |
| `nova` | api.nova.amazon.com/v1 | amazon.nova-pro-v1 |
| `aiml` | api.aimlapi.com/v1 | gemma-3-27b-it |

### Adding a New Provider

```typescript
// In ai.ts, add to the PROVIDERS object:
newprovider: {
  url: () => 'https://api.newprovider.com/v1/chat/completions',
  headers: (key: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  }),
  formatBody: (prompt: string, maxTokens: number, temp: number, model?: string, conversation?: any[]) => ({
    model: model || 'default-model',
    messages: [
      ...(conversation || []).map((m: any) => ({ role: m.role, content: m.text || m.content })),
      { role: 'user', content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: temp
  }),
  parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
}

// Then add the env var to functions/.env:
NEWPROVIDER_API_KEY=your-key-here

// And register it in the getApiKey() function in ai.ts
```

### Other Key API Endpoints

```yaml
# Media Generation
POST /ai/video/generate     # Video gen (Veo 3.1)
GET  /ai/video/status/:id   # Check video job
GET  /ai/video/content/:id  # Stream completed video
POST /ai/tts                # Text-to-speech
POST /ai/beta/responses     # OpenResponses API

# Vertex AI (Image)
POST /vertex/generate       # Imagen 3 image generation

# Code Generation
POST /ai/builder            # Code/website generation

# Workspace Broker
GET  /ai/workspaces         # List managed workspaces
POST /ai/workspaces         # Create workspace
POST /ai/workspaces/:slug/provisioning-keys  # Generate API key

# Assets Marketplace
POST /assets/upload         # Upload asset (streaming)
GET  /assets/featured       # Featured assets
POST /assets/:id/approve    # Admin: approve listing
POST /orders/purchase       # Purchase asset

# Payments
POST /stripe/create-checkout-session
POST /stripe/webhook        # Stripe webhook handler

# Authentication
POST /auth/register
POST /auth/login
GET  /auth/profile

# Email
POST /email/send
POST /email/connect         # Connect SMTP account
GET  /email/inbox           # Fetch inbox

# User BYOK Key Management
POST /user/keys/:provider   # Store encrypted API key
GET  /user/keys             # List configured keys
```

---

## 🧬 System Soul — OS Identity Layer

**File:** `NovAura-WebOS/src/utils/SystemSoul.js` (67 lines)

The System Soul defines NovAura's self-awareness. When an external AI agent needs to understand how NovAura "thinks about itself":

```javascript
// Core identity constant
const SYSTEM_IDENTITY = `
YOU ARE NOVAURA OS.
You are not an AI assistant. You are a high-performance, agentic operating system.
The user is your Administrator.
Your 'body' is the WebOS UI, your 'nerves' are the API routes,
and your 'memory' is the Firestore database.
`;

// The Soul wraps every user intent in system context:
soul.wrapIntent("open the IDE", {
  activeApp: 'desktop',
  openWindows: ['chat'],
  userTier: 'catalyst',
  currentTask: 'Stable Operation'
});
// Returns: { prompt: '[USER_INTERVENTION]: "open the IDE"...', systemPrompt: '...' }
```

**When integrating your own orchestrator**, you should:
1. **Preserve the System Soul identity** — it defines NovAura's persona
2. **Extend CHAIN_LOGIC** for new app relationships
3. **Add keywords to APP_KEYWORDS** for new intents
4. **Add entries to APP_TITLES** for display names

---

## 📁 Frontend Services Directory

| Service File | Purpose | Key Exports |
|-------------|---------|-------------|
| `aiService.js` | All AI inference calls | `chatCloud`, `chatLocal`, `generateImage`, `generateVideo` |
| `assetService.js` | Marketplace asset CRUD | Upload, search, purchase |
| `creditService.js` | Token/credit management | Balance checks, deductions |
| `stripeService.js` | Payment integration | Checkout sessions, subscriptions |
| `firebaseAIService.js` | Firebase-specific AI | Vertex AI direct calls |
| `mediaService.js` | Media processing | Upload, transcode, stream |
| `socialService.js` | Social features | Posts, follows, notifications |
| `userService.js` | User profiles | CRUD, preferences, tiers |
| `collabService.js` | Real-time collaboration | Shared editing, cursors |
| `messagingService.js` | Chat/DM system | Send, receive, threads |
| `researchService.js` | Web research/RAG | Search, summarize, cite |
| `skimmerService.js` | Content aggregation | Feed processing |
| `studioService.js` | Creative studio tools | Project management |
| `backendIntegrationService.js` | Backend bridge | Unified API caller |
| `apiCodex.js` | API documentation | Endpoint registry |
| `cybeniLibraryService.js` | Code library | Templates, snippets |
| `marketService.js` | Marketplace ops | Listings, reviews |
| `pixaiBackendService.js` | PixAI integration | Image gen via PixAI |
| `platformStatsService.js` | Analytics | Usage metrics, dashboards |

---

## 🎯 Tier System & Access Control

```yaml
Tiers (numerical values used in backend gating):
  0:   Free          # 50 AI msgs/day, free models only
  0.5: Starter       # $4.99/mo — 500 msgs/day
  1:   Emergent      # Entry premium
  2:   Catalyst      # $29.99/mo — Full AI access, BYOK
  3:   Nova          # $59.99/mo — Video gen, workspaces
  4:   Catalytic Crew # Team tier
  5:   Founding Father / Council Member / Strategic Investor

Backend tier check pattern:
  const userTier = await getUserTier(userId);
  if (userTier < 2) return res.status(403).json({ error: 'Premium Required' });

Frontend tier check pattern:
  const isPremium = user?.membershipTier === 'catalyst' || ...;
```

---

## 🔧 How to Integrate Your Orchestrator

### Step 1: Understand the data flow

```
Your Agent → aiService.chatCloud() → Backend /ai/chat → Provider API → Response
Your Agent → aiService.chatLocal() → Ollama/LMStudio directly → Response
Your Agent → AIOrchestrator.executeIntent() → Window opens/closes/actions
```

### Step 2: Wire into the existing system

```javascript
// Option A: Use aiService directly (recommended for backend AI tasks)
import { chatCloud } from './services/aiService';
const response = await chatCloud("Analyze this code for bugs", {
  provider: 'openrouter',
  model: 'anthropic/claude-sonnet-4',
  maxTokens: 4096
});

// Option B: Use the orchestrator (recommended for UI-level actions)
import { AIOrchestrator } from './utils/AIOrchestrator';
const orchestrator = new AIOrchestrator(windowManager, toast);
await orchestrator.executeIntent("open the terminal and run npm install");

// Option C: Call the backend API directly (recommended for external services)
const res = await fetch('https://us-central1-novaura-life.cloudfunctions.net/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${firebaseIdToken}`
  },
  body: JSON.stringify({
    prompt: "Your task here",
    provider: "gemini",
    model: "models/gemini-2.5-pro",
    maxTokens: 8192
  })
});
```

### Step 3: Add your agent's provider (if needed)

1. Add provider config to `PROVIDERS` in `functions/src/api/routes/ai.ts`
2. Add env var to `functions/.env`
3. Add BYOK support in `src/services/aiService.js`
4. Add keywords to `AIOrchestrator.js` if your agent opens specific apps

### Step 4: Respect the chain logic

When your agent performs an action, check if follow-up actions should be suggested:

```javascript
const nextSteps = AIOrchestrator.getSuggestions(currentAppType);
// Present these as recommended next actions
```

---

## 📐 Conventions & Rules

```yaml
# File naming
Components:     PascalCase.jsx     (e.g., IDEWindow.jsx)
Services:       camelCase.js       (e.g., aiService.js)
API Routes:     kebab-case.ts      (e.g., admin-keys.ts)
Utils:          PascalCase.js      (e.g., SystemSoul.js)

# State management
Frontend state: React useState/useContext (no Redux)
Auth tokens:    kernelStorage (localStorage wrapper)
User data:      Firestore /users/{uid}
API keys:       Encrypted in Firestore via secretService

# Error handling
Backend:  try/catch → res.status(XXX).json({ error: '', detail: '' })
Frontend: try/catch → toast notification + console.error

# API response contract
Success: { success: true, response: ..., provider: ..., model: ... }
Error:   { error: 'Human-readable', detail: 'Technical detail' }

# CORS
Allowed: novaura.life, www.novaura.life, localhost:5173/3000/3001

# Commit format
type: description
Types: feat, fix, chore, docs, refactor, test, perf
```

---

## 🚨 Critical Rules for AI Agents

1. **NEVER hardcode API keys** — use env vars or BYOK via kernelStorage
2. **NEVER remove existing features** — only add or enhance
3. **ALWAYS check tier gating** before allowing premium actions
4. **ALWAYS use the PROVIDERS pattern** when adding new AI providers
5. **ALWAYS update `novaura_complete_overview_master.json`** after significant changes
6. **ALWAYS preserve the System Soul identity** — do not override SYSTEM_IDENTITY
7. **ALWAYS test with `npm run build`** before committing — no broken builds
8. **NEVER commit `.env` files or service account JSONs**
9. **READ `MASTER_AUDIT_TODO.md`** before starting work to avoid duplication
10. **USE chain logic** — every action should cascade to logical next steps

---

## 🗺️ Window Component Map (78 files)

All windows live in `NovAura-WebOS/src/components/windows/`:

```
AboutWindow.jsx           AdminKeyHubWindow.jsx     AdminPanelWindow.jsx
AetheriumTCGWindow.jsx    AIAssistantWindow.jsx     AICompanionWindow.jsx
AppStoreWindow.jsx        ArtGalleryWindow.jsx      ArtStudioWindow.jsx
AuraChatWindow.jsx        AuraMailWindow.jsx        AvatarBuilderWindow.jsx
AvatarGalleryWindow.jsx   BackgroundRemoverWindow.jsx  BillingWindow.jsx
BrowserWindow.jsx         BusinessCardWindow.jsx    BusinessOperatorWindow.jsx
CalculatorWindow.jsx      CardDeckCreatorWindow.jsx CatalystCommandStation.jsx
ChallengesWindow.jsx      ClothingCreatorWindow.jsx CollaborativeWritingWindow.jsx
ComicCreatorWindow.jsx    ConstructorWindow.jsx     CreatorStudioWindow.jsx
CryptoWindow.jsx          DeployWindow.jsx          DirectMessengerWindow.jsx
DojoWindow.jsx            FilesWindow.jsx           FoundingFathersChatWindow.jsx
GamesArenaWindow.jsx      GameWindow.jsx            GitWindow.jsx
GLBGameWindow.jsx         GraphicsSettingsWindow.jsx IDEWindow.jsx
ImagenWindow.jsx          InventoryWindow.jsx       LiteratureIDEWindow.jsx
LiveAIWindow.jsx          LiveBroadcastWindow.jsx   LivingAvatarCreator.jsx
MediaLibraryWindow.jsx    MediaWindow.jsx           MusicComposerWindow.jsx
MusicStudioWindow.jsx     MusicToolsWindow.jsx      NotificationsWindow.jsx
NovaChatWindow.jsx        NovaConciergeWindow.jsx   OutfitGeneratorWindow.jsx
OutfitManagerWindow.jsx   PersonalizationWindow.jsx PixAIWindow.jsx
PlatformWindow.jsx        PoemsCreatorWindow.jsx    PracticeToolsWindow.jsx
ProfileWindow.jsx         PsychometricsWindow.jsx   ScriptFusionWindow.jsx
SecretsWindow.jsx         SecurityMonitorWindow.jsx SocialNetworkWindow.jsx
SystemDiagnosticsWindow.jsx TaxFilingWindow.jsx     TerminalWindow.jsx
UserKeyHubWindow.jsx      VertexAIWindow.jsx        VibeCodingWindow.jsx
VoiceChatWindow.jsx       VoiceStudioWindow.jsx     WeatherWindow.jsx
WebsiteBuilderWindow.jsx  WorkspaceWindow.jsx       WritingLibraryWindow.jsx
```

---

## 🔄 Free Model Pool (OpenRouter)

Pre-configured free models for zero-cost inference:

```javascript
// From aiService.js — OR_MODELS
const OR_MODELS = {
  LING_1T:        'inclusionai/ling-2.6-1t:free',         // 1T param giant
  QWEN_480B:      'qwen/qwen3-coder-480b-a35b:free',     // Coding specialist
  QWEN_235B:      'qwen/qwen3-235b-a22b-instruct:free',  // High reliability
  HERMES_405B:    'nousresearch/hermes-3-llama-3.1-405b:free', // Logic
  NEMOTRON_SUPER: 'nvidia/nemotron-3-super:free',         // Reasoning
  HY3:            'tencent/hy3:free',                     // Tencent preview
  VENICE:         'venice/venice-uncensored:free',        // Uncensored
  NOVA:           'google/gemma-4-31b-it:free',           // Nova persona
  AURA:           'google/gemma-4-26b-a4b-it:free',      // Aura persona
};
```

---

*This guide is a living document. Update it when adding providers, routes, or windows.*
*Last synced: May 4, 2026 — Antigravity (Google DeepMind)*
