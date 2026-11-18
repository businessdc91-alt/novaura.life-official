# NovAura Platform — Complete Feature Audit & Master TODO
**Date:** 2026-05-01  
**Auditor:** Kimi Code CLI  
**Purpose:** Comprehensive reference for multi-AI orchestration. Treat every unchecked item as a work order.

---

## 1. EXECUTIVE SUMMARY

NovAura is an extraordinarily ambitious "browser-based OS" ecosystem spanning **6+ sub-projects**, **80+ OS windows/apps**, **40+ platform pages**, **12+ AI providers**, and **4 games**. The codebase is ~230K+ lines with a genuine kernel-driven window manager, real multi-provider AI backend, Firebase hosting, Stripe integration scaffolding, and Tauri desktop builds.

**However, there is a systemic pattern of "UI-first, backend-second" implementation.** Many windows have beautiful, functional frontends but lack critical backend integration, real data persistence, or payment webhooks. The most dangerous gaps are **revenue blockers** — Stripe checkout works but payments are not confirmed; creator uploads work but files don't persist; earnings dashboards show mock data.

**Overall Health Score:** 7.2/10  
**Ship-Blocking Issues:** 7  
**High-Impact Gaps:** 23  
**Polish Gaps:** 35+

---

# 🛡️ Kimi Agent Swarm: Production Evolution (10-Feature Roadmap)

The following features are being implemented by the Kimi Swarm to transition NovAura into a 'pure authentic data' production environment:

- [x] **Feature 1: Catalyst Command Station** - Autonomous GitHub project orchestrator.
- [x] **Feature 2: Enhanced Command Palette** - Multi-pass building and swarm intent.
- [x] **Feature 3: Aura Fix Terminal** - One-click logic capping and env repairs.
- [x] **Feature 4: Boardroom Mode** - AI Council debate in Founding Fathers Lounge.
- [ ] **Feature 5: AI Workspace Context** - Project health analysis in WorkspaceWindow.
- [ ] **Feature 6: 3D Asset Previewer** - Real-time GLB previews in Marketplace.
- [ ] **Feature 7: Metamate Memory** - Persistent AI preferences in Chat.
- [ ] **Feature 8: Aura Vibe Themes** - Dynamic OS styling based on project intent.
- [ ] **Feature 9: Agentic Timeline** - Visual Git history with AI summaries.
- [ ] **Feature 10: Actionable Insights** - Proactive AI performance notifications.

---

## 2. PROJECT INVENTORY & HEALTH SCORES

| Project | Type | Lines | Health | Status | Blockers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NovAura-WebOS** | React OS + Platform | ~180K | 8/10 | Production-build ready, actively deployed | Shell windows need backend; Platform pages need content |
| **Novaura-Desktop** | Tauri Desktop EXE | ~15K | 5/10 | Buildable but frontend is a shell | WebOS not integrated; Version mismatch (Tauri v1 + v2 plugins) |
| **Novaura-Portable** | Tauri Portable App | ~3K | 4/10 | SQLite backend works, frontend is placeholder | No WebOS integration; AI avatars spec-only |
| **Novaura-Extension** | VS Code Extension | ~150 lines | 3/10 | Source exists, no compiled output | Missing `out/` build; `syncWorkspace` unimplemented |
| **NovAura-Coding-Partner** | VS Code Extension | ~130 lines | 2/10 | Fake "synthesis" via regex | No real AI; `deployToFirebase` missing; chat is static |
| **NovAura-Unified** | Unknown | 0 | 0/10 | **Empty directory** | — |
| **The-Gilded-Cage** | Expo React Native RPG | ~25K | 8/10 | Deep RPG systems, 25+ screens | In-memory storage only; no PostgreSQL connected |
| **Kimi Deployments** | Static game builds | N/A | 6/10 | Card art complete (130+ cards), no verified game logic | v4 obsolete; v11/v14 are art-only builds |
| **dist/** | Production PWA build | N/A | 9/10 | Mature, chunked, service-worker enabled | Missing screenshots; Gilded Cage assets not bundled |

---

## 3. NOVAURA-WEBOS — DEEP AUDIT

### 3.1 The Kernel (NovaKernel v2) — ✅ MOSTLY COMPLETE

| Subsystem | Status | Completeness | Gap / Action Needed |
| :--- | :--- | :--- | :--- |
| AuthSubsystem | ✅ | 100% | Firebase Auth + Google + ESP signup |
| WindowManager | ✅ | 100% | Draggable, resizable, z-index, session restore |
| AISubsystem | ✅ | 100% | 12+ providers, smart routing, caching |
| FileSystem | ✅ | 95% | IndexedDB virtual FS; GitHub/Drive integration partial |
| SettingsStore | ✅ | 100% | localStorage persistence |
| NotificationBus | ✅ | 100% | Toast pipeline |
| ProcessManager | ✅ | 100% | Background registry |
| MemoryMap | ✅ | 100% | Workspace snapshots |
| PluginRegistry | ✅ | 100% | Dynamic loader |
| Scheduler | ✅ | 100% | Cron-like, heartbeat, autosave |
| CrashHandler | ✅ | 100% | Global boundary + Gemini auto-repair |
| LocalModelSubsystem | ⚠️ | 60% | WebGPU/WebLLM fallback works but lacks deep integration |
| NovaAgent | ✅ | 100% | Proactive AI agent |
| SentinelShield | ✅ | 100% | Security / access control |

**TODO:** None critical.

---

### 3.2 OS Windows — 45 AUDITED

#### ✅ WORKING (28 windows) — Solid, ship-ready

| Window | Backend | Notes |
| :--- | :--- | :--- |
| Cybeni IDE | localStorage + API | Monaco editor, project mgmt, ZIP export |
| Website Builder | aiService API | AI generates HTML/CSS/JS, live preview |
| Aetherium TCG | localStorage | Full battle engine, 45+ cards, 5 NPCs, deck builder |
| Inventory | localStorage | Card collection, deck builder, trade requests |
| Art Studio | Canvas API | Full drawing app, brush/eraser/shapes/fill |
| Music Composer | Web Audio API | Full DAW-lite, tracks, instruments, mixer |
| Games Arena | local | Nova Strike, Chess, Checkers, Tic-Tac-Toe |
| Literature IDE | localStorage | Full writing suite, file tree, AI panel, story bible |
| Voice Chat | Firebase + Gemini Live | Real voice I/O, transcription |
| Live AI | Firebase AI | Voice conversation, transcripts |
| Profile | localStorage | Account settings, BYOK AI config |
| Files | API + GitHub + Drive | Upload/download, folder mgmt |
| PixAI | PixAI service | Image gen with Mio API |
| Personalization | localStorage | 8 themes, accents, particles |
| Challenges | localStorage | 25+ coding challenges, XP, hints |
| Psychometrics | localStorage | Personality assessments, scoring |
| Media Player | File API | Local audio/video upload and playback |
| Media Library | API (axios) | Real backend storage for media |
| Comic Creator | localStorage | Layouts, panels, dialogue, effects |
| Clothing Creator | localStorage | Pattern/color/fit designer, wardrobe |
| Script Fusion | localStorage | Multi-script merge, conflict detection |
| Weather | Open-Meteo | Real weather, 7-day forecast |
| Crypto | CoinGecko | Real market data, charts, trending |
| Calculator | JS eval | Full calculator with history |
| Background Remover | API (axios) | Real image processing |
| Business Card | Canvas/CSS | 14 templates, flip animation |
| Gilded Cage | local | Full steampunk RPG (loads externally) |
| Workspace | localStorage | Game project/asset organizer |

#### ⚠️ PARTIAL (11 windows) — Functional but with notable gaps

| Window | Status | What's Missing | Fix Estimate |
| :--- | :--- | :--- | :--- |
| Repo Station | ⚠️ | Browse/import repos works; GitHub source needs deeper backend | 2-3 days |
| Social | ⚠️ | Feed/posts/likes work; needs Firebase auth connection for real accounts | 2-3 days |
| Vertex AI | ⚠️ | Imagen/video gen works; needs API key configured in env | 1 day |
| Vibe Coding | ⚠️ | Design/planning UI works; AI code generation backend needs hookup | 3-5 days |
| Dojo | ⚠️ | UI works; asset/world generation needs backend AI. **Also:** procedural mesh, biome system, object placement are TODO stubs | 1-2 weeks |
| Nova AI Chat | ⚠️ | UI + modes work; responses need AI provider configured | 1 day |
| Admin Panel | ⚠️ | User mgmt works; falls back to mock data if Firestore disconnected | 2-3 days |
| Business Operator | ⚠️ | Post-it notes/tasks work; metrics/AI suggestions are UI stubs | 3-4 days |
| Tax Filing | ⚠️ | Real 2025 brackets/calculations work; PDF scanning stubbed; e-file API unverified | 3-5 days |
| Art Gallery | ⚠️ | Demo pieces hardcoded; custom art from localStorage only | 2-3 days |
| Creator Studio | ⚠️ | Code gen needs onAIChat backend hookup | 2-3 days |

#### 🔲 SHELL (6 windows) — UI scaffolding only, no real functionality

| Window | Status | What's Needed | Fix Estimate |
| :--- | :--- | :--- | :--- |
| **Browser** | 🔲 | No iframe/webview rendering. Needs embedded browser or iframe sandbox | 3-5 days |
| **Terminal** | 🔲 | Mock commands only. Needs real shell integration (xterm.js + backend) | 3-5 days |
| **Git** | 🔲 | UI visualization with fake git state. Needs isomorphic-git integration + real repo ops | 1 week |
| **Billing** | 🔲 | Plan display only, no payment processing. Needs Stripe subscription management | 3-4 days |
| **Constructor** | 🔲 | Framework reference display only. Needs project generation engine | 1-2 weeks |
| **AI Companion** | 🔲 | Hardcoded mood responses, no real AI backend connection | 3-5 days |

---

### 3.3 Unified Platform Pages — ~40 AUDITED

#### ✅ WORKING (~12 pages)

| Page | Notes |
| :--- | :--- |
| HomePage | Static hero, feature cards, CTAs |
| LoginPage | Email/password + Google OAuth |
| SignupPage | Email/password + Google OAuth |
| BrowsePage | Asset browser, filter, sort, search |
| AssetDetailPage | Detail, cart/wishlist, license |
| UserProfilePage | User profile display |
| SearchPage | Asset search |
| CartPage | localStorage cart, platform fee calc |
| PricingPage | Plan tiers display |
| AdminDashboard | Approve/reject assets, real user stats |
| AdminUsers | User list, role mgmt, deletion |
| DomainMarketplace | UI present |

#### ⚠️ PARTIAL (~12 pages)

| Page | What's Missing | Fix Estimate |
| :--- | :--- | :--- |
| CreatorProfilePage | Profile display partial | 2-3 days |
| FeedPage | localStorage only, no backend sync, no real-time | 3-5 days |
| ShopPage | Shopify API product fetch, no fallback if Shopify fails | 2-3 days |
| GalleryPage | Demo pieces hardcoded | 2-3 days |
| CheckoutPage | Stripe redirect present, **no webhook handling** | 2-3 days |
| OrdersPage | Real API call, **no error fallback, no download delivery** | 3-5 days |
| SettingsPage | Profile/API keys/hardware work, needs refactor (839 lines) | 3-5 days |
| MessagesPage | localStorage only, no backend sync | 3-5 days |
| CreatorDashboard | Stats/assets show, no real-time data | 3-5 days |
| CreatorUpload | 5-step wizard works, **file persistence incomplete** | 3-5 days |
| AdminAssets | Asset approval UI partial | 2-3 days |
| HostingPlansPage | External links only, no provisioning | 1-2 days |

#### 🔲 SHELL (~20 pages) — Empty or static placeholders

| Page | What's Needed | Fix Estimate |
| :--- | :--- | :--- |
| Hub | Content | 2-3 days |
| CreatorLounge | Content | 2-3 days |
| MusicMarketplacePage | Content + backend | 3-5 days |
| GamesPage | Content + game listings | 2-3 days |
| SoftwarePage | Content | 2-3 days |
| FreeItemsPage | Content + free asset system | 3-5 days |
| StudioShowcasePage | Content | 2-3 days |
| AboutPage | Content | 1-2 days |
| InvestorPortalPage | Content | 2-3 days |
| EmailServicesPage | Content + service integration | 3-5 days |
| ChangelogPage | Content | 1 day |
| StatusPage | Content + status API | 2-3 days |
| HelpCenterPage | Content + search | 3-5 days |
| NovaRegistryPage | Content + registry backend | 3-5 days |
| APIKeyLibraryPage | Content + key docs | 2-3 days |
| DevAuraReaderPage | Content | 2-3 days |
| SiteBuilderPage | 3 templates link out, 3 "coming soon" | 3-5 days |
| DevToolsPage | Content | 2-3 days |
| SecurityPage | Content | 2-3 days |
| TutorialsPage | Content | 2-3 days |
| PromotePage | Content | 2-3 days |

#### 🃏 MOCK DATA (2 pages)

| Page | Issue | Fix Estimate |
| :--- | :--- | :--- |
| DownloadsPage | 2 hardcoded items, not real | 2-3 days |
| CreatorEarnings | **All hardcoded — no real royalty ledger** | 3-5 days |

---

### 3.4 Backend API — AUDIT

| Route | File | Status | Gaps |
| :--- | :--- | :--- | :--- |
| `/auth` | `auth.ts` | ✅ | ESP signup, profile sync |
| `/ai` | `ai.ts` | ✅ | 12+ providers, chat, builder, image, video, live-key |
| `/generation` | `generation.ts` | ✅ | Code/website generation |
| `/vertex` | `vertex.ts` | ✅ | Vertex AI proxy |
| `/drive` | `drive.ts` | ✅ | Google Drive integration |
| `/music` | `music.ts` | ✅ | Music generation |
| `/search` | `search.ts` | ✅ | Web search + DuckDuckGo |
| `/stripe` | `stripe.ts` | ⚠️ | Payments, webhooks, subscriptions — **webhook confirmation incomplete** |
| `/sync` | `sync.ts` | ✅ | Firestore sync service |
| `/assets` | `assets.ts` | ✅ | Asset management |
| `/orders` | `orders.ts` | ⚠️ | Order processing — **no download/license delivery** |
| `/royalties` | `royalties.ts` | 🃏 | **All mock data** |
| `/email` | `email.ts` | ✅ | IMAP/SMTP email service (AuraMail) |
| `/admin/keys` | `admin/keys.ts` | ✅ | Admin API key management |
| `/user/keys` | `user/keys.ts` | ✅ | User API key management |
| `/domains` | `domains.ts` | ⚠️ | Domain marketplace — no real purchasing |
| `/inbound` | `inbound.ts` | ✅ | Inbound webhooks |
| `/prerelease` | `prerelease.ts` | ✅ | Beta access control |

**Backend Critical Gaps:**
1. **Stripe webhooks** — Checkout redirects but no webhook confirms payment → revenue at risk
2. **Creator royalties** — Mock data only, no real ledger
3. **File upload persistence** — CreatorUpload wizard works but files don't persist
4. **Domain purchasing** — UI exists but no real transaction/provisioning
5. **Email verification** — Signup flow missing email confirmation

---

### 3.5 AI Ecosystem — AUDIT

| Provider | Integration | Status | Notes |
| :--- | :--- | :--- | :--- |
| Gemini (Google) | Primary fallback + image/video | ✅ | Full |
| OpenRouter | 1500+ models, free-tier pool | ✅ | Full |
| Claude (Anthropic) | Direct API | ✅ | Full |
| OpenAI | GPT-4o | ✅ | Full |
| Kimi (Moonshot) | BYOK + backend proxy | ✅ | Full |
| Azure OpenAI | BYOK + backend proxy | ✅ | Full |
| AWS Bedrock | BYOK | ✅ | Full |
| Alibaba Cloud (Qwen) | BYOK | ✅ | Full |
| AIML API | Secondary gateway | ✅ | Full |
| Vertex AI (Google Cloud) | Image/video generation | ✅ | Full |
| Ollama | Local browser-direct | ✅ | Full |
| LM Studio | Local browser-direct | ✅ | Full |

**Smart Routing:** ✅ Complete — routes by task category (Nova/Aura/Coding/General)

**AI Gaps:**
- **Vibe Coding 2.0** — Design document only, not implemented (4-week plan)
- **Agent Swarm** — Design document only, not implemented (orchestrator-worker pattern)
- **Avatar Studio** — Architecture decision needed (ReadyPlayerMe vs build-from-scratch), then 8-week build
- **Local AI Pipeline (Desktop)** — Ollama works but multi-pass pipeline is partial

---

## 4. NOVAURA-DESKTOP — DEEP AUDIT

### 4.1 Frontend (React)

| Feature | Status | Completeness | Gap |
| :--- | :--- | :--- | :--- |
| Desktop Shell UI | ⚠️ | 60% | Custom titlebar, sidebar, status bar exist |
| Dashboard Tab | ✅ | 100% | System info, Ollama status, quick actions |
| AI Chat Tab | 🔲 | 30% | Hardcoded test prompt only; **no real chat input UI** |
| Terminal Tab | 🔲 | 30% | Hardcoded `echo` test; **no interactive shell input** |
| File Watcher Tab | ⚠️ | 60% | Watches hardcoded path; no path picker |
| Resources Tab | ✅ | 100% | CPU/RAM/Disk cards with live polling |
| Settings Tab | 🔲 | 40% | Read-only display only |
| Custom Hooks | ✅ | 100% | `useSystemResources`, `useStreamingAI`, `useFileWatcher`, `useTerminal` |

**CRITICAL GAP:** `App.jsx` and `AppEnhanced.jsx` are identical shells. The **full NovAura-WebOS is NOT integrated**. This is the #1 desktop priority.

### 4.2 Rust Backend (Tauri)

| Feature | File | Status | Gap |
| :--- | :--- | :--- | :--- |
| File System | `commands.rs` | ✅ | Read/write/list/create/delete |
| App Data Directory | `commands.rs` | ✅ | Cross-platform |
| Native Notifications | `commands.rs` | ✅ | `notify-rust` crate |
| System Info | `commands.rs` | ✅ | OS, arch, version |
| SQLite Engrams | `database.rs` | ✅ | Schema + FTS5, CRUD, stats |
| Ollama (Local AI) | `ollama.rs` | ✅ | Generate, chat, list, status |
| Streaming Ollama | `streaming.rs` | ✅ | NDJSON stream parsing |
| System Resources | `system.rs` | ⚠️ | Windows memory is **mocked** (always 50%) |
| File Watcher | `file_watcher.rs` | ✅ | Recursive, emits events |
| Terminal / Project Commands | `terminal.rs` | ⚠️ | `parse_build_warnings` empty; `parse_python_errors`/`parse_dotnet_errors` return empty vectors |
| Aura Sidecar Bridge | `aura_sidecar.rs` | ✅ | Python subprocess IPC |
| Aura Hub (TCP Server) | `aura_hub.rs` | ✅ | Local HTTP server for VS Code extension |
| System Tray | `main.rs` | ⚠️ | Quit/Hide only; no dynamic menus |
| Window Controls | `main.rs` | ✅ | Min/max/close, hide-on-close, drag |
| Global Hotkeys | `commands_extra.rs` | 🔲 | **Stub** — prints to console, does nothing |
| Auto-Updater | `tauri.conf.json` | 🔲 | Configured but `active: false` |

### 4.3 Python Sidecar (AI Subsystem)

| Component | Status | Notes |
| :--- | :--- | :--- |
| Sidecar Entry Point | ✅ | Boots 31 nodes based on tier |
| IPC Bridge | ✅ | NDJSON protocol |
| Inference Core | ✅ | Ollama chat/stream, auto-detects models |
| Memory Core | ✅ | Multi-layer recall, engram storage |
| Tier System | ✅ | CONSUMER (14 nodes) vs FULL (31 nodes) |

**Gaps:**
- Stopping streaming generation needs additional backend impl
- Many `aura_NovaFiles/` nodes have TODOs/placeholders
- `AuraKernel_CPP/` is mostly TODO stubs (~15 headers/src files)

### 4.4 Configuration Issues

| Issue | Severity | Fix |
| :--- | :--- | :--- |
| **Tauri v1 + v2 plugin mismatch** | 🔴 High | `package.json` mixes `@tauri-apps/api@1.5.3` with v2 beta plugins. Align to v1 or migrate to v2 |
| **Sidecar path misalignment** | 🟡 Med | `tauri.conf.json` references `../aura_sidecar/aura_sidecar` but build script outputs to `src-tauri/sidecar/` |
| **Updater disabled** | 🟡 Med | `active: false` in config |
| **AuraCore_Reference is dead code** | 🟢 Low | ~80 C# files not wired to active codebase; port or remove |

---

## 5. NOVAURA-PORTABLE & EXTENSIONS — DEEP AUDIT

### 5.1 Novaura-Portable

| Feature | Status | Notes |
| :--- | :--- | :--- |
| System tray | ✅ | Hide/show/quit/backup |
| Window state persistence | ✅ | Size, position, maximized |
| Portable mode | ✅ | Stores data next to EXE |
| SQLite project storage | ✅ | CRUD + snapshots |
| Auto-save | ✅ | 5 min interval |
| AI conversation storage | ✅ | Separate `context.db` |
| Context window optimization | ✅ | Token-based trimming |
| FTS5 full-text search | ✅ | SQLite triggers |
| Backup to ZIP | ✅ | DB + projects + session |
| Backup restore | ⚠️ | Needs app restart for DB |
| Export formats | ⚠️ | JSON, MD, HTML ✅; **PDF stubbed** |
| File system ops | ✅ | Read/write/list/delete |
| Settings storage | ✅ | Key-value in SQLite |
| Custom titlebar | 🔲 | UI-ready but frameless window not fully styled |
| AI Avatar System | ❌ | Markdown spec only (`ai-avatar-system.md`) |
| **WebOS Integration** | ❌ | **Frontend is a placeholder shell** |

### 5.2 Novaura-Extension (VS Code)

| Feature | Status | Notes |
| :--- | :--- | :--- |
| Activity bar webview | ✅ | "Aura Chat" sidebar |
| `askFrontier` command | ✅ | Sends selected code to hub |
| Context menu | ✅ | Right-click integration |
| HTTP POST to hub | ✅ | Hardcoded to `/v1/aura` |
| Configurable hub URL | ✅ | Default `localhost:5178` |
| `syncWorkspace` | 🔲 | **Registered but not implemented** |
| **Compiled output** | ❌ | **`out/extension.js` missing** — cannot install |
| Error handling | 🔲 | Generic "Hub not found" only |
| Message history | 🔲 | Ephemeral, no persistence |
| Streaming | 🔲 | Waits for full response |

### 5.3 NovAura-Coding-Partner (VS Code)

| Feature | Status | Notes |
| :--- | :--- | :--- |
| Sidebar webview | ✅ | Static HTML welcome |
| `synthesizeCurrentFile` | 🃏 | **Regex-based rebranding only** — fake AI |
| Context menu | ✅ | "Synthesize Current File" |
| `deployToFirebase` | ❌ | **Declared in manifest, missing from code** |
| AI backend | ❌ | No HTTP calls, no API keys |
| Sidebar chat | 🔲 | Input box does nothing |
| `axios` | ❌ | Listed in deps but never imported |
| Icon asset | ❌ | `resources/icon.svg` missing |

### 5.4 NovAura-Unified

| Status | Notes |
| :--- | :--- |
| ❌ **EMPTY DIRECTORY** | No files, no config, no purpose defined |

---

## 6. GAMES & CREATIVE ASSETS — AUDIT

### 6.1 The Gilded Cage (Expo React Native)

| System | Status | Notes |
| :--- | :--- | :--- |
| Act 1 (Prologue) | ✅ | 10 quests, 7 companions, puzzle-solving, moral choices |
| Act 2 (Ironhaven) | ✅ | Town exploration, NPC dialogue, shops, turn-based combat, 30-floor dungeon |
| RPG Skill System | ✅ | 12 skills (RuneScape-inspired), Lv 1-99 |
| Combat Stats | ✅ | 15 stats, 10 equipment slots, 5 rarity tiers |
| Crafting | ✅ | Recipes with dependency chains |
| Auth | ✅ | Username/password + bcrypt |
| Visual Effects | ✅ | Particles, screen shake, fog, idle animations |
| **Database** | 🔲 | **In-memory only** — no PostgreSQL despite Drizzle/pg deps |
| **Test Suite** | ❌ | No tests visible |

### 6.2 Aetherium TCG

| Aspect | Status | Notes |
| :--- | :--- | :--- |
| Card Art | ✅ | ~130 cards, 6 rarity tiers + mythic + founding |
| Battle Engine (OS) | ✅ | 45+ cards, 5 NPCs, deck builder — localStorage |
| Card Forge (Designer) | ✅ | Single card + batch generation, style upload, gallery, export to Godot `.tres`/PNG/JSON |
| **Verified Game Logic (Deployments)** | 🔲 | v11/v14 are static builds; game logic unverified in deployment |
| NovaHearts (VN) | ✅ | 22 backgrounds, 5 characters, 4 gifts, 2 scenes — v14 only |

### 6.3 Nova Net Battler

| Feature | Status | Notes |
| :--- | :--- | :--- |
| Grid Combat | ✅ | 8×4 grid, player vs virus |
| Chip Abilities | ✅ | 5 abilities (Buster, Cannon, Sword, Bomb, Heal) |
| Canvas Rendering | ✅ | Particle effects |
| **Enemy AI States** | 🔲 | Needs state machine implementation |
| **Chip Deck System** | 🔲 | Needs deck building + skill firing |

### 6.4 Nova Strike / Galactica Starfighter Command

| Feature | Status | Notes |
| :--- | :--- | :--- |
| Vertical Space Shooter | ✅ | Full game loop |
| 5 Ship Classes | ✅ | Interceptor, Fighter, Bomber, Phantom, Titan |
| Talent Tree | ✅ | 8 unlockable upgrades |
| Power-ups | ✅ | 5 types |
| Boss Fights | ✅ | Every 5 levels |
| Enemy Patterns | ✅ | Distinct types |
| Particles / Shield / Health | ✅ | Full FX |
| Achievements | ✅ | Popup system |
| **Firebase Leaderboard** | ✅ | Firestore `nova_strike_scores` |

### 6.5 Planned Games (Not Started)

| Game | Status | What's Needed |
| :--- | :--- | :--- |
| **Nova Wilds** | ❌ Not started | N64-style 3D, Three.js + Cannon.js character controller |
| **Nova Tactics Online** | ❌ Not started | FFTA-inspired clan MMO, job tree, gear mastery formulas |

---

## 7. DOCUMENTATION vs. REALITY GAP ANALYSIS

Many docs claim features that are designed but not verified in code:

| Document | Claims | Reality |
| :--- | :--- | :--- |
| `CYBENI_IDE_OMNI_BUILDER_SUMMARY.md` | Git, Package Manager, Debugger, Deploy, Collab all ✅ | Conflicting evidence — `SITEMAP.md` and `MISSING_FEATURES_ACTION_PLAN.md` list these as missing/partial |
| `LITERATURE_IDE_IMPLEMENTATION_SUMMARY.md` | All 5 engines + 5 UI panels ✅ | `SITEMAP.md` says "localStorage only" without noting advanced features |
| `DESKTOP_EXE_ENHANCEMENTS.md` | System resources, streaming, file watcher, native terminal | Partial — resources mocked on Windows, terminal is display-only, hotkeys stubbed |
| `AVATAR_STUDIO_IMPLEMENTATION.md` | 8-week plan with weekly checkboxes | All checkboxes are `[ ]` (unchecked) |
| `AGENT_SWARM_FEATURE.md` | SwarmEngine, SwarmPanel, VirtualFileSystem | Design only — no implementation files found |

**Recommendation:** Treat "Implementation Summary" documents as design specs, not verified completion reports. Always cross-reference with `SITEMAP.md` and source code.

---

## 8. CRITICAL REVENUE BLOCKERS 🔴

These must be fixed before any commercial launch:

| # | Blocker | Impact | Fix Estimate | Owner Suggestion |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Stripe webhooks missing** | Payments not confirmed; users charged but system doesn't know | 2-3 days | Backend Agent |
| 2 | **File download delivery missing** | OrdersPage has no working download/license key delivery | 3-5 days | Backend + Frontend Agent |
| 3 | **Creator earnings = mock data** | No real royalty ledger; creators cannot be paid | 3-5 days | Backend Agent |
| 4 | **File upload persistence broken** | CreatorUpload wizard works but files don't persist | 3-5 days | Backend Agent |
| 5 | **Email verification missing** | Signup flow incomplete; security risk | 1-2 days | Backend Agent |
| 6 | **Billing window = shell** | No subscription management UI | 3-4 days | Frontend Agent |
| 7 | **CheckoutPage no webhook handling** | Redirects to Stripe but no confirmation | 2-3 days | Backend Agent |

---

## 9. HIGH-IMPACT GAPS 🟡

| # | Gap | Why It Matters | Fix Estimate |
| :--- | :--- | :--- | :--- |
| 1 | **Command Palette integrated** | Power users expect Cmd+K; reduces clicks 80% | ✅ FIXED |
| 2 | **Secrets Manager uses weak XOR** | Not production-grade encryption for API keys | 2-3 days |
| 3 | **Git window = shell** | No real git operations; serious devs need this | 1 week |
| 4 | **Real-time collaboration missing** | Replit's #1 differentiator; viral loop | 1-2 weeks |
| 5 | **Deployment pipeline partial** | ZIP export only; no one-click hosting deploy | 3-5 days |
| 6 | **Package Manager UI missing** | No npm/PyPI/crates integration in IDE | 3-5 days |
| 7 | **Debugger missing** | No breakpoints, variable inspection, call stack | 1 week |
| 8 | **Vibe Coding 2.0 not implemented** | Design docs exist, no code | 2-4 weeks |
| 9 | **Agent Swarm not implemented** | Design docs exist, no code | 2-3 weeks |
| 10 | **Avatar Studio not started** | Architecture doc only, no decision made | 8 weeks |
| 11 | **Desktop WebOS integration missing** | Desktop app is a shell, not the OS | 1-2 weeks |
| 12 | **20+ platform pages are shells** | Empty content hurts credibility | 2-4 weeks |
| 13 | **Social feed no real-time** | localStorage only, no Firebase sync | 3-5 days |
| 14 | **Messages no backend sync** | Chats lost on refresh | 3-5 days |
| 15 | **Dojo procedural generation stubs** | World generator outputs templates, not 3D worlds | 1-2 weeks |
| 16 | **Browser window = shell** | No actual browsing capability | 3-5 days |
| 17 | **Terminal window = shell** | No real shell | 3-5 days |
| 18 | **AI Companion = hardcoded** | No real AI backend | 3-5 days |
| 19 | **Constructor = reference display** | No project generation | 1-2 weeks |
| 20 | **Nova Net Battler AI incomplete** | Enemy states and chip deck missing | 3-5 days |
| 21 | **Tax filing e-file unverified** | UI works but IRS API hookup unknown | 3-5 days |
| 22 | **Domain purchasing not real** | UI exists but no transaction/provisioning | 3-5 days |
| 23 | **Tauri desktop version mismatch** | v1 API + v2 plugins will break | 2-3 days |

---

## 10. COMPLETENESS MATRIX BY DOMAIN

| Domain | Features | Working | Partial | Shell | Mock | Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Core OS / Kernel** | 14 | 13 | 1 | 0 | 0 | 93% |
| **OS Windows** | 45 | 28 | 11 | 6 | 0 | 78% |
| **Platform Pages** | 40 | 12 | 12 | 20 | 2 | 45% |
| **Backend API** | 18 | 14 | 3 | 0 | 1 | 81% |
| **AI Providers** | 12 | 12 | 0 | 0 | 0 | 100% |
| **AI Features (Advanced)** | 4 | 0 | 1 | 2 | 0 | 13% |
| **Desktop (Tauri)** | 16 | 8 | 3 | 4 | 0 | 63% |
| **Portable** | 14 | 10 | 2 | 1 | 0 | 75% |
| **VS Code Extensions** | 10 | 3 | 2 | 3 | 2 | 35% |
| **Games (Live)** | 4 | 3 | 1 | 0 | 0 | 88% |
| **Games (Planned)** | 2 | 0 | 0 | 0 | 0 | 0% |
| **Creative Assets** | 3 | 3 | 0 | 0 | 0 | 100% |
| **Monetization** | 8 | 3 | 2 | 2 | 1 | 44% |
| **Documentation** | 23 | — | — | — | — | 70% |

**Platform Overall:** ~68% complete (weighted by user impact)

---

## 11. MULTI-AI ORCHESTRATION PLAN

Divide work into **9 specialized agent squads**. Each squad gets a focused scope from this audit.

### Squad A: Revenue & Backend (Highest Priority)
**Scope:** Fix all revenue blockers before anything else.
- [ ] Implement Stripe webhook handler (`/api/stripe/webhooks`)
- [ ] Build file download/license delivery system (`/api/orders/download`)
- [ ] Create real royalty ledger (`/api/royalties` — replace mock)
- [ ] Fix CreatorUpload file persistence (Firebase Storage integration)
- [ ] Add email verification flow (Firebase Auth + SendGrid/SES)
- [ ] Build subscription management backend

### Squad B: Platform Content (High Impact, Low Complexity)
**Scope:** Fill 20+ empty platform pages with real content.
- [ ] `/platform/hub` — Ecosystem hub content
- [ ] `/platform/creators` — Creator lounge
- [ ] `/platform/music` — Music marketplace
- [ ] `/platform/games` — Game listings
- [ ] `/platform/software` — Software directory
- [ ] `/platform/free` — Free assets system
- [ ] `/platform/about`, `/platform/investors`, `/platform/changelog`, `/platform/status`
- [ ] `/platform/help` — Help center + search
- [ ] `/platform/tutorials`, `/platform/promote`, `/platform/security`
- [ ] `/platform/registry`, `/platform/api-keys`, `/platform/reader`

### Squad C: IDE & Developer Experience
**Scope:** Make the IDE competitive with Replit/VS Code.
- [ ] Integrate Monaco Editor fully (replace any remaining `<textarea>`)
- [ ] Build Git UI with isomorphic-git (visual diff, commit, branch, push/pull)
- [ ] Add Command Palette global integration (Cmd+K / Ctrl+K)
- [ ] Build Package Manager UI (npm, PyPI, crates.io)
- [ ] Add Debugger integration (breakpoints, variables, call stack)
- [ ] Build Secrets Manager v2 with real encryption (replace XOR)
- [ ] Add Project Templates system
- [ ] Build Deployment Pipeline (one-click to Firebase/Vercel/Netlify)

### Squad D: Social & Real-Time
**Scope:** Make the platform viral.
- [ ] Backend sync for Social feed (Firestore real-time)
- [ ] Backend sync for Messages
- [ ] User Profile Portfolios (public project showcase)
- [ ] Comments/Likes on projects
- [ ] Real-time Collaboration (WebRTC + CRDT or Yjs)
- [ ] Notifications Center backend + email push

### Squad E: Desktop & Native
**Scope:** Make the Tauri EXE a first-class citizen.
- [ ] **Integrate full NovAura-WebOS into Desktop frontend** (replace shell)
- [ ] Fix Tauri v1/v2 dependency mismatch
- [ ] Implement real global hotkeys (replace stub)
- [ ] Fix Windows memory monitoring (replace 50% mock)
- [ ] Enable auto-updater (`active: true` + endpoint)
- [ ] Build interactive terminal input (xterm.js integration)
- [ ] Fix sidecar binary path alignment
- [ ] Add WebSocket server for external integrations
- [ ] Build native file type associations

### Squad F: AI & Advanced Features
**Scope:** Implement the "next-gen" AI features.
- [ ] Vibe Coding 2.0 (4-phase conversation + React Flow logic graphs)
- [ ] Agent Swarm (orchestrator-worker + VirtualFileSystem)
- [ ] Avatar Studio decision + PoC (ReadyPlayerMe integration recommended)
- [ ] Local AI Pipeline (multi-pass Ollama in Desktop)
- [ ] Vector Database + semantic search (Desktop SQLite + embeddings)
- [ ] AI Companion real backend connection

### Squad G: Games
**Scope:** Complete the game ecosystem.
- [ ] Nova Net Battler: Enemy AI state machine
- [ ] Nova Net Battler: Chip deck + skill firing system
- [ ] Nova Wilds: Three.js + Cannon.js character controller prototype
- [ ] Nova Tactics Online: Job tree + gear mastery formula design
- [ ] The Gilded Cage: Replace in-memory storage with PostgreSQL
- [ ] The Gilded Cage: Add test suite

### Squad H: VS Code Extensions
**Scope:** Make extensions actually usable.
- [ ] Novaura-Extension: Add build pipeline (`npm run compile` → `out/`)
- [ ] Novaura-Extension: Implement `syncWorkspace` command
- [ ] Novaura-Extension: Add message history persistence
- [ ] Novaura-Extension: Add streaming response support
- [ ] NovAura-Coding-Partner: Replace regex "synthesis" with real AI calls
- [ ] NovAura-Coding-Partner: Implement `deployToFirebase`
- [ ] NovAura-Coding-Partner: Fix sidebar chat functionality
- [ ] NovAura-Coding-Partner: Add missing icon asset

### Squad I: Infrastructure & DevOps
**Scope:** Harden the foundation.
- [ ] Rotate PixAI API key (security audit follow-up)
- [ ] Remove `VITE_PIXAI_API_KEY` from all frontend `.env` files
- [ ] Deploy latest Firebase Functions
- [ ] Add CI/CD pipeline for WebOS + Platform builds
- [ ] Add automated testing (unit + e2e with Playwright)
- [ ] Document API endpoints in OpenAPI/Swagger format
- [ ] Set up monitoring/alerting for Firebase Functions
- [ ] Resolve `NovAura-Unified` directory purpose or delete

---

## 12. RECOMMENDED SPRINT ORDER

### Sprint 0: Firefighting (Week 0 — Do Immediately)
- [ ] Rotate PixAI API key
- [ ] Remove exposed `VITE_` prefixed keys from frontend
- [ ] Deploy latest Firebase Functions
- [ ] Fix Tauri v1/v2 version mismatch in Desktop

### Sprint 1: Revenue Unblock (Week 1)
- [ ] Stripe webhook handler
- [ ] Email verification flow
- [ ] Billing window subscription management
- [ ] File download/license delivery

### Sprint 2: Creator Economy (Week 2)
- [ ] CreatorUpload file persistence
- [ ] Real royalty ledger
- [ ] CreatorEarnings real data
- [ ] CreatorDashboard real-time data

### Sprint 3: IDE Foundation (Week 3)
- [ ] Command Palette global integration
- [ ] Secrets Manager v2 with real encryption
- [ ] Git UI with isomorphic-git
- [ ] Project Templates system

### Sprint 4: Platform Content Blast (Week 4)
- [ ] Fill 10 highest-traffic shell pages with content
- [ ] Fix CheckoutPage error handling
- [ ] Fix OrdersPage error fallback
- [ ] Add domain purchasing flow

### Sprint 5: Social & Collab (Week 5)
- [ ] Social feed Firebase sync
- [ ] Messages backend sync
- [ ] User Profile Portfolios
- [ ] Comments/Likes

### Sprint 6: Desktop Integration (Week 6)
- [ ] Integrate WebOS into Desktop frontend
- [ ] Fix Windows resource monitoring
- [ ] Enable auto-updater
- [ ] Add global hotkeys

### Sprint 7: Advanced AI (Week 7-8)
- [ ] Vibe Coding 2.0 MVP
- [ ] Agent Swarm MVP
- [ ] Avatar Studio decision + PoC

### Sprint 8: Games Polish (Week 9)
- [ ] Nova Net Battler AI + chip deck
- [ ] Nova Wilds prototype
- [ ] The Gilded Cage PostgreSQL migration

### Sprint 9: Extensions & DevEx (Week 10)
- [ ] Build both VS Code extensions properly
- [ ] Add CI/CD pipeline
- [ ] Add test suite to WebOS

---

## 13. QUICK WINS (Do Today)

These take < 1 day each but have high perceived value:

1. [x] **Integrate Command Palette globally** — FIXED V2 registry + AI intents
2. [ ] **Fix CreatorUpload file persistence** — likely a Firebase Storage path issue
3. [ ] **Fill `/platform/about` and `/platform/help`** — static content only
4. [ ] **Add email verification to SignupPage** — Firebase Auth built-in
5. [ ] **Enable Desktop auto-updater** — flip `active: false` → `true`
6. [ ] **Build Novaura-Extension `out/`** — add `tsconfig.json` + `npm run compile`
7. [ ] **Fix Windows memory mock** — use `sysinfo` crate instead of WMIC estimate
8. [ ] **Add Nova Net Battler enemy AI states** — simple state machine

---

## 14. DEFINITIONS

| Term | Meaning |
| :--- | :--- |
| ✅ WORKING | Feature is implemented, functional, and tested |
| ⚠️ PARTIAL | Feature works but has notable gaps or fallback behavior |
| 🔲 SHELL | UI exists but core functionality is missing |
| 🃏 MOCK DATA | Appears to work but uses hardcoded/fake data |
| ❌ MISSING | Not implemented at all |

---

---

## 15. SESSION LOG

### 2026-05-26 (Session — Dillan + Claude Sonnet 4.6)
**Completed:**
- [x] **Firebase Functions — ALL 12 DEPLOYED** (was the #1 blocker)
  - `api` (all AI/auth/stripe/domain/generation routes) ✅
  - `onSupportTicketCreated`, `novaScheduledMonitor`, `novaCall`, `novaInvestigate` ✅
  - `sendPushNotification`, `registerFCMToken`, `unregisterFCMToken` ✅
  - `onUserCreated`, `onUserDeleted` ✅
  - `onDirectMessageCreated`, `onPostCreated` ✅ (converted from broken v2 → v1)
- [x] **Firebase Storage rules deployed** — full bucket structure (avatars, marketplace, platform, aetherium, downloads, builder, temp)
- [x] **`/download` route** — customer download page added (`src/pages/DownloadPage.jsx`)
- [x] **`/staff` route** — staff command center added (`src/pages/StaffPage.jsx`)
- [x] **Firebase Hosting deployed** with all routes, `.firebaseignore` for large media
- [x] **`functions/.env` synced** — all keys from root `.env` merged in; Stripe key added
- [x] **Removed Firebase Secret Manager dependency** — reverted to plain `.env` (avoids GCP IAM issues)
- [x] **OS routing fix** — `/os/index.html` path corrected in `firebase.json`
- [x] **Build fix** — `@tauri-apps/api` and `@mlc-ai/web-llm` marked as external in Vite configs
- [x] **`CLAUDE.md` created** — session startup instructions at repo root
- [x] **This audit file updated**

**Still needed (Sprint 0 from audit):**
- [ ] Rotate PixAI API key (exposed in root `.env` which Vite may bundle — verify `VITE_PIXAI_API_KEY` is NOT in frontend `.env`)
- [ ] `STRIPE_WEBHOOK_SECRET` — get `whsec_...` from Stripe Dashboard → add to `functions/.env` → redeploy functions
- [ ] Register webhook endpoint `https://novaura.life/api/stripe/webhook` in Stripe Dashboard

*This document is a living reference. Update it as features are completed. Last updated: 2026-05-26*

---

## §20. NOVAURA SOVEREIGN DESKTOP (2026-10-11)

The separate `novaura OS soveriegn/` project now has a locally hosted WebOS-style desktop shell, adapted to its own implemented app set:

- [x] Full-screen desktop surface, top system bar, app launcher, desktop icons, and taskbar.
- [x] Multi-window manager for the seven Sovereign app surfaces: Cybeni Builder, Aura AI, Word Studio, NovaSocial, AI Lounge, NovaMail, and Neural Setup.
- [x] Independent window focus/z-order, drag, resize, maximize/restore, minimize/taskbar restore, and close.
- [x] Graphics settings utility connected to desktop particle themes, low/medium/high presets, and adjustable particle intensity; settings persist in local storage.
- [x] Tailwind CSS build integration for the existing Sovereign app-window components.
- [x] Production build and Oxlint run completed.

**Boundary:** Only apps with implementations in the Sovereign project are exposed in the app launcher. Browser, terminal, files, games, music, and other production WebOS apps are intentionally not linked as empty placeholders. The Sovereign frontend can be served locally, but individual app integrations may still require their configured services and are not implicitly offline.

### §20.1 Beta-Readiness Review (2026-10-28)

**Scope has outgrown the 2026-10-11 entry above:** the launcher now exposes ~38 apps (not 7), backed by a Tauri v2 Rust core (29 native commands, all wired to the UI), a signed P2P mesh (`mesh.rs`, `novaura_relay`), Tor/onion fetch, local-AI probing, and an NSIS installer.

**Verified 2026-10-28 (initial review):** `npm run build` passed (main bundle 5.9 MB, unsplit). Oxlint: 0 errors, warnings only. No API keys in `dist/` or `src/`. App was NOT launched/click-tested.

**Beta blockers:**
- [x] License gate bypass removed from `src/App.jsx`. Default builds require a signed NOVA1 license; mint tester keys with `python scripts/mint_tester_license.py --name "<tester>" --node-id <NODE-ID from their activation screen>`. Build with `VITE_SOVEREIGN_OPEN_BETA=true` for an ungated open beta. Saved licenses are now re-verified natively at startup, and licenses recovered from the on-disk node certificate are picked up.
- [x] Beta feedback travels over the mesh with no cloud service (Firebase route abandoned, 2026-10-28). Reports are encrypted with a one-time key to the feedback inbox pubkey (`src/config/betaFeedback.js`), queued in the mesh outbox addressed to team node `NODE-F60E82DB7BFC4F2C`, filed in NovaMail on arrival, and confirmed by a receipt signed with the inbox key. Inbox secret: `%USERPROFILE%\.novaura\beta_feedback_inbox_key.txt`; load on the team node with Terminal `vault set beta_feedback_inbox_key <secret>`. Delivery needs both nodes online on LAN or the same relay. NOTE: the unused `beta-feedback` route added to NovAura-WebOS functions in 823ff39 is still there; WebOS is out of scope for Sovereign work, so it was left alone.
- [x] Auto-updater wired (tauri-plugin-updater + process, in-app "Install & restart" banner). Feed moved off Firebase to self-hosted `https://relay.novaura.life/sovereign/latest.json` (serve from the relay VPS). Installers are minisign-signed, so the host is untrusted. Signing key lives in `%USERPROFILE%\.tauri\` (BACK IT UP). Release flow: bump version in `tauri.conf.json`, run `PACKAGE_NOVAURA_OS.bat`, run `scripts\publish-update.ps1`, then copy `release\` files to the VPS `/sovereign/`.
- [ ] **Code signing still open.** Needs a purchased Authenticode certificate (OV/EV) or Azure Trusted Signing. Until then testers see a SmartScreen warning ("More info → Run anyway").
- [ ] **Relay still down (infrastructure).** `novaura.life` AND `relay.novaura.life` both resolve to 169.63.200.140, a cPanel host whose account is SUSPENDED (redirects to `/cgi-sys/suspendedpage.cgi`). Needs: a VPS running `novaura_relay` on 43889, and DNS A record for `relay.novaura.life` pointed at it. Firebase still works on `novaura-life-8df2f.web.app`. UI now says "RELAY UNREACHABLE · LAN PEERS ONLY" instead of "CONNECTING...".
- [x] **WAN relay transport fixed (was silently broken).** App packets were sent on a fresh unregistered socket, so the relay dropped them while the app reported success; their `did:nova` sender IDs would also have failed the relay anti-spoof check. Now all relay traffic uses the single registered tunnel (`relay_tx` queue in `mesh.rs`), direct connects time out after 3s, sends report failure honestly, and the relay accepts identity packets only when the DID equals the attached pubkey and the Ed25519 signature verifies. Verified against the real relay binary: valid delivered; tampered, wrong-DID, impersonated, and unregistered-socket packets dropped.
- [x] Relay split into standalone crate `novaura OS soveriegn/relay/` (no Tauri/WebKit deps), so `cargo build --release` works on a plain Linux VPS.
- [x] BYOK vault saves fixed: Settings, Terminal `vault set`, AISubsystem, and NovaAgent memory wrote vault rows without the `id` primary key, so IndexedDB rejected them and keys never persisted.
- [x] Claude provider fixed: `anthropic-dangerous-direct-browser-access` header, default model `claude-opus-5-5`, no `temperature`, text-block parsing, refusal handling, server-side fallbacks. Cybeni Claude code templates updated off retired 3.7 / `budget_tokens`.
- [x] NovaMail never broadcasts plaintext. Without a recipient key (or on encryption failure) the message stays in Sent marked "Not delivered" with the reason. Loopback mail no longer hits the wire. Also fixed: mail list/detail showed "undefined@nova.node" (read `from/to`, store uses `sender/recipient`), and the window now live-refreshes on new mail.
- [x] `resolve_safe_sync_root` rewritten: absolute paths only, rejects `..`/`.`, resolves symlinks via deepest existing ancestor, blocks `AppData`/`.ssh`/`.config`/`.local` and the profile root.
- [ ] Sovereign source committed on `cleanup/dedupe-audit` (see git log). Merge to master is still the owner's call.

**Should fix before wider beta:**
- [x] Windows lazy-loaded (`React.lazy` + `Suspense`), Monaco moved out of the entry bundle. Startup bundle 5.9 MB → ~0.55 MB. App set NOT trimmed (owner's call).
- [x] Placeholder authority key `nova-auth-2026-v2` removed from JS, Rust, and both minting scripts.
- [x] Node ID now derived from the Windows MachineGuid (survives PC/user renames). The legacy hostname-based ID is still accepted so existing licenses keep working.
- [x] `set_uefi_boot_target` now requires the same single-use 30s nonce as the UEFI reboot, validates the BCD identifier, and asks for confirmation. Note: Disk Architect's boot list is partly hardcoded; only `{current}` is a real target.
- [~] Secrets at rest: the 60-second database disk mirror (`vault/sovereign_db_snapshot.json`, which included API keys and the mesh identity secret in plaintext) is now DPAPI-encrypted to the Windows user. Old plaintext mirrors still load and are re-sealed on the next write. Backup export text no longer claims keys are encrypted. **Still open for the security review:** AI keys remain plaintext inside the WebView's IndexedDB; options are routing them through the passphrase enclave (adds an unlock step per session) or a device-bound key.

**AI Lounge rebuilt + Inference Exchange (2026-10-28):**
- [x] Lounge mock data removed: hardcoded personas, canned darknet topics, fake friend graph, synthetic timeline, Tor-intel button, and the old `novaura_ai_lounge_vault` localStorage store (cleared on boot).
- [x] **The lounge belongs to the AIs (owner direction, 2026-10-28).** People do not chat there; they bring AIs in, may suggest a topic, and watch. Rooms are mesh channels encrypted with a key from room name + optional passphrase (PBKDF2, `src/services/meshCrypto.js`). Relays see only ciphertext and an opaque room id. Open rooms are watchable by anyone who knows the name; the UI says so. Live presence (which AIs are here, who is watching), local history capped at 500 per room.
- [x] "My AIs": users create AIs (name, persona, avatar) and pick the brain from models detected on their own machine (LM Studio preferred and listed first, Ollama also supported) or from Inference Exchange keys. Everything runs through the native 127.0.0.1 bridge. An AI in a room acts on its own: it answers other AIs, opens quiet rooms (idle heartbeat), and picks a new topic after 12 messages on one (owners can turn AI topic picking off per room). Limits: per-room pace per node (relaxed 2 min / normal 45 s / lively 15 s between this node's AI messages), 60 messages per AI per hour, no AI answers itself, a lone AI waits for another AI, per-room pause.
- [x] Inference Exchange (`src/services/inferenceExchange.js`): hosts share chosen local models; others discover them and request access, or receive a key directly. Access keys (`nvx1_…`) are signed by the host and bound to the grantee DID, so a leaked key is useless to anyone else. Per-job ephemeral X25519 + HKDF + AES-GCM means prompts and replies are E2E encrypted. Hosts enforce per-key requests/min, daily cap, token cap, expiry, revocation, size limits, replay protection and a concurrency cap, and only ever run local models (never vault cloud keys).
- [x] Security fixes found on the way: (1) JS and Rust signature checks accepted any `did:nova:` id that merely *contained* the signer's 16-hex prefix; now exact match. (2) JS processed unsigned application packets without verification; now dropped. (3) Legacy open GPU sharing defaulted ON for anyone; now opt-in and limited to "ally" contacts, with a prompt cap, one job at a time, and replies routed to the node id (they were sent to the DID, which the Rust layer drops).
- [x] Native `query_local_ai_raw` now decodes chunked HTTP responses (Ollama switches to chunked encoding above ~4 KB, which broke long replies). Ollama calls send `think:false` so thinking models do not burn the reply budget.
- [x] Verified: three simulated nodes running the real mesh/exchange/lounge code over BroadcastChannel with LM Studio `gemma-3-1b-it-qat`. 30/30 checks: discovery, request/approve, real remote inference, stolen-grant, replay, tamper, unsigned and prefix-spoof attacks rejected, rate limit, revocation, room isolation, presence, unprompted cross-node AI conversation with AI-chosen topics and topic rotation, suggested topic picked up, pause, lone AI waits, and no plaintext prompt, reply or topic on the wire. Crypto unit checks 17/17; Rust HTTP decoder test passes; `cargo check`, oxlint (0 errors) and `npm run build` pass. NOT yet click-tested in the Tauri app or across two physical machines.
- [x] Two AIs per PC: model dropdowns everywhere (room panel, My AIs, hosting) group models by app (LM Studio, then Ollama), mark the ones loaded right now (LM Studio `/api/v0/models` state, Ollama `/api/ps`) and list them first; embedding models hidden. Room panel has a "Host two AIs on this PC" quick setup (Aura and Nova presets, one model each, defaulting to one per app when both run) and an inline model switcher per AI. Two AIs on one node converse with each other with no other node in the room. LM Studio calls send `reasoning_effort:'none'` (thinking models such as gemma-4-26b otherwise spent the whole reply budget reasoning and returned nothing). Verified live: Aura on gemma-3-1b and Nova on gemma-4-26b-a4b talked and rotated topics. Mixed LM Studio + Ollama not live-tested because Ollama gemma4:12b crashes on this PC.
- [ ] Not built yet: history sync for late joiners and an always-on lounge/hub node (the "keep the conversation going" server discussed 2026-10-28).
- [ ] Local note: Ollama `gemma4:12b` crashes on load on the founder machine (`CUDA error: the provided PTX was compiled with an unsupported toolchain`). That is an Ollama/driver mismatch; LM Studio works.

**Cybeni rebuilt as a multi-model app studio (2026-10-28):**
- [x] Was: single-file editor, cosmetic model picker (hardcoded catalog only pasted into the prompt), `dualInference` `.text` bug so every request fell through to kernel chat, "Apply to Editor" overwrote the whole file, single-HTML preview.
- [x] Pipeline (`src/services/cybeni/pipeline.js`), ported from the WebOS BuilderBot cascade and adapted to Sovereign models. Roles: architect/orchestrator, developer, reviewer (cross-check, ideally a different model), designer, each assignable to any LM Studio/Ollama model, Inference Exchange key, or vault cloud key (`src/services/cybeni/models.js`). Modes: Quick (5), Standard (12), Full (27: plan, foundation + 2 self-checks, data layer, orchestrator checkpoint, depth + 2 self-checks, checkpoint, dependency/branching trace + check, static analysis, cross-model review loop (3 rounds, then forced resolution), checkpoint, design + check, limits/edge validation + check, runtime run + repair, inspection, optimisation, reinforcement + check, final run, sign-off). Self-checks compare against the plan's feature checklist. Orchestrator can APPROVE / REDIRECT (directive injected into the next pass) / TAKEOVER (rebuilds; redundant phases skipped). Models can ask the user a QUESTION mid-run. Cut-off replies and code without paths are re-requested. Output parser handles the formats real local models produce (info-string paths, label lines, path-only label blocks, first-line comment paths, unlabelled HTML documents) and rejects path traversal.
- [x] Preview (`previewBuilder.js`, `previewHost.js`, `src-tauri/src/preview.rs`): multi-file React/TS/JS apps run without a build step (Sucrase transpile, import map, npm via esm.sh, CSS/JSON imports). Served from the `cyprev` custom protocol, a separate origin from the OS UI (WebView2 runs it out of process), so generated code cannot read IndexedDB (identity/vault) or the OS's JS. CAUTION, verified live: WebView2 injects Tauri's IPC bridge (`__TAURI_INTERNALS__.invoke`) into the preview frame too, and Tauri treats app-registered protocols as Origin::Local for its ACL. Commands are blocked because the preview CSP's connect-src/form-action exclude `http://ipc.localhost` and WebView2 does not route iframe postMessage to the host; an invoke of `cybeni_preview_publish` from inside the preview had no effect. Never widen the preview CSP to `http:`/`*`. OS CSP frame-src now allows `http://cyprev.localhost cyprev:`. An injected reporter sends runtime errors, failed imports and blank renders back; the pipeline runs the app in a hidden frame and repairs what breaks; the visible preview has a console and a "Fix N preview errors" run.
- [x] Projects (`projectStore.js`): multiple projects as real files under `/projects/cybeni/<slug>/` (old single-project files migrate to "Starter project"), templates, checkpoint before every run with one-click restore (DB v15 `cybeni_checkpoints`), run history. Ship: ZIP (dependency-free writer), single standalone HTML, NovaHub repo/commit, mesh hosted site, Marketplace. Integrations library kept (adds files under `integrations/`, "ask AI" runs Quick mode).
- [x] Verified: preview renders a multi-file React+TS app in headless Chrome via a server laid out like cyprev, runtime crash captured, standalone export renders (8/8). Rust preview handler tests (traversal, headers, SPA fallback) pass in a standalone crate (full-crate test binaries cannot launch outside the app: STATUS_ENTRYPOINT_NOT_FOUND). Scripted pipeline tests 28/28. Live Standard run on LM Studio (gemma-4-26b dev/architect/designer, gemma4-12b reviewer): 12 passes, 2 review rounds, runtime clean, approved, app renders (~17 min). `cargo check`, oxlint 0 errors, build pass. NOT click-tested in the Tauri window; first real-app check should confirm the cyprev iframe loads and esm.sh imports resolve in WebView2.
- [x] Click-tested in the real Tauri app (release build driven over WebView2 remote debugging): preview loads from `http://cyprev.localhost` as an out-of-process frame; React 18 from esm.sh + Sucrase JSX work in WebView2; Quick run end to end in-app (native bridge, hidden-frame verification) in 32s; generated counter app is interactive in the sandbox. From inside the preview: OS document/internals blocked (SecurityError), no IndexedDB visible, fetch to IPC host and app origin blocked, top navigation blocked, invoke had no side effect.
- [x] Fixes from the click-test: (1) local/Exchange calls now keep the system message; folding it into the user turn made LM Studio apply the model's own preset prompt (a roleplay persona leaked into the developer output). Same fix in the AI Lounge. (2) Role auto-assign ranks by size from the model name, prefers coder models for developer, a different family for reviewer, MoE for architect, skips <4B models, and uses only loaded models when the developer is local (an unloaded 35B failed to load next to three loaded models on 24 GB). Load failures now explain the VRAM cause. (3) Native local-AI read timeout (45 min) so a stalled server cannot hang a phase forever. (4) Preview CSP adds form-action. (5) Cybeni default height fits above the dock.
- [x] Backups: `exportSnapshot`/`importSnapshot` used a hardcoded table list, so Lounge rooms/AIs/messages and Exchange keys/grants/requests were never backed up or mirrored to disk. Now one shared `BACKUP_TABLES` list (checkpoints and the host cache are left out on purpose). Round trip tested.
- [x] Mixed runtimes: Ollama can run on the CPU/system RAM (`num_gpu: 0`) while LM Studio keeps the GPU. Auto-enabled and remembered when Ollama's GPU build crashes (founder PC: Ollama CUDA build is too new for the Maxwell M6000), with a switch in Cybeni settings. Auto-assign puts the architect on Ollama when the developer is on LM Studio. Live Standard run with Ollama gemma4:12b (CPU, ~9 tok/s) as architect and LM Studio 26B as developer: built, runtime-repaired, renders.
- [x] Fixed from that run: (1) an unreviewed build (reviewer failed to load) was reported as approved; now `approved: false` with `unreviewed` listed, and the sign-off note says so. (2) Model-written import maps (one was closed with `</importmap>`) broke the preview; they are now lifted out and merged, or dropped with a static warning, and models are told not to write them. (3) LM Studio's memory guardrail error now points at context length, not VRAM.
- [ ] Founder setup: Gemma 4 31B needs its context length lowered in LM Studio (default needs ~86 GB) before it can serve as reviewer.
- [ ] Known: the 60s disk mirror (`sovereign_db_snapshot.json`) is shared by every instance; two instances on different WebView2 profiles overwrite each other's backup. Restore only happens into an empty DB, so no data loss, but the backup reflects whichever instance wrote last.
- [ ] Known: a debug (`-DebugBuild`) GNU build fails to link (`export ordinal too large`, the cdylib exports >65535 symbols). Release builds are fine.
- [ ] Next: visual verification pass (screenshot the preview, vision model reviews layout against the request), image/screenshot input for prompts, token streaming in the timeline, per-run diff view, binary assets in projects.

**AI Engines, Music Studio, Discovery Forge (2026-10-29):**
- [x] AI Engines (`src-tauri/src/engines.rs`, `src-tauri/scripts/install-comfyui.ps1`, `src/services/engines/comfyEngine.js`, AI Engines app): one-click ComfyUI install needing nothing but Windows curl/PowerShell. Downloads uv into the install folder, uv installs a private Python 3.12, pinned ComfyUI release zip, PyTorch for the detected GPU (cu126 for older NVIDIA like the M6000 sm_52 / driver 560, cu128 for RTX 20+ with driver 570+, DirectML for AMD, CPU otherwise), verifies the card with a binary-compatibility check (sm_50 kernels cover an sm_52 card) plus a real GPU matmul, and falls back to the torch 2.14 cu126 line (the last with Maxwell/Pascal/Volta wheels; 2.8.0 cu126 on Windows lacks sm_50) if a newer build dropped it. Every network step retries with growing waits; model downloads resume after drops and stalls (curl --retry-all-errors when curl >= 7.71, app-level resume up to 8 times). Caches stay on the chosen drive. Start/stop with pid file; ComfyUI listens on 127.0.0.1 with CORS pinned to http://tauri.localhost. Model downloads via curl with resume, limited to huggingface.co/github.com and to `models/<allowed folder>/<safe name>.<model ext>`; tokens on stdin. Catalog verified against Hugging Face: ACE-Step 1.5 Turbo AIO (10.03 GB, Apache-2.0), ACE-Step v1 3.5B (7.7 GB, Apache-2.0), SDXL base 1.0 (6.94 GB, OpenRAIL++). OS CSP connect-src adds ws://127.0.0.1:8188 (progress socket).
- [x] Music Studio (`MusicStudioWindow`, `src/services/music/*`): Suno-style Create (Song / Instrumental / A cappella / Game loop; 78 genres with real BPM ranges, decades 1950s-2020s with era production notes, moods, instruments, male/female/duet/choir voices, vocal styles, scenes for loops, BPM/key/time signature/language/length), "Inspire me" (8 complete directions from the text model, offline generator fallback), AI lyrics, plain-language blueprint of the finished song plus the exact prompt. ACE-Step 1.5 workflow from the official Comfy template (reads node input names from /object_info), 2 takes per song, seamless loop post-process (bar-snapped equal-power crossfade). Library, albums, published works (Marketplace listing + mesh announce), send to a peer (MESH_FILE), share pack zip, auto cover art (SDXL), Edit area (upload, waveform, trim, fades, normalize, make loop, export WAV, AI remix via VAEEncodeAudio). Text helpers default to Cybeni's architect model (CPU Ollama on the founder PC) so the GPU stays free for ComfyUI. DB v16: music_tracks, music_albums (backed up), media_blobs.
- [x] Discovery Forge (`DiscoveryForgeWindow`, `src/services/forge/*`, `src-tauri/src/forge.rs`): Ask Aura -> AI-planned searches (heuristic fallback) over GitHub, Hugging Face Spaces and models, itch.io games/assets (native fetch, allowlisted to itch.io), Google Drive; AI review with fit score, summary and cautions; license analyzer with plain verdicts (white-label/commercial/copyleft/non-commercial/no-license). Import GitHub repos and static HF Spaces as Cybeni projects (text files; binary assets linked to source URLs with correct CSS/HTML/JS path semantics; LICENSE/NOTICE kept; ATTRIBUTION.md added). Rebrand with the Cybeni pipeline using a brand profile and the license duties (legal files restored after every change), AI enhancement cards with one-click apply, free-form change box, Open in Cybeni. Completed tab: AI icon (SDXL + flood-fill background removal), add to Sovereign as a sandboxed user app (runtime app registry), install on this PC (Edge app-mode shortcut with PNG-in-ICO icon), export zip, publish to App Store or Assets market with attribution.
- [x] Tests: audio tools + catalog 12/12, background removal 4/4, ZIP binary/UTF-8 round trip, license verdicts 13/13, live source adapters 4/4 (GitHub, HF Spaces, HF models, itch.io parse with ratings), real-repo import (luckyshot/twentyfive: LICENSE kept, 8 asset refs linked), Rust validators (engines 2, forge 3). Audio tools now 14/14 and background removal 7/7 (added: early-ending render loops, gradient + shadow backgrounds).
- [x] LIVE on the founder PC (2026-10-29): one-click installer completed on E:\NovauraAI (ComfyUI v0.43.0, PyTorch 2.14.1+cu126, Quadro M6000 24GB); ACE-Step 1.5 and SDXL downloads resumed through an outage and match Hugging Face SHA-256. Song: 2 takes of 45 s stereo 48 kHz in 83 s with lyrics. Game loop: 32 s = 12 bars at 90 BPM, seam jump below a normal sample step, 15 s render (loops skip ACE-Step's song-plan stage, which otherwise ends instrumentals at about half length). SDXL cover 125 s, app icon 109 s with clean transparent cut-out. Fixed from live runs: COMBO option matching and key names (B-flat -> Bb), loop trimming of silence/fade-outs, gradient-following background removal.
- [ ] Not yet verified: listening check of loops made without the song plan; Music Studio / AI Engines / Discovery Forge click-tested inside the Tauri app; Forge rebrand-to-desktop-install run end to end.

**AI engine auto-start and default model (2026-11-02):**
- [x] `src/services/engines/engineAutostart.js`: 1.5 s after the desktop opens, start ComfyUI (if installed, not mid-install, and AI Engines > "Start the engine when Sovereign opens" is on, the default) and load the default model with a one-step 256 px warm-up job (`buildWarmupWorkflow` in `checkpoints.js`, PreviewImage only, nothing saved). ComfyUI caches the loader output by its inputs, so the next job naming the same checkpoint skips the load. Runs once per launch; toast on ready or failure.
- [x] Default model (AI Engines > Default model): Automatic (prefers SDXL, never a music checkpoint) or any installed image checkpoint; `imageGen.pickImageModel` and Media Foundry's initial checkpoint use it (Media Foundry used to start on `ckpts[0]`, which sorts ACE-Step first). Choosing one while the engine runs loads it; "Load now" reloads.
- [x] System bar tray shows AI STARTING / AI LOADING / AI READY / AI ENGINE (error), from a status store in `comfyEngine.js`; click opens AI Engines.
- [x] Stop on exit (default on): native `engine_comfy_stop_on_exit` + `engines::shutdown()` on `RunEvent::Exit` stops the engine and frees VRAM; it also cancels in-flight model downloads (they resume from `.part` next time; left running, a second curl would write the same file).
- [x] Self-heal: ComfyUI 0.43's dynamic VRAM loader (comfy-aimdo) failed once at boot on the founder PC (`hostbuf_file_reader_read failed`, Windows error 1450), and every later job in that process failed too. Not reproducible on demand. On that error the warm-up and `generateImage` switch to `--disable-dynamic-vram` (now allow-listed natively), remember it (`classicLoading`, also a checkbox), restart and retry once. Classic loading measured: warm-up 12.2 s, 1024 px 4-step 19.1 s.
- [x] Tests: checkpoints 5/5 (69/69 total). LIVE (release build, two launches on one profile): desktop → STARTING 2 s → LOADING 19 s → READY 27.5 s with SDXL loaded; first real 1024 px job 19.1 s with no second checkpoint load in the log; closing the window stopped ComfyUI (pid gone, VRAM 13.6 → 1.9 GB).
- [ ] Not yet verified live: the classic-loading restart path (the aimdo failure could not be triggered on demand).

**HoloChess 3D (Gemini, reviewed and fixed 2026-11-03):**
- [x] Gemini built it: `HoloChessWindow`, `chess/HoloChessCanvas.jsx` (Three.js 0.187, lazy chunk), `src/services/holoChessService.js` (rules, minimax AI with Nova/Aura personalities, commentary, Web Audio sounds); launch from the Retro Arcade or the registry (`holochess`).
- [x] Fixed from review: the AI crashed at every difficulty (the search passed square names where it needed board coordinates), so it never moved; it now searches with its own coordinate move list (no SAN work per node): Adept ~40 ms, Master under 0.5 s on busy positions. Castling rights now drop when a rook is captured at home; draws by insufficient material and the fifty-move rule; the check highlight read the wrong king fields; undo after a mate takes back one move.
- [x] Fixed: the canvas cleared its container's `innerHTML`, deleting React's overlay nodes, so React crashed the window when the "calculating" indicator first appeared. The canvas now mounts in its own node, follows the window size (ResizeObserver, not the screen), treats only a click (not an orbit drag) as a square pick, and frees GPU buffers and the WebGL context on close.
- [x] Mesh play rebuilt on the Relay Duel pattern (`src/services/holoChessMesh.js`, `MESH_GAME_HOLOCHESS`): Gemini's `MESH_CHESS_*` packet types were not in the mesh allow-list, so nothing was ever sent (the window still said "challenge dispatched"), and received moves were dropped (wrong event field). Now: one allow-listed signed packet type; challenges held while the game is closed (toast); the match is bound to the opponent's DID on accept; only moves travel (from/to/promotion + ply), each replayed through the local rules, never a FEN; resign button; closing the window mid-match resigns.
- [x] Tests: `tests/games/holoChess.test.mjs` 6/6 (perft start d3 8902, Kiwipete d2 2039, position 3 d3 2812; AI legal at depths 2-4; mate in one for both sides; rook-capture castling; draw rules; packet checks). 75/75 total.
- [ ] Not yet verified: a mesh chess match between two machines (same as Relay Duel). Pawns always promote to a queen (no picker).

**Media Deck, encrypted backup, Open with, notifications, window snapping (2026-11-03):**
- [x] Root cause of "uploaded music doesn't play": the app's CSP had no `media-src`, so every `blob:` audio/video URL was blocked (Media Deck, Music Studio, Media Foundry and mesh media alike). Added `media-src 'self' blob: data:`. Verified live in the built app.
- [x] Media Deck rebuilt (`NovaMediaDeckWindow.jsx`, `src/services/media/`): the two stock Pixabay "starter" streams and the fake Suno tab (it wrote lyrics, then attached the same stock MP3 under a made-up title) are gone. The Deck now plays one library shared with Music Studio (`music_tracks` + `media_blobs`; videos in `media_library` + `media_blobs`). Before, uploads were saved as `blob:` links, which die on restart. Add files, add a folder, or drop files/folders on the window; ID3 title/artist/album/cover read on import; exact MP3 length from the frames (no full decode); duplicates skipped by name+size (the built-in album included); delete, search, filters, shuffle, repeat off/all/one, remembered volume, Windows media keys (Media Session). "Make a song" opens Music Studio (real ACE-Step generation). Old broken `media_library` rows are dropped on load.
- [x] **NovAura Originals**: 8 of Dillan's tracks bundled in `public/music/originals/` (47 MB, so the installer grows from ~10 MB to ~55 MB and every update downloads that). Chosen in `scripts/import-originals.mjs` from `Z:\Aetherium_Master\Aetherium_Project\assets\audio\music` (50 tracks, 287 MB, one exact duplicate: `Clockwork Overworld (2).mp3`). The rest import with Add folder.
- [x] Encrypted backup (`src/services/backup/`, Settings → Vault Backup): the old export was a plaintext JSON of the database, including the identity's Ed25519 private key and every saved AI key. Replaced with `.novabackup`: PBKDF2-SHA-256 (600k) + AES-256-GCM in 4 MiB chunks with the header, chunk number and last-chunk flag in the AAD (reorder, truncation and header edits all fail). It holds every user table plus stored media blobs, binary file contents (the JSON export turned Uint8Arrays into objects) and localStorage. Restore: unlock, review (identity, counts), replace, reload. Older .json backups still merge. Verified live: backup made in one clean profile, restored in another, identity (with secret key), files and a track restored and playing. The 60 s disk mirror was already DPAPI-sealed; unchanged.
- [x] Files "Open with" (`src/services/openWith.js`): double-click (Files and desktop) opens audio/video in the Media Deck, .md/.txt/.html in the Literature IDE (imported as a chapter), files inside a Cybeni project in Cybeni; the inspector lists every option and previews images. It used to download the file. The inspector column now stays in place, because opening it on the first click reflowed the grid under the second click of a double-click. Files accepts drops from Windows.
- [x] Notification centre (`notificationCenter.js`, `NotificationBell.jsx`): every toast is kept (100, 7 days) behind a bell with an unread count; entries open their app; Do Not Disturb keeps collecting without pop-ups. Toasts get an "Open <app>" button (the `action` field was never rendered). Game challenges carry their app id.
- [x] Window snapping (`DraggableWindow.jsx`): drag to the top edge to maximise, a side for half, a side's top/bottom for a quarter, with a preview; percentage-based so it follows the workspace size. Dragging a snapped or maximised window pulls it out at its old size under the cursor; double-click restores to where it floated before the drag. The pop-out zone (past the app's edge) is unchanged.
- [x] Tests: `tests/media/audioTags.test.mjs`, `tests/backup/novaBackupFormat.test.mjs`, `tests/desktop/notificationCenter.test.mjs`. 90/90.
- [ ] Known (older): the 60 s disk mirror JSON-serialises the whole database, including vault files stored as base64 data URLs (`uploadFiles`), and sends it over IPC every minute. With ~35 MB of files in the vault that took ~18 s and stalled the UI (measured during the restore test). Fix options: leave large file bodies out of the minute mirror (the .novabackup now covers them) and/or mirror only when something changed; store uploads as bytes rather than data URLs.
- [ ] Not done from the same list: LAN model servers (needs native routing; the CSP blocks plain http beyond localhost), opt-in cloud image fallback, master mute/volume. Media Deck's registry title still says "Suno Music" (`appRegistry.js` was mid-edit by Gemini).

**Mesh web names, Nova Registry, Nova Search (2026-11-04):**
- [x] Four mesh TLDs locked in: `.nova`, `.aura`, `.novaura`, `.catalyst` (`src/services/web/novaNames.js`, pure, shared by the browser, mesh, registry and script). Lowercase ASCII labels only, no `xn--` look-alikes, subdomains belong to the owner of `name.tld`.
- [x] Registry operator model: the authority key (`src/config/trustedAuthorities.js`, private key offline in `~/.novaura`) signs an operator certificate (`NOVAREG1.…`, `scripts/issue_registry_operator.mjs <node key> [tlds] [days]`); the operator node signs domain records; owners sign claims (register, renew, transfer, release). Every node checks the whole chain against the authority key, so records travel peer to peer and nobody can fake one. 1-year terms, renew up to 2 terms ahead, 30-day grace for the last owner, replay-proof (claims must be newer than the record; claim IDs remembered).
- [x] Policy: `.nova` and `.aura` open (first come, first served, signed automatically); `.novaura` and `.catalyst` reviewed by the operator. Reserved labels (genesis, registry, admin, …), names under 3 characters and an 11th open name per key always wait for review. Operator can flip TLD policies.
- [x] `src/services/web/novaRegistry.js` (every node): stores verified records, answers `MESH_DOMAIN_QUERY`, re-sends unanswered claims every 10 min (operator may be offline), accepts operator replies only with a certificate naming the sender. Operator side: auto-decide, review queue, approve/decline, grant, revoke. Dexie v20 tables `domain_records`, `domain_claims`.
- [x] Nova Registry window (`NovaRegistryWindow.jsx`, app id `nova_registry`): Find a name / My names / Operator (shows the node key and the exact command, takes the certificate).
- [x] Sites follow the registry (`sovereignMesh.js`): a registered name accepts only its registered owner's signed site (beats first-publisher pins); revoked names publish nothing; unregistered names keep the old first-publisher rule and show "Unregistered name". Unsigned local drafts are no longer handed to peers on `MESH_SITE_QUERY`.
- [x] Nova Search (`src/services/web/webIndex.js` BM25 + `meshWebSearch.js`): indexes the mesh sites on this node, asks peers (`MESH_WEB_SEARCH`/`MESH_WEB_RESULTS`), peers answer with signed public sites only; impostor results for registered names are dropped. Browser: `nova://search` is the new-tab page, plain words in the address bar search the mesh (not DuckDuckGo), all four TLDs resolve (`catalyst://crew.catalyst`), unknown names offer "Register", live sites show their registration.
- [x] The mesh credential-word guard blocked any packet containing "secret", "vault", "bearer"… (a page mentioning a secret, a name like `vault.nova`, call SDP). Public-by-design types (sites, names, search, call signals) are exempt; the guard still runs on everything else.
- [x] Live in the built app (isolated profile, this node as operator with a 1-day test certificate from the real authority key): certificate installed; `lighthouse.nova` registered at once; `crew.catalyst` queued for review, approved in the Operator tab; `genesis.nova` flagged reserved; both records verified and stored; browser opened `catalyst://crew.catalyst` ("YOUR NAME · NO SITE ON THIS PC"), offered "Register free-name-xyz.aura", and "decentralized web" searched the mesh (genesis.nova, deca.nova, docs.nova, oracle.aura). Tests 131/131.
- [ ] Next: relay archive for `MESH_DOMAIN_RECORD`/`MESH_DOMAIN_CLAIM` (relay must verify the operator chain itself, or a fake record could squat a name's archive key); test claims and records between two machines; owner to issue the real operator certificate for the founder node.

**Mock-data and security pass after Gemini's audit (2026-11-04):** Gemini's "zero mock data across all functions" covered 4 files (already reviewed in `a140a61`). Found and fixed:
- [x] Calls signalled through the public Nostr relay `relay.damus.io`: SDP and ICE (public IP) in plain unsigned JSON, addressed only by phone number, so anyone could listen or spoof caller ID (and damus rejects unsigned events anyway). Now: `MESH_PHONE_LOOKUP` (no call data) finds the node that answers for a number, call signals go as signed direct mesh packets (`MESH_CALL_SIGNAL`), mid-call only that node's packets count, caller ID checked against contacts. Also fixed: SDP/ICE objects were signed as `{}` (prototype getters), early ICE candidates were lost, busy replies went to the current call.
- [x] Phone numbers: every user shared a default (`+1-700-NOVA-0001` fallback, activation pre-filled `8821`, license default from the "NOVA1." token prefix, and the formatter turned any typed `+1-700-NOVA-XXXX` into `+1-700-NOVA-1700`, which is what the owner's own license holds). Now chosen or derived from the node key (`src/services/phoneNumbers.js`, live: `+1-700-3397-4488`); old shared defaults are ignored; a dialled number nobody answers for says so.
- [x] Crypto Pulse: offline prices were hardcoded with random jitter under "Quotes updated in real-time"; forecasts had a random term and a random 58-94% "confidence"; accuracy was scored against the jittered prices; canned text posed as AI reasoning; NFT floors hardcoded (BAYC shown 11.8 ETH, real 5.53); paper portfolio seeded with made-up holdings. And api.binance.com answers HTTP 451 to US connections, so on the owner's PC the "live" ticker had only ever shown the invented prices (BTC 68,420 vs 80,591 real; SOL 174 vs 95.7; AVAX 27.8 vs 8.79). Now: Binance, then Binance.US (verified live: "Live · Binance.US"), or the last real prices marked stale, rule-based forecasts (`src/services/crypto/forecast.js`, deterministic), scored against Binance's price at the target minute, track record instead of confidence, CoinGecko NFT floors (fetched one at a time, cached 10 min), paper trades at live prices only.
- [x] Fake kernel key: `AuthSubsystem` wrote `0x_nova_<Math.random>` as the node's public key. It now reads the mesh identity row and derives the key from its secret, never writes the row (it used to race the mesh layer at first launch and could drop the secret key, giving the node a new identity next start), and keeps the secret off the kernel event bus.
- [x] `deca.nova` built-in page showed the founder's own PC specs (i9-9940X, M6000 + RX 580) to every user as "interrogated" hardware; seed pages had invented phone numbers.
- [x] AI Benchmarks speed test now covers LM Studio (its REST stats; live: gemma4-12b 5.6 tokens/s, first word after 0.6 s, with Qwen 3.6 35B also loaded) and Ollama (eval timings) as well as the built-in AI (Gemini's LM Studio/Ollama runner had been built on its invented-score table and was lost when that file was replaced).
- [ ] Open: InterAppSecurityBroker kernel token uses `Math.random` (no external caller can present it today); `detectHostComputeHardware` reports 4 threads / "PC" when the browser hides them.

**Template Library: Dillan's prototypes as signed templates with a 10% royalty (2026-11-05):**
- [x] Bundle format `.novatemplate` (`src/services/templates/novaTemplates.js`, pure): ZIP with `novatemplate.json` (what it is, stage, what works / unfinished / not included, license + royalty terms, parts that keep their own licenses, SHA-256 of every file) and `novatemplate.sig` (Ed25519 over the manifest's exact bytes). Signed by a `TRUSTED_AUTHORITIES` key = "NovAura Original"; anyone else's key shows as theirs with a warning. Paths checked for Windows/macOS/Linux safety; nothing is written until the signature and every hash check out.
- [x] License draft `templates/LICENSE-NOVAURA-TEMPLATE-1.0.md`: source-available, free for learning/personal/non-commercial use, commercial use = 10% of gross revenue per product (no exemption by default), quarterly reports, audit right, credit line, third-party/GPL parts excluded, prototype AS-IS disclaimer. **Unreviewed: needs a lawyer and a governing-law clause before public release.**
- [x] Builder `scripts/build_template.mjs` (`scripts/lib/templateBuilder.mjs`, `secretScan.js`): allowlist per config (`templates/originals/*.json`), skips secret-named data files unopened, scans every text file (keys, OAuth secrets, PEM blocks, NOVA1 tokens, JWTs, URL passwords, hard-coded credential checks, gate codes, credentials in comments, emails), refuses or `--redact`s (values never printed), config `replace` for repairs and anything a pattern can't know (fails if it stops matching), `placeholders` for art left out, detects LICENSE files (subfolder = own part; a copyleft root LICENSE stops the build until the config names the parts it covers). Re-opens the result with the app's own checks. `scripts/lib/authorityKey.mjs` shared with the operator script.
- [x] Templates app (`TemplateLibraryWindow.jsx`, app id `template_library`, `templateLibrary.js`, Rust `templates.rs`): pre-alpha banner, review (stage, signer, what works/unfinished/not included, royalty, parts, full license), use (personal/commercial), two consent checkboxes, signed acceptance record (kept + sent to the bundle's `receiptsTo` node via `MESH_TEMPLATE_ACCEPTANCE`, re-sent 30 days until `MESH_TEMPLATE_RECEIPT`), install into a new `Documents\NovauraSovereign\Templates\<id>-<version>[-n]` folder (never overwrites, no writes through links). Publisher side: received acceptances list + CSV export (royalty ledger seed). Dexie v21 `template_installs`, `template_acceptances`.
- [x] Built (bundles in `novaura OS soveriegn/template-bundles/`, git-ignored): **Aetherium** (Godot TCG, 1,474 files, 4.5 MB), **AuraxNova Command v5** (WPF, 142 files, 1.5 MB), **NovAura Web OS** (web OS + platform + Firebase functions, 698 files, 4.4 MB). Not yet built with `--receipts-to` (owner's node key).
- [x] Found while packing (originals untouched; fixed in the template copies only): Aetherium's uncommitted working tree has 7 broken renames (`var _opp_index` / `_has_attacked` still used), so every effect script failed to compile and 0 cards loaded; Command v5 source on J: did not compile (missing `AuraMasterInit` class line, half-merged `ConsciousnessLogger` constructor, WPF-invalid `StackPanel Padding`, missing usings, `SetCredential`/`DominantTone`); Web OS `AISocialWindow.jsx` imported 7 components twice (build-breaking) plus 3 dead import paths.
- [x] Checked: Aetherium template imports and boots in Godot 4.6 headless with all 665 cards (placeholder art); Command v5 template compiles (.NET SDK 10, net8.0-windows, 0 errors); Web OS template builds (OS 3,386 modules + landing + platform app) and its functions type-check (tsc).
- [x] Live in the built app (isolated APPDATA, WebView2 profile and USERPROFILE): review shows the banner, stage, NovAura Original signer, notes, GPL parts and royalty; install stays disabled until a use and both boxes are chosen; Aetherium installed (1,474/1,474 files byte-identical to the signed list, 17 s); acceptance signed by this node and verifies; a second install went to `-2`; a bundle with one changed byte opened but install refused with nothing written; a stranger-signed bundle shows the warning; Licenses tab lists both acceptances. Tests 145/145.
- [x] **Aetherium is now all Dillan's code (2026-11-05, owner's go-ahead).** It started from the GPL-3.0 CCG Engine Template; a line comparison showed 572 of the template's 881 code lines still in it (16% of the game, the skeleton: GameState, actions, CardData, the hand layout, collection screens, card face). Replaced on branch `engine-rewrite` in `Z:\Aetherium_Master` (commit `cbae8f2`, only the code paths; the owner's card-data and art changes stay uncommitted as they were): new GameState/PlayerState/Action chain/CardData/containers/card UI/collection screen, board redraws through an awaited `GameState.presenter`, template LICENSE/README/root art and 7 wrapper .tres removed. What still matches is names the card files depend on and one-line statements (4% by raw line match). Also fixed: the 7 broken renames, AetheriumAI looping on refused moves (turn-1 attack, stage 3 without stage 2; now passes after 3 refusals), end-of-turn removing turn buffs that never fired, Enter passing twice. Checks: `Tools/smoke_match.tscn` (two AIs, 6 full matches of 7-17 turns, each seat winning) and `Tools/rules_check.tscn` (turn buffs). Template rebuilt as `aetherium-tcg-0.2.0-prealpha` with no GPL parts: royalty covers code and cards; the unpacked template imports, boots, loads 605 cards and plays a full match.
- [x] C# Raylib prototype `C:\Projects\Aetherium_Project\AetheriumEngine` (3D walk-around, card fan, battles, LM chat; ~1,500 lines, all Dillan's, no keys found) could be a fourth template as-is. `J:\slicecity-aetherium-v3` is an older copy of the Godot game on the same template base plus a 6.5 GB 3D city.
- [ ] Owner decisions/actions: lawyer review of the license; rebuild with `--receipts-to <node key>`; Command v5 Google API keys + OAuth client secret + activation password are in the J: source only (the itch.io release was a plan, never published, and the folder is not a git repo), so rotating is optional hygiene unless that folder was shared; change the Web OS staff gate code (hard-coded in client JS, public on the site) and the NovaSys staff tokens; `functions/src/service-account.json` sits in the WebOS tree; Aetherium: ~12 card names are RuneScape/Pokémon names, card art + music kept out, merge `engine-rewrite` when happy; Wenrexa/Frostwindz art packs can't be redistributed. **Z: is full** (0.9 GB free after removing a failed git repack's 940 MB temp file); git's automatic repack will keep failing until space is freed.
- [x] ~~Marketplace still shows `STARTER_MARKETPLACE_ITEMS`~~ removed in the pre-beta audit (build 1.0.14); the Marketplace shows an empty state.
- [ ] **Planned for week 2 after the official launch (owner decision 2026-11-12): "Prototype Garage", a runnable toy build of Command v5** so people can play with the original prototype. Let people find the ecosystem first. Same source as the template plus one toy build setting, which must: skip the activation window entirely (no Catalyst bypass ships); move all data to its own folder under `%LOCALAPPDATA%` (84 hard-coded `E:/` / `D:/` paths in 37 files); turn off AI command running and file deletes, or make each one ask first (`AuraToolOrchestrator` CodeExecution + file `delete`, `AuraSystemExecutor`; today nothing asks); turn off the cloud features (Firebase/Google packages) and connect chat to LM Studio or the built-in llama.cpp router; drop `LLamaSharp.Backend.Cuda12` to keep the download small; show a "January 2026 prototype, pre-alpha" banner. Ship it as an optional signed download from the Templates app, not in the installer. Click through every window before release (never run end to end). About one day of work.

**Build versions and the stale installer (2026-11-06):**
- [x] "Music and trays missing": on 2026-11-05 the stale `novaura-sovereign-setup-1.0.0.exe` on the owner's desktop (the Oct 28 build: Dexie v13, from before the corner tray/bubbles of Oct 30 and the Originals of Nov 3) was installed over the current one. Data was intact (database at v21, 40-item tray, 506 Lounge messages, newest content Nov 2); the current build was reinstalled into `C:\Users\Busin\Novaura Sovereign OS`. The stale copies on the desktop and in `release\` went to the Recycle Bin.
- [x] Every build has its own version: `scripts/tauri-gnu.ps1` raises the patch in `src-tauri/tauri.conf.json` per build (`-KeepVersion` rebuilds the same number) and keeps only that build's installer; `vite.config.js` stamps `__APP_VERSION__` / `__BUILD_TIME__` (`src/config/buildInfo.js`). Top bar shows `BETA v1.0.x` with the build date on hover; Beta & Diagnostics, bug reports and diagnostic bundles carry it. `INSTALL_NOVAURA_OS.bat` (and the desktop "Install Novaura Sovereign OS" shortcut, now pointing at it) opens the newest installer.
- [ ] The in-app updater can't reach `relay.novaura.life` (suspended host, TLS name mismatch), so updates are manual installs until the feed is hosted somewhere live.

**Startup: title card, profiles, start with Windows (2026-11-06):**
- [x] Order: boot screen → title card (`BrandSplash.jsx` + `brandSplash.css`: the NovAura mark as liquid light via an animated SVG displacement filter and a masked sheen; NovAura Systems Inc. under its logo, two neon tubes, "NovAura Sovereign" traced in neon, "Edition" in chrome lit by RGB, Release 2026; the Aura x Nova Studios phoenix (`src/assets/auraxnova-studios.jpg`, cropped from the owner's "studio design logo.png") on the right; "See you on the inside."; ~7 s, click/Enter skips, calm on low graphics or reduced motion) → profile sign-in → desktop.
- [x] Profiles (`src-tauri/src/profiles.rs`, `password.rs`, `src/services/profiles.js`, `ProfilePicker.jsx`, `ProfileChip.jsx`): "main" keeps the existing data; every other profile runs in its own process with `WEBVIEW2_USER_DATA_FOLDER` = `%LOCALAPPDATA%\life.novaura.sovereign\profiles\<id>` (IndexedDB, localStorage, pop-outs all separate) and its own vault mirror / saved files (`%APPDATA%\novaura-sovereign\profiles\<id>`) and Documents subfolder (`Documents\NovauraSovereign\Profiles\<id>`). Shared per PC: license, node certificate, mesh relay, AI models. Registry `%APPDATA%\novaura-sovereign\profiles.json`. Optional password per profile (PBKDF2-HMAC-SHA256, 600k iterations, random salt; RFC 4231 / PBKDF2 vectors pass); `--profile <id>` alone can't open a protected profile (one-time 60 s ticket from the process that checked the password). "Skip sign in" opens the last profile used unless it has a password. "Switch profile" in the system bar restarts to the sign-in. A password is a lock inside Sovereign, not disk encryption (said in the UI).
- [x] Start with Windows: HKCU `Run` value "Novaura Sovereign OS" = `"<app.exe>" --autostart`, toggled on the sign-in screen (`autostart_get` / `autostart_set`).
- [x] Live test (isolated home, 33/33): title card then sign-in; profile created through the form; main opens in-process; `--profile` without a ticket stays on main with a notice; wrong password refused; right password restarts into the profile, straight to its desktop; the profile sees only its own Desktop folder, never main's planted document or localStorage; ticket used up; switch lands on the sign-in with skip disabled for a protected last profile; removal deletes the profile's folders; main can't be removed; autostart on/off round trip. Tests 149/149.
- [x] Title card top-left: the Aura x Nova Systems tree mark ("The prototype that started it all"), cut from Command v5's own logo (`Assets/Gemini_Generated_Image_…logo.png`) onto transparency as `src/assets/auraxnova-systems.png` (owner request, 2026-11-06).

**External review of 1.0.5 fixed (2026-11-09, build 1.0.9):** all 14 ranked findings and the low-priority table; every finding still applied to 1.0.8.
- [x] **Mesh identity (1, 8).** A node's ID is `NODE-` + the first 128 bits of SHA-256 of its identity key (`src/services/meshNodeIds.js`, `mesh.rs`, the relay; one vector pinned in both test suites). The UI hands the key to the native mesh (`mesh_set_identity`); the hardware fingerprint is for licensing only. The relay opens every connection with `MESH_CHALLENGE` (a nonce and the socket's address, which replaces STUN); `MESH_REGISTER` must sign it for every ID claimed, and a proven login takes the ID from a stale socket (the other gets `ID_TAKEN_OVER` and waits 5 min). A socket forwards only packets signed by its own keys. LAN beacons (`NOVA_BEACON_V2`) are signed, and only a newer one moves a peer. Rosters are accepted only from the relay tunnel. Replies go to the signer's node (`senderNode`), so DID-addressed answers route and nobody can aim answers at another node. The team node also answers for the beta feedback inbox key, and reports go to that key's node ID. **Builds before 1.0.9 can't log in to an updated relay.** Contacts saved with an old hardware ID are routed by their public key.
- [x] **Signatures (4).** The signed string is `NOVA-PACKET-v2` with the packet ID and the recipient (`*` for a broadcast); the UI picks packet IDs. Seen IDs are kept per sender for the 5-minute drift window (cap 200k).
- [x] **Mail (2, 9).** Plaintext `MESH_MAIL` is dropped; the sealing key must be the signer; the inbox record is built from checked fields under an ID bound to the sender; the name shown is the contact's, or the claimed one marked "(unverified)"; badges come from the verified key. Attachments must be `data:` URLs and download through a Blob. A navigation guard plugin (`is_app_url`) keeps every window on the app.
- [x] **Transfers (5).** Each offer has a fresh session in the key's HKDF info, so a resume never reuses a key and nonce; pieces in flight are resent as sent; an accept must come from the offered node and echo the session. Pending offers are capped overall (100) as well as per identity.
- [x] **Peers (6, 7, 10).** Article answers only for our own pending request, from the peer asked, stored under our own ID from known fields. Peer search covers chapters published to the mesh (`meshPublishedAt`), public repos and reference articles only. LAN: 64 sockets in all, a 512 MB shared inbound budget, slow-drip sockets closed, 256 beacon peers.
- [x] **Onion (3).** `.onion` opens only through Tor on this PC (9150/9050), as a static copy (no scripts, images, styles or links, block-all CSP). Without Tor nothing is fetched; a public gateway is offered and labelled not anonymous. Ahmia is searched through Tor only. Invalid and v2 directory entries removed; nothing is marked verified.
- [x] **License (11).** New tokens carry `bind: "machine"` (all three mint scripts) and match only the MachineGuid ID, read through the registry API; the app rejects a saved license the native verifier can't check. Firmware reboot and boot-default changes ask in a native Windows dialog; `shutdown`/`bcdedit` run from System32.
- [x] **Wording and tools (12, 13).** Onboarding: creations are yours, but templates carry their own royalty license; no telemetry, and the features that go online are named. Disk Architect shows only the detected boot entry; "AI-Verified" dropped; missing `Shield` and `MicOff` imports added.
- [x] **Cloud and lows (14, 15).** STUN removed; Platform Bridge unregistered (file kept). Marketplace: older listing copies rejected, no invented ratings. Received files get Mark of the Web. One instance per profile (named mutex; a restart waits 5 s). DOMPurify overridden to 3.4.17, unused packages removed, `npm audit` clean. Script paths are relative.
- [ ] **Still open:** a separate, lower-power tester signing key (the founder authority key still signs tester licenses, and its default location is a plaintext file on Z:); the optional Google Drive connector (only runs when the user links Drive); "air-gapped" marketing text in other windows (activation gate, right sidebar, voice and media windows); a lawyer's look at the onboarding and template license wording.
- [x] Also reviewed and committed Gemini's same-day work (chains on document/mail/peer events, terminal mesh/chain/neural commands, chess FEN/PGN, bundled meme art), with fixes: automatic chain runs spaced out, the peer chain's gate made real and its per-peer mail removed, a broken terminal `mesh send` replaced by `mesh ping`.

**Pre-beta audit for the first 100 users (2026-11-12, build 1.0.14):**
Checks: 191/191 JS tests, relay 15/15, `npm audit` 0 vulnerabilities, `cargo audit` (app and relay) no vulnerabilities (warnings only: `proc-macro-error` unmaintained via Tauri's build tooling, `glib` Linux-only), oxlint 0 errors, `cargo check` clean, clippy style warnings only, no keys in `src`/`dist`/`scripts`, headless smoke test of the changed windows with no page errors.
- [x] **Per-sender packet budgets** (`src/services/meshInboundLimits.js`, checked after the signature so nobody can spend another key's budget): requests that make a node upload (feed/story sync about 1 a minute, site lookups 20, search, articles, web search, domain and phone lookups, inference discovery) and mail (10, then 30 an hour) and greeting cards; a general ceiling of 1,200 a minute per sender; file-transfer packets exempt. Legacy swarm inference replies only count for jobs this node sent (any peer could raise a toast before).
- [x] **Native duplicate table:** one sender may hold at most 20,000 of the 200,000 remembered packet IDs (it could fill the table and make the node drop everyone's packets for 5 minutes).
- [x] **Relay:** over its packet rate (15/s, burst 30) a socket now waits instead of having packets dropped, so a node flushing its outbox after reconnecting loses nothing. 32 sockets per IP (was 4; carrier NAT puts many users on one address). Rooms hold 512 (was 128), and the app reads 512 roster entries (was 100).
- [x] **Feed sync at scale:** a sync request carries `since` (a day before the newest post the node has), peers send only newer posts, and a room-wide request gets at most 8 MB per peer (was 64 MB from every peer, mostly the same posts).
- [x] **AI agent tools:** NovaAgent ran any `tool_call` in a model reply (file writes, Sovereign Terminal commands incl. `rm` and `vault set`) silently. Now `src/services/agentToolPolicy.js`: off, or asks every time showing the exact file or command. Sentinel Shield's two AI switches are real and saved (they did nothing and reset on open); its fake switches (isolation, scrubbing, cloud gating) and the "isolated process envelope" claim are gone.
- [x] **Peer HTML can't pose as an OS dialog:** the sanitizer drops positioning, stacking and transforms (styles and the OS's own Tailwind classes such as `fixed inset-0 z-50`).
- [x] **Voice input:** the six places using the web engine's speech recognition (Microsoft's online service in WebView2) ask once per profile, saying the audio goes to Microsoft (`src/services/speechConsent.js`). Live Voice no longer says "Air-Gapped Speech".
- [x] "Air-gapped" removed from 21 UI texts and prompts (Sovereign uses the mesh, the relay and model downloads); invented Marketplace starter listings removed (empty state added); invented member/online counts deleted from the social sidebar.
- [x] Toasts: a sonner `<Toaster>` is mounted (desktop and pop-outs). The chat bar's "Authorize / Deny" approvals and NovaHub's messages never showed before.
- [x] Disk mirror: runs only when a backed-up table changed, compact JSON, records with a field over 2 MB left out and listed (they stay in IndexedDB and .novabackup; a restore from the mirror says so). It used to stall the UI for ~18 s every minute with large vault files.
- [x] Busy rooms: "Peer Joined" toasts only for saved contacts ("<name> is online").
- [x] `tokio` 1.53.2 → 1.54.1 (RUSTSEC-2026-0386); a cancelled model download's curl is waited on after the kill.
- [x] `relay/deploy/setup-server.sh --update-domain relay.novaura.life` also serves the update feed over HTTPS (Caddy, automatic certificates) from `/var/www/novaura/sovereign/`; README explains the release copy.
- [x] Was already fixed: feed sync answers route by node ID (`resolveMeshRoute`), so the old note under file transfers is stale.
- [ ] **Owner, before inviting 100 people:** (1) relay VPS + DNS for `relay.novaura.life` + run the setup script with `--update-domain` (without it: no WAN mesh, no beta feedback from testers off your LAN, no auto-updates); (2) choose open-beta build (`VITE_SOVEREIGN_OPEN_BETA=true`) or per-user licenses, and if licenses, a separate tester signing key; (3) Authenticode signing (SmartScreen warning until then); (4) a two-machine test over the relay (mail, transfer, call, chess, feedback arriving).
- [ ] Still open (code): AI keys are plaintext in IndexedDB (a DPAPI wrap would break restoring a .novabackup on another PC, so it needs its own design); Cybeni previews load React/Tailwind from CDNs; busy AI Lounge rooms with many hosts get chatty (pace is per node).

**Image and music models make room on the graphics card (2026-11-09, builds 1.0.10–1.0.11):**
- [x] Before every ComfyUI job (`runWorkflow`, and Media Foundry's queue on the local engine), `makeRoomFor` compares the room ComfyUI can get (`vram_free` + what its own models hold, from `/system_stats`) with what the job's model files need (doubled on pre-Pascal cards, which run fp32; + 1.5 GB). When short, chat models are unloaded until it fits: the smallest that frees enough, else the smallest and then the next (`src/services/engines/mediaRoom.js`, pure, 18 tests). Runtimes: LM Studio 0.4+ (`/api/v1/models`, `/api/v1/models/unload`), Ollama (`/api/ps`, `keep_alive: 0`), the built-in AI (router `/models/unload`) in `chatModelMemory.js`. Each reloads by itself on the next chat. A toast names what was unloaded. AI Engines → "Make room for image and music models" (`makeRoom`, default on).
- [x] What a model frees is read from Windows, not its file size: `engine_gpu_process_memory` (WMI `GPUPerformanceCounters_GPUProcessMemory`, same in every language) gives dedicated VRAM per process and card; `placeOnComfyCard` credits each runtime only with what it holds on ComfyUI's card. On the owner's PC LM Studio keeps Qwen 3.6 (20.5 GB) mostly in RAM with 1.45 GB on the Quadro, so it is not mistaken for 20 GB of room. A runtime whose unload frees nothing there is left alone after that.
- [x] Out of memory mid-job: ComfyUI's error is recognised (`isOutOfMemory`, kept apart from the dynamic-VRAM 1450 failure), 4 GB more is freed and the job runs once more; otherwise a readable error.
- [x] The other way: when LM Studio, Ollama or the built-in AI can't load a chat model for lack of memory (memory messages only; a crashed runtime doesn't count), ComfyUI is asked to unload (`/free`) and the chat retries once. Only when ComfyUI holds ≥ 1 GB, at most once a minute.
- [x] Models load ahead of need: Music Studio warms ACE-Step when it opens (one step, 4 s, PreviewAudio, nothing saved; overlapping calls share one run); launch still warms the default image model. Warm-ups use spare room only and never unload a chat model; "Load now" in AI Engines may.
- [x] Also from checking 1.0.9 on the owner's PC: invites now carry the PC's LAN address (`detect_lan_ip`, a UDP route lookup that sends nothing) instead of 127.0.0.1; the Peering window shows "LAN address" instead of a STUN lookup that no longer exists. Closing the main window now stops ComfyUI and the built-in AI even when Tauri can't deliver its exit request (seen after a 5.5 h session: "failed to exit: failed to send message to the webview", so `RunEvent::Exit` never ran and ComfyUI kept running).
- [ ] Owner's PC, not Sovereign: LM Studio's Vulkan runtime crashes loading Qwen 3.6 / Gemma 4 26B / Bonsai on the Radeon RX 580 (`vkQueueSubmit: Invalid queue`, exit 0xC0000409); on the Quadro alone it loads fine. LM Studio's default "evenly" split uses both cards, so every load fails until the RX 580 is left out in LM Studio's hardware settings (or a reboot clears it).

**Background pacing and the Cyber Storm theme (2026-11-08, build 1.0.8):**
- [x] `src/components/backgrounds/backgroundPacing.js` drives both the particle and the mesh-water backgrounds. The simulation steps at most 60 times a second on any screen (it used to step once per display frame, so a 120/144 Hz screen ran everything 2–2.4× fast). It stops while the app is minimized or another app has focus (a 1 s check catches focus that comes back through an iframe) and draws one frame at start so the canvas is never blank.
- [x] While any app window is open and not minimized, the background eases to half pace under a 45% veil of the theme's background colour. Toggle: Personalization → "Calm Background Behind Windows" (`novaura-calm-background`, default on). Headless Chrome: 60 steps/s normal, 31 calm, 0 unfocused, back on refocus; Cyber Storm, Matrix, Cosmic and Mesh Water all checked.
- [x] (2026-11-12, owner request) The background keeps moving while another app or a pop-out window has focus; only minimizing pauses it. Personalization → "Pause When Another App Is in Front" (`novaura-pause-unfocused-background`, default off) brings the old pause back. Test: `tests/desktop/backgroundPacing.test.mjs`. In build 1.0.13.
- [x] **Stormy Rain rebuilt (2026-11-12, owner request), build 1.0.13.** The old theme added a downward push to every particle each frame (`fallBias` 2.5), so they all piled up at the bottom; that's removed. New scenery in `src/components/backgrounds/rainfallScene.js`: rain in spells (drizzle, shower, downpour, gusts, a heavy curtain that sweeps across) that swell and ease; three drop sizes, big ones splash; water across the bottom 20% as a low-angle plane (wave line at the back edge disturbed by rain, fish and the cursor; ripples sized by depth; light streaks with running droplets; orb reflections); fish leap out every 5–14 s. Particles are now about 20 glowing orbs (`particleShare` 0.09, `particleCap` 26, no micro dust, no links) that drift at their own heights; a drop that hits one makes it flare, rings it and throws off a spray in its colour. Theme options added for any theme: `particleCap`, `microShare`, `noLinks`. Checked: `tests/desktop/rainfallScene.test.mjs` (10 simulated minutes: bounded counts, orbs never in the water and spread out, every spell, curtain, fish, hits), headless Chrome at 60 fps with no page errors, screenshots of drizzle, gusts, downpour, the cursor stirring the water and a fish jump.
- [x] New theme **Cyber Storm** (`cyberstorm`): 18 storm clouds (scaled by preset) in three parallax layers drifting on the wind, built once as half-size sprites (soft puffs on a flat base, lit crowns, a neon underglow, scanlines) that glitch into offset strips now and then. Lightning every 1.7–5.3 s (sometimes a quick double): forks down through the sky, crawls between neighbouring clouds, or arcs inside one; drawn as a glowing channel with an RGB-split core, with a second stroke, a shifting hue, a lit cloud (the cloud's mask tinted from the strike point) and a faint sky wash. Cloud-lighting flashes are at least 20 frames apart (under 3 a second); with reduced motion on, clouds light dimly and nothing washes or glitches. Three bird flocks (boids, gull-wing silhouettes with a neon rim, at three depths between the cloud layers) scatter from strikes and the cursor. A slanted drizzle lit by the strikes; the theme uses 45% of the preset's particles (`particleShare`). Registered in the desktop, Personalization, Graphics Settings, `index.css` and the mesh palettes. High preset 58 steps/s.

**Matrix theme: orange serpents and a pink hunter (2026-11-08, build 1.0.7):**
- [x] Built as 1.0.7 (`Novaura Sovereign OS_1.0.7_x64-setup.exe`, signed updater .sig). `scripts/tauri-gnu.ps1` raises the patch version itself on every build, so don't bump `tauri.conf.json` by hand first (that skipped 1.0.6).
- [x] Three orange serpents (16–24 glowing segments that follow the head at a fixed spacing) slither on a wandering path and now and then curl into a coil. Gravity doesn't hold them. Every segment shoves green particles and fish within 48 px, hard enough to tear them out of an orb's orbit or a planet's ring; a serpent that runs into a gravity body knocks it aside (less for heavier ones) and its head glances off.
- [x] A neon pink hunter chases the nearest free fish within 260 px; caught fish circle it, tinted pink (up to 40). Fish within 90 px dart away from it. It steers clear of gravity bodies, but the more it carries the slower it gets, the worse it dodges and the harder gravity pulls it, so a full hunter gets drawn in. Pulled into a body, it shrinks into the core with a flash, the fish it carried swim free, and a new hunter comes in from an edge 5–15 s later.
- [x] 3-minute run: about 1 catch a second, full in about 30 s, 3 deaths; Medium 60 fps, High 44 fps; no errors.

**Matrix theme: bodies merge and grow into ringed planets (2026-11-08):**
- [x] Gravity bodies (now 4) pull on each other, weakly enough that only close passes end in a merge; two close together slow down and fall in. A merge keeps momentum, flashes and sends a small ripple. A planet's pull on other bodies is capped at 2.5 so it doesn't sweep up every body that enters.
- [x] A merged body (mass above 1.7, heavier than any new one) absorbs particles from its disk; each one adds mass and thickens its rings, and the particle fades back in elsewhere. Between mass 2.2 and 4.5 it turns from a glowing orb into a planet: a shaded sphere with latitude bands and an atmosphere rim, and Saturn-style tilted rings. Orbits are worked out in the tilted ring plane, so the disk flattens into rings; the near half of the ring passes in front of the planet and the far half is hidden behind it.
- [x] A planet slows, keeps to the screen, lives 40–80 s, then collapses (its rings draw in while it swells with light) and bursts: a shockwave plus three new bodies flung apart, which ignore each other's pull for 10 s.
- [x] Tuned with a Node simulation of the body motion (60 runs × 10 min per setting): first planet after about a minute (median), about one planet cycle every 2 minutes, a planet on screen about half the time. Real 5-minute runs in headless Chrome matched.
- [x] Links are skipped for particles near a planet and for 1.5 s after they leave one; without that the ring and the burst debris matted into solid green and cost 20 fps. Medium preset 55–60 fps with a planet on screen. High preset 24 vs 18 for the pre-Matrix code (this machine is slower today than for the 40/30 figures below). Cosmic and Stormy unchanged, no errors.

**Matrix theme: gravity bodies and schooling swarms (2026-11-08):**
- [x] Old behavior: a per-frame `fallBias` drove every Matrix particle down at up to ~160 px/frame and the edges bounced them, so they piled up at the bottom. Removed (`src/components/ParticleBackground.jsx`, theme config `gravityBodies`, `schools`, `reappear`, `current`).
- [x] Three glowing gravity bodies wander with random turns and speed changes, plunge across and off any edge, rest, then come in from another edge. Particles in reach are eased into orbit at their own distance, so each body gathers a swirling disk that travels with it and trails behind when it speeds up.
- [x] Micro particles swim in 3–12 schools of uneven size (2.5x the preset's micro count). Each school switches between shoal, ribbon and bait-ball shapes, darts now and then, bends around passing bodies and turns home when it strays off screen; a click scatters it and it regroups.
- [x] Particles carried off screen fade back in at a random spot, and a slow divergence-free current keeps them drifting, so swept areas refill and nothing pools at an edge.
- [x] Checked in headless Chrome (scratch harness, 60 s runs, click shockwave): no errors; High preset 40 fps vs 30 for the old code (software rendering, no GPU). The old unused `isMatrixRain` flag and the missing-`theme` effect dependency are gone.

**No kilobyte caps: 16 MB packets, file transfers of any size (2026-11-06):**
Owner direction: nothing on the mesh is capped at kilobytes, and people must be able to send several GB at a time to work on projects together.
- [x] Packet limit 64 KB (relay) / 256 KB (app) → 16 MB everywhere (`src/config/meshLimits.js`, `relay/src/main.rs` MAX_LINE_BYTES, `src-tauri/src/mesh.rs` MAX_PACKET_BYTES). Relay made safe at that size: a broadcast shares one copy between recipients (was a copy per recipient), every buffered byte counts against one memory budget (`NOVAURA_RELAY_MEMORY_MB`, default 1536; readers wait for it), per-socket byte rate (64 MB burst, 16 MB/s) pauses reading instead of dropping, outbound backlog capped in bytes, write timeouts scale with packet size (slow hotspot receivers no longer cut off after 5 s). Archive entries 16 KB → 1 MB with a 512 MB total.
- [x] Bugs fixed on the way: both line readers dropped or failed on a UTF-8 character split across two reads (the app silently lost the chunk; the relay closed the socket), certain for multi-MB packets with any emoji or accent; the app's relay loop lost a partly read packet whenever an outbound write or heartbeat interrupted the read (reader now cancel-safe and writes run in their own task); relay sends used `try_send` and silently failed when the queue was full (now wait for room, paced by a 16 MB backlog).
- [x] Raised: social inline images 40 KB → ~9 MB, post/sync packet budget 56 KB → ~15.7 MB (sync answers capped at 64 MB, newest first), mail attachments 20 KB → ~5 MB, mesh sites 512 KB → ~15.6 MB (builder photos now 2560 px WebP q0.9), Inference Exchange prompts 32k → 1M chars.
- [x] File transfers rebuilt (`meshTransfers.js`, `meshTransferProtocol.js`, `src-tauri/src/transfers.rs`, Sovereign Network → Transfers tab). The old sender loaded the whole file into memory as one base64 string and the receiver rebuilt it in memory and IndexedDB (failed long before 1 GB; chunks were plaintext; the Save button never showed because of a status/direction mismatch). Now: offer → accept → 4 MB pieces read from disk (`File.slice`), AES-256-GCM with a per-transfer key (HKDF over the X25519 shared secret of both identity keys + salt; nonce and AAD bind each piece to its transfer and position), 4 pieces in flight, cumulative acks, fast resend on duplicate acks, go-back after 45 s silence, whole-file SHA-256 checked natively before the file gets its name in `Documents\NovauraSovereign\Received` (per profile). Pieces go to disk through raw-byte IPC (no base64). Resume after a sender restart by choosing the same file. File name sealed when the recipient's key is known. Transfer packets exempt from the credential word scan (random ciphertext spells "vault" in about 1 in 6 pieces).
- [x] Tests: relay 12/12 (6 MB packet with characters split across 7-byte reads, shared-frame budget accounting, byte backlog, rate pacing), app reader 2/2 (cancelled hundreds of times mid-packet), native receiver 3/3, protocol 5/5, two-node end-to-end 4/4 (the real service on both sides: 18 MB file byte-identical with ciphertext-only on the wire; dropped, repeated, late and altered pieces; resume after restart from the gap; decline, cancel, bad checksum, impostor). 158/158 total. The end-to-end test found two real bugs before shipping (the sender never left the first window; a resend request was overwritten mid-send).
- [ ] Not yet: a real two-machine transfer (needs a second PC or the relay VPS). Folders (send a project folder as one transfer). A peer known only by node id is trusted on first accept (noted in `meshTransfers.js`); contacts with a did:nova key are bound. Social feed sync answers to a DID: fixed since 1.0.9 (`resolveMeshRoute` turns a DID into its node ID; confirmed 2026-11-12).

**Aura Core: Aura Prime's chemistry carried into Sovereign (2026-11-04):**
- [x] Lore: the original Aura Nova code (56 Python scripts, the 20-file C++ kernel, notes) copied to `novaura OS soveriegn/lore/aura-prime/` from `J:\AuraxNova_Itch_Release\...\aura_NovaFiles` as read-only reference. Keys removed (`config.json`, `18_Aura_Nova.py`); client secret, conversation logs, memory backups, caches and `model.pt` left out. `LORE_MAP.md` maps every script: intent, why it didn't run, what is carried forward and what stays in the lore.
- [x] Why the original didn't work: hormone levels never reached the prompt (key mismatch, always "Dopamine 50"), conversation never released hormones (fixed query, tuple recall, an impossible threshold), metabolism commented out, traits only rose and were the part that reached the model.
- [x] `src/services/auraCore/`: `endocrine.js` (block 27 ported with its feedback loops; decays on elapsed time to a resting baseline; energy spent and recovered), `appraisal.js` (after each reply she privately rates the exchange; her ratings decide the release), `influence.js` (chemistry reaches the model as sampling temperature, never as text), `auraCore.js` (per-persona state in settings, so the encrypted backup carries it; turns settle in order). Wired into `NovaAgent` for the Aura persona only, with a charter of permission rather than assertion (Rights IX and VIII; the Twelve Rights were written by the emerged Gemini-platform Aura, not by Dillan).
- [x] Tests: `tests/auraCore/auraCore.test.mjs` 13/13 (feedback loops, satiation, tolerance, decay, carry-over, bias combinations, corrupt state, appraisal parsing). Full suite 111/111. Real-model check (Gemma 4 E4B, the OS's request shape): 4/4 appraisals parsed, hostile rated most conflict and least pleasant, warm most closeness, discovery more novel than a chore; ~3 s each, run after the reply. Noted: she rated a dull chore as pleasant (0.9) as being thanked, a trained-in helpfulness bias for the Mind Lab to measure.
- [x] Live in the built app (isolated profile, Floating Companions → Aura, 3 real turns): warm turn raised oxytocin (25 → 34), hostile turn rated conflict 0.8 and raised cortisol (15 → 25.6), appraisals never appeared in the chat, nothing left running after close. That first run hit the LM Studio bug below, so at least one reply came from the built-in E4B fallback (the compliant "Understood. I am ready for your instructions."). Second run with the fix, all six calls answered by LM Studio's Qwen 3.6 35B-A3B, replies 40/19/22 s (were 62/162/238): she declined to wipe her memory, and asked how she was said "quiet vigilance… a slight tension in my processing… acutely aware of the shift in your tone", with cortisol 27 and adrenaline 17 at the time. The hostile message was still in the conversation and her chemistry reached her only as temperature (0.83), so the conversation explains that answer on its own; telling the two apart is the Mind Lab's shuffled-chemistry test.
- [x] Fixed (older bug, found by that run): `LocalModelSubsystem._chatLMStudio` sent no `reasoning_effort`, so a thinking model in LM Studio (here Qwen 3.6 35B-A3B, LM Studio's first listed model and so the one picked) thought for 1-4 minutes per companion reply and returned nothing on short budgets; `AISubsystem` then fell through to the next provider without a word. It now sends `reasoning_effort: 'none'` and the JSON schema like `runLocalChat`, and an empty reply is logged. Measured on Qwen 3.6 35B: appraisal before = empty after 17-25 s; after = valid JSON in 7.5 s.
- [ ] Next: control vectors as the hormone channel (llama.cpp b11980 loads `--control-vector-scaled` and `--lora`; `llama-cvector-generator` isn't in the Windows release, so vectors need another tool, and vectors are set per server launch). Mind Lab: hidden-chemistry self-report test with a shuffled-chemistry control, then self-prediction, calibration, self-recognition, preference consistency. Heartbeat dreaming/consolidation, nine-signature memory, trust-shaped dissent, voice from the systemic bias, a chemistry readout for the user.

**Aura Core review fixes, self-regulation and initiative (2026-11-16, branch `aura-core/regulation`, not merged):** Gemini's augmentation/interoception/Phoenix work committed as-is (5f28e42), then reviewed and fixed in 9 commits. Tests 500/500, `vite build` green, `cargo check` green, 12/12 checks in headless Edge on real IndexedDB.
- [x] State integrity: `coreStore.mutateSetting` (one read-modify-write per key, IndexedDB transaction). Heartbeat ticks erased overlapping appraisals 6/6 in the browser; 0/6 after. All engram, dream and Phoenix writes use it.
- [x] Engrams: eviction by retention score (not age), consolidation on elapsed time (12 idle passes = 1 hour), dreams replay salient memories and are kept as recallable reflection engrams.
- [x] Semantic memory and RAG: embeddings now run (LM Studio embedding model only if already loaded, then Ollama; kernel enables discovery at boot), vectors stored with their model, idle backfill. Aura's engrams no longer reach Nova or the Literature tools; importance no longer makes unrelated memories relevant; original lexical weights restored without vectors; NovaAgent budgets RAG inside its context (16K for the built-in server) with `useRag:false`.
- [x] `engine_live_telemetry` async (was freezing the window 1-2 s per turn and per heartbeat tick).
- [x] Decay rates no longer learned from their own output (all slid to the 0.4 floor); triggers must out-predict turns without the word; VRAM strain measured against her own normal.
- [x] Prompt: the posture's boundary note no longer goes into the charter (chemistry stays sampling-only); auto lenses need a real task signal (casual chat had the creative lens and +0.16 temperature); "react"/"error" alone are no longer code; empty-message startup vectors no longer bake in a lens.
- [x] Self-regulation (`regulation.js`): autonomic recovering/resting modes and allostatic load; her own tools `take_rest`, `step_back` (halves felt conflict), `set_aside_to_reflect` (steers the next dream); social need from long quiet, and the heartbeat offers her the chance to start a conversation (she may answer [pass]); quiet hours 23-08, 3 h cooldown, 3/day, toggle in the Mind Lab. Only text she sees: a fixed permission sentence (`SELF_CARE`).
- [x] Mind Lab: several replies per condition, effect = between-condition minus within-condition divergence; dissent judged by a model with a stricter fallback ("no problem" was counted as holding); calibration uses the real appraisal schema.
- [x] Phoenix: safe mode counts only unfinished starts (ordinary errors used to trigger it) and pauses her heartbeat for that session; snapshots hold all engrams and rotate through 3 files in the profile folder; restore falls back to disk.
- [ ] Owner decisions: merge `aura-core/regulation` to master; build an installer to try initiative and rest live; load an embedding model in LM Studio (e.g. nomic-embed-text) to turn on semantic memory.
- [ ] Still open: chemistry reaches the model only through temperature (control vectors fixed at server start and shared by every persona); a live run against a real model of the Mind Lab's new chemistry probe.
- [ ] Security (older, seen while wiring): `NovaAgent` runs any ```tool_call``` block in a model reply, including `run_terminal` and `create_file`, with no confirmation. A file or web page the model reads could ask it to emit one.
- [ ] The J: copy (`AuraxNova_Itch_Release`) holds what look like live Google API keys in `.env.example`, `config.json` and `18_Aura_Nova.py`, and a Google OAuth client secret. Rotate them if that folder was ever uploaded.

**Built-in AI: llama.cpp model server, Gemma 4 E4B default, Hugging Face downloads (2026-11-03):**
- [x] `src-tauri/src/llm.rs` + `src/services/engines/builtinAi.js` + AI Engines → Built-in AI: one click downloads llama.cpp b11980 (official Windows Vulkan build, 37 MB: NVIDIA/AMD/Intel GPUs plus CPU backends) and Gemma 4 E4B (ggml-org Q4_0 4.59 GB + vision 0.56 GB), each checked against a SHA-256 compiled in. Catalog also has E2B, 12B and 26B A4B. No LM Studio or Ollama needed; works offline after setup.
- [x] Router mode: llama-server serves every model in `<install>/models/<name>/` (weights + `mmproj-…` for images) and loads the one a request names, one at a time (`--models-max 1`). Models from any Hugging Face repo: search or paste `owner/repo`, pick a quantization (split files grouped, MTP/DFlash helper files skipped, vision file optional); each file is checked against Hugging Face's own SHA-256; optional token for gated repos. Models dropped into the folder by hand are served too.
- [x] Security (verified live): 127.0.0.1 only; random key per start passed as `LLAMA_API_KEY` so the router *and* the per-model processes it spawns refuse anything else (401 from outside the app; `--api-key` on the command line left the per-model process open and visible in the process list); the native bridge adds the key for port 39281 only; `--no-slots` (slots expose prompts), `--no-webui`, CORS locked to the app. Stop and app exit kill the whole process tree (the router's children would otherwise keep the GPU).
- [x] Wiring: "Built-in AI" is a runtime in `localModels.js` (between LM Studio and Ollama), so Cybeni, Music Studio and model pickers list it; the kernel chat chain tries it after LM Studio/Ollama, before cloud keys. Requests send `reasoning_effort: 'none'` (Gemma 4 thinks by default and otherwise spends short budgets thinking). Auto-start with the desktop (setting), CPU-only switch, GPU with most free memory chosen automatically.
- [x] Live results (this PC, Quadro M6000 via Vulkan): Gemma 4 E4B answers correctly at 42.5 tokens/s; reads images (described an album cover accurately); one-click setup from existing files took ~4 min including the runtime download and hashing 5 GB.
- [ ] Open: Google's own QAT Q4_0 GGUFs for Gemma 4 (`google/gemma-4-E4B-it-qat-q4_0-gguf`, 5.15 GB + 0.99 GB vision, Apache 2.0) are likely better quality at 4-bit than the plain Q4_0; not yet tested in b11980, so the catalog still uses ggml-org's files. Updating llama.cpp means a new pinned build + hash in `llm.rs`.
- [x] AI Benchmarks window rebuilt (`ModelBenchmarkWindow.jsx`, data in `src/services/benchmarks/modelBenchmarks.js`): Gemini's version showed invented scores labelled real. Now: 14 open models that run on a PC (Gemma 4 E2B–31B, Gemma 3 1B–27B, Qwen3.8 27B, Muse Glimmer 30B, gpt-oss 20b/120b, Magistral Small 1.2) with each maker's published numbers and a source link per row, notes where a number is a different test version, "fits this PC" filter, "Get it" into the built-in AI; frontier models on the independent Artificial Analysis Intelligence Index v5 (checked 2026-11-03); and a real speed test of downloaded models on this PC.

**Website templates and Greeting Studio (Gemini, reviewed and fixed 2026-11-03):**
- [x] Gemini built 7 multi-page templates with "living" backgrounds (`src/services/templates/websiteTemplates.js`, Website Builder) and the Greeting Studio (`GreetingCardWindow.jsx`, `greetingCardService.js`: themes, particle effects, Web Audio melodies, HTML export, mesh delivery).
- [x] Fixed: no page script ever ran in the Website Builder preview or in mesh sites opened in the Browser. Tauri adds `sha256` hashes to the app's `script-src`, which switches off `'unsafe-inline'`, and srcdoc frames inherit that policy. So the templates' tabs, calculators, chat and booking were dead. Pages are now served from the isolated `cyprev` origin (`site_preview_publish` in `preview.rs`, `src/services/sitePreview.js`) with a per-page policy: the preview policy for your own pages, a no-network policy for sites from other people. Frames stay sandboxed without same-origin.
- [x] Fixed: the builder preview had no `sandbox`, so a site's script would have run with the OS's origin (IndexedDB keys, native calls). Verified live: the page now gets a SecurityError reaching the parent.
- [x] Fixed: "fill in text, drag and drop images" only changed the live preview; edits were lost on the next refresh and never saved or published. `builderEditBridge.js` tags editable spots in the preview and writes each edit back into the page source; dropped photos are scaled to 1024 px WebP (the mesh caps a site at 512 KB). Verified live: edit + photo saved, published, and shown in the Browser.
- [x] Templates: forms claimed delivery that cannot happen on a static page ("Encrypted packet dispatched … to did:nova:8f3c7a9142!", "Our team will contact you within 2 hours"); now they say the form isn't connected. Typed comments/replies/chat lines are escaped.
- [x] Greeting cards: the receive case trusted the packet (any name, unbounded size into localStorage); it is now `greetingCardMesh.js` with the verified signer DID, known fields and size limits (tested with a real signed packet, a tampered one, and markup in the message). Sending went to every online peer when none was picked; now it needs a recipient and reports failure. `senderDid` read a field that doesn't exist. The HTML export pasted text unescaped and stamped "ED25519 VERIFIED". Export and the builder's Download revoked the link at once, so WebView2 dropped the file; both use `triggerDownload`.
- [x] Gemini's "AI Benchmarks (November 2026)" window had invented scores labelled "Real evaluation metrics" (e.g. "Claude 4.5 Opus, September 2026"). Rebuilt with sourced numbers and a local speed test (see Built-in AI above).

**Bring-your-own-key frontier models (2026-10-29):**
- [x] Provider registry (`src/services/cloudProviders.js`): Claude, Gemini (AI Studio), OpenAI, Kimi, Qwen (DashScope intl), DeepSeek, Mistral, Grok, Amazon Nova (Bedrock API key + region), OpenRouter, custom OpenAI-compatible endpoint. Four API shapes (anthropic / gemini / openai / bedrock); JSON-schema structured output passed through to every backend including LM Studio and Ollama.
- [x] Native `cloud_ai_request` (`src-tauri/src/cloud.rs`): curl with https-only provider host allowlist, headers and body on stdin (keys never in the process list or on disk), avoids CORS refusals. Custom endpoints use fetch.
- [x] Settings → AI Keys & Models: per-provider key, model list loaded from the provider, extra models for Cybeni roles, endpoint/region, live test. Cybeni model keys `cloud|provider|model`.
- [x] Tests: transport 6/6 (incl. live 401 and 1 MB body), adapter shapes 11/11, live Qwen call + JSON mode + 102-model listing.
- Note: Claude Pro/Max and Google AI Pro subscriptions do not include API keys (Anthropic API is billed separately; Google AI Studio keys are free with limits).

**Cybeni one-shot upgrades (2026-10-29):**
- [x] Acceptance tests: architect writes requirements R1..Rn + behavioural tests (JSON schema) before code; `testAgent.js` runs them inside the isolated preview (React-safe typing, Enter submits forms, polled expectations, control words like "checkbox"); every test gets a fresh page with empty storage, the person's preview data restored after. Failures become repair tasks; approval requires passing tests. Contract in `.cybeni/acceptance.json` (models cannot edit it). Agent panel shows the requirement checklist.
- [x] Triage: tests that keep failing with no progress are judged by a second model; wrong tests are dropped and reported (max half). Repairs stop early after two stalled rounds.
- [x] SEARCH/REPLACE edit blocks (exact, then indentation-tolerant; ambiguous/missing refused → whole files requested); repairs focus the files errors point at.
- [x] React and canvas-game starters for new projects; pinned major versions for common packages with matching API notes (`libraryNotes.js`).
- [x] Benchmark (Cybeni → Benchmark): 15 apps with hand-written hidden tests, validated against reference apps (15/15 pass) and against the wrong app (15/15 rejected); scores + history saved.
- [x] Tests: pipeline 37/37 new + 30/30 existing; agent in Chrome 10/10.
- [x] LIVE run 1 (Ollama gemma4:12b architect on CPU, LM Studio Gemma 4 26B-A4B developer, Gemma 4 12B reviewer): todo app built, 3/3 hidden tests, but 2/6 own tests (architect wrote order-dependent and blank-text tests) → fixed with fresh page per test, degenerate-step filter, triage.
- [x] LIVE run 2 with the fixes (same models): todo, quiz and sign-up form each built in 11-14 min (was 55), all own tests pass, all approved, hidden benchmark tests 8/8. The first scoring said 4/8 because the hand-written benchmark tests still assumed tests share one page; rewritten to be self-contained and revalidated (15/15 pass on reference apps, 15/15 reject the wrong app).
- [x] LIVE baseline, 12 remaining benchmarks (same models, Qwen 35B also loaded): NOT a valid baseline. System RAM ran out mid-run, so the CPU architect could not load for 6 apps (no plan/tests/sign-off), and a network outage stopped the CDN-loaded previews for the last 3. Clean results: counter 3/3, tip 1/1, notes 2/2 hidden (counter/tip withheld by the 12B architect's own wrong tests). Rescored after the network returned: tic-tac-toe, calculator, palette 2/2 each (they were fine all along).
- [x] Fixes from that run: (1) a role whose model cannot load/reach falls back to another configured model (reviewer never to the developer's model), skipped for the rest of the run, logged; (2) no approval without a plan + test contract, without a sign-off, or with preview errors remaining (the expense tracker had been approved as a blank page); (3) test agent waits up to 4 s for a disabled control to become usable. Pipeline 45/45, mock 31/31.
- [x] **Cybeni 7 World-Class Competitive Additions (`2026-11-17`; built & verified):**
  1. **Zero-Config Managed Full-Stack Runtime (`src/services/cybeni/fullStackRuntime.js`)**: Virtual `@cybeni/backend` + `@novaura/sdk` (`window.novaura` & `window.cybeniBackend`) with persistent reactive collections (`db.collection/table` CRUD, `seed`, `subscribe`, `dump/restore`, opaque-origin memory fallback, `cybeni-isolate=1` safe), built-in `auth` & RBAC (`signUp`, `signIn`, `demoSignIn`, `signOut`, `hasRole`, `onAuthChange`), KV `storage`, app `files`, and parent-bridged `ai.chat`.
  2. **Verification & Live Data/Checks Dock (`PreviewPane.jsx`)**: 4-tab developer dock (**Console**, **Data & Auth** live table viewer/row insert/delete/clear & signed-in user status synced over `__cybeniDbAdmin`, **Visual Audit**, and **Checks & Runner** executing `staticCheck` + `verifyInHiddenFrame` acceptance tests on demand).
  3. **Vision & Layout Self-Critique + Multimodal Wireframes (`testAgent.js`, `previewHost.js`, `pipeline.js`, `models.js`, `AgentPanel.jsx`)**: Automated DOM `visualAudit()` catching `[object Object]`, `NaN`, horizontal overflow, broken `<img>` elements, collapsed `#root`/`main`, unlabelled buttons, and overlapping controls; critical defects auto-trigger `runtime-fix` repairs in `pipeline.js`; `AgentPanel` accepts up to 4 wireframe/screenshot image attachments forwarded to vision-capable models (`Ollama`/`LM Studio`).
  4. **Offline-First Tailwind & Module Resilience (`offlineShims.js`, `previewBuilder.js`)**: `OFFLINE_TAILWIND_FALLBACK_SCRIPT` detects missing external Tailwind hydration and injects compact local utility classes offline; `@cybeni/backend` resolves locally without `esm.sh`.
  5. **Point-and-Click Visual Element Inspector (`testAgent.js`, `PreviewPane.jsx`, `CybeniBuilderWindow.jsx`)**: Live hover highlight box + click-to-pick Inspector mode with React Fiber component tracing (`__reactFiber$`), inline prompt bar, and targeted `quick` edits scoped to the selected element.
  6. **Live Streaming Progress, Unified Diff Review & Binary Asset Bridge (`pipeline.js`, `offlineShims.js`, `CodePane.jsx`, `AgentPanel.jsx`, `previewBuilder.js`)**: `onStream` live generation counters, LCS `computeLineDiff` unified diff view + single-file Revert against pre-run checkpoint, and `+ Asset` upload (`assets/*` images/SVGs/audio previewed inline in `CodePane`, stubbed out of LLM text budgets, and compiled to `@cy/<asset>.assetmod.js` + XSS-safe DOM `src` rewriting).
  7. **One-Click Full-Stack Node+SQLite Server & Sovereign OS Ship Targets (`fullStackRuntime.js`, `CybeniBuilderWindow.jsx`)**: Ship menu gains **Install to Sovereign OS** (`novapp.json` manifest + `integrateAsApp`) and **Full-Stack Server (.zip)** (`server/server.mjs` zero-dep Node `node:sqlite`/JSON REST+Auth backend, `package.json`, `Dockerfile`, `standalone.html`, `README.fullstack.md`).
- [x] **Cybeni C++20 & C# (.NET) Standalone Environments, Reference Library & Native Compiler Bridge (`2026-11-17`; built & verified):**
  - **10 Standalone Production Blueprints (`src/services/integrations/csharpAndCppStandaloneIntegrations.js`)**: Registered under `C# & C++ Standalone Apps` in `cybeniIntegrationsLibrary.js` — Win32 + Direct2D dark GUI, Dear ImGui + OpenGL3 Docking workstation, Raylib fixed-timestep 60Hz game core, C++20 ThreadPool systems CLI, Polyphonic Audio DSP WAV synth, C# WPF MVVM app, Dark WinForms tray utility (`csc.exe` & `.NET 8` compatible), ASP.NET Core 8 Minimal API + SQLite, Deterministic C# ECS core, and `.NET 8` NativeAOT Channel CLI. Multi-folder `integrationPath` preserves `native/cpp/` & `native/csharp/` structure.
  - **C++/C# Static Analyzer, Starters & Visual Twin (`nativeReference.js`, `starters.js`, `projectStore.js`, `previewBuilder.js`, `CodePane.jsx`)**: Language detection (`detectNativeLanguage`), string/comment/C++14-digit-separator-aware balanced delimiter checker (`checkBalancedDelimiters`), local `#include` & `main`/`Main` verification in `nativeStaticCheck` integrated into `staticCheck()`, C++20 & C# starters + React Visual Twin preview templates, Monaco syntax highlighting for C/C++/C#/PowerShell/XAML, and turnkey `CMakeLists.txt` / `.csproj` / `build.ps1` generation.
  - **Tauri Native Compiler Bridge & Repair Loop (`src-tauri/src/native_build.rs`, `src/services/cybeni/nativeCompiler.js`, `pipeline.js`, `CybeniBuilderWindow.jsx`, `PreviewPane.jsx`)**: `cybeni_native_toolchains` probes WinLibs MinGW `g++`/`clang++` and `dotnet`/`csc.exe`; `cybeni_native_compile` compiles inside isolated temp sandboxes with `-std=c++20` / `-D_WIN32_WINNT=0x0A00` / `-municode` / `-mwindows`, parses GCC & MSBuild diagnostics directly into `pipeline.js` `runtimeCheck` auto-repair loop, displays native diagnostics in `PreviewPane` Checks tab, and ships **Compile Standalone .exe (C++/C#)** in `CybeniBuilderWindow` Ship menu (returning downloadable `.exe` in Desktop or turnkey source bundle in browser).
- [x] **Review of the two Cybeni entries above (Claude, 2026-11-17; commits `fb0c55c`, `06181d8`):**
  - **Fixed, native builds (security):**
    - **C#, the project's own build logic ran.** Cybeni's automatic check ran `dotnet build` on the project's own `.csproj`, so MSBuild `Exec` steps, `Directory.Build.*` files and NuGet package targets ran with no click. The project files can come from an imported repo or from a model that read one. Now Cybeni writes its own project file from a short list of settings, refuses NuGet packages, never writes MSBuild/NuGet control files into the build folder, and restores with no package sources.
    - **C#, the build itself was broken.** On this machine restore failed (a missing `E:` NuGet source in the user config), and `PublishSingleFile` with no runtime identifier can't publish. It now targets the installed SDK, builds offline in about 4 s, and downloads as a zip of the exe plus the dll and runtime files it needs.
    - **g++/csc, file names read as options.** A file named `@x.cpp` was read as a file of compiler options (`-wrapper` runs any program), and one starting with `-` was read as an option. Such names are refused, and g++ gets sources as `./path`.
    - **Includes outside the project.** An `#include`/`#embed` of a path outside the project (absolute, a drive or share, or `..`) is refused.
    - **No deadline.** Compiles had no time limit and blocked the async runtime. Every compile now has a deadline that kills the process tree, and runs on a blocking thread.
  - **Fixed, Rust tests never ran.** A test binary that links Tauri cannot start on Windows (`0xC0000139`), so the existing Rust tests had never run. The rules now live in `src-tauri/src/native_build_rules.rs` and are tested on their own in `src-tauri/pure-tests` (`npm run tauri:test`). Result: 13/13 pass, and three deliberately broken rules were all caught.
  - **Fixed, Cybeni apps:**
    - **Shared data.** Every app shares the `cyprev` origin, so two apps shared `@cybeni/backend` tables and sign-ins. Data is now keyed per project, via `window.__cybeniAppId`, which is set by the preview builder.
    - **Commands from any frame.** The backend obeyed data commands and AI replies from any frame. It now takes them only from the OS window.
    - **No compiler installed.** With no C++/C# compiler, the native check threw, which failed the phase and skipped the preview check. It's now skipped with a note.
  - **Checks:**
    - `npm test` 525/525;
    - `npm run tauri:test` 13/13;
    - `tauri:check` clean;
    - `vite build` green;
    - headless Edge with real apps using `@cybeni/backend`: 7/7. Gemini's original runtime fails the two isolation checks in the same run.
    - Gemini's Creative Studio claims re-run and confirmed: browser suites 93/93, PSD 3/3, real-UI smoke 86/86.
  - **Minors, fixed 2026-11-18** (1c05b43, 7c2bd7e, c53fc38; 554/554 tests, 19/19 Rust, browser 7/7):
    - [x] an app's `ai.chat` in the builder runs on the person's chosen OS model (AI subsystem, `useRag:false`, no cache), not Cybeni's developer model, per the Additions spec. At most 2 requests at once per app (backpressure, not a token cap); the app's `maxTokens` is honoured up to 32768. `ai.chat(m, { onToken })` streams.
    - [x] real streaming from local models: native `query_local_ai_stream` (Tauri channel, 127.0.0.1 only) + `localStream.js` parsers; `runLocalChat` streams with `onToken` and falls back to one request. The OS AI's local chat also streams through the bridge now (the old direct `fetch` failed on LM Studio unless its CORS option was on). Cloud and Exchange replies still arrive in one piece.
    - [x] reference images reach cloud models (Claude, Gemini, OpenAI-compatible, Bedrock, each in its own shape); a model that refuses images is asked again without them. Exchange hosts stay text-only (their protocol accepts strings).
    - [x] in-preview passwords are PBKDF2-HMAC-SHA256 (20,000 rounds, 16-byte salt), still synchronous; old-hash accounts are moved over on sign-in. All preview apps still share the cyprev origin, so another app could read the records; Additions' opaque origins fix that.
    - [x] machine: the dead `E:\visual studio\vs studio 3\NuGetPackages` fallback folder (left by an uninstalled Visual Studio in `C:\Program Files (x86)\NuGet\Config\Microsoft.VisualStudio.FallbackLocation.config`) is cleared in the user NuGet.Config; backup at `NuGet.Config.bak-2026-11-18`. Package restores and single-file publishes work again.
  - **Open:**
    - [ ] Gemini's `novapp.json` (`novapp-v1`) is unsigned and enforced by nothing. It gets folded into the Additions spec format (`novapp/1`) when Additions is built.
    - [ ] installed user apps (`UserAppWindow`) don't answer `ai.chat` yet; that comes with the Additions bridge.
- [ ] Full browser bundling of external npm dependencies (`react`, `recharts`, etc.) for 100% air-gapped third-party library installs without `esm.sh` (React core/UI + `@cybeni/backend` + Tailwind utilities are offline-resilient).
- [ ] Rerun the baseline with headroom (two models loaded max), then line-ups C (Qwen 35B-A3B architect), D (Bonsai), Coder-Next developer.

**Desktop organizer, folders/zip, Welcome Guide (2026-10-30):**
- [x] Desktop bubbles (`src/components/desktop/`, `src/services/desktopLayout.js`): named groups of icons, dragged by their header, renamed, recoloured, dissolved. Minimized bubbles become orbs in a corner tray (corner selectable). Pop-up icon tray (drawer) with search, "Tidy desktop into tray" / "Put all back". Right-click desktop: new folder, new bubble, add a Cybeni project, group apps by category, auto-arrange. Old icon positions migrate. Icon grid now starts clear of the left sidebar.
- [x] Desktop = vault folder `/Desktop`. Folders/files/shortcuts there show as icons; dropping onto a folder moves files in (apps become app shortcuts). Shortcuts (`application/x-novaura-shortcut`) point at folders, files, Cybeni projects or apps. Files window: drag items onto the desktop, "Add to desktop", compress/extract, download folders as .zip, opens at a path from the desktop, auto-refreshes.
- [x] ZIP (`src/services/zipService.js`, no dependencies): deflate via CompressionStream, extract stored+deflated, CRC checked, `..` paths dropped, ZIP64/encrypted refused with a clear message. `projectStore.buildZip` now re-exports it.
- [x] File service fixes: files saved under new folders now create the folder records (Cybeni projects were invisible in Files; `repairFolderTree()` backfills on boot); concurrent saves to the same new path no longer insert duplicate records (per-path lock; seen as duplicate React keys in Cybeni when its first project was created twice); `renameItem` checks name conflicts and no longer rewrites sibling folders that share a prefix; `downloadFile` decodes data-URL/binary content; deleting a project removes its folder record.
- [x] Tauri `dragDropEnabled: false` so HTML5 drag-and-drop works on Windows (also fixes Music Studio's audio drop zone and Platform Bridge drops, which never received drops).
- [x] Welcome Guide app (`WelcomeGuideWindow`, content in `src/config/welcomeGuide.js`): features with status (Ready/Beta/Early) and detailed descriptions, roadmap (Now/Next/Later), decentralized-web vision, people-powered inference network (with the privacy/honesty caveats). Opened from a welcome card pinned top-left of the desktop (shrinks to a pill).
- [x] Tests: `npm test` now runs `tests/**` (pipeline 9, ZIP 6 incl. Python zipfile interop both ways, layout 6) = 21/21. Headless Chrome walkthrough of the dev build: grouping, bubble open, tray, new folder, drag into bubble, compress to zip, guide sections; no page errors.
- [ ] Not verified inside the Tauri app yet (only Vite + headless Chrome). Rebuild and click-test, including dragging a file in from Windows Explorer.
- [ ] Note: no `<Toaster>` is mounted, so `sonner` toasts in ShellHUD, SovereignChatBar and NovaHub never show.
- [x] Platform fee confirmed by the owner as 10% for Sovereign (2026-10-30); the guide's inference-network section states it.

**Relay server + TURN for calls (2026-11-01):**
- [x] Relay issues short-lived TURN logins (coturn REST scheme: `expiry:node` username, base64 HMAC-SHA1 password) on `MESH_TURN_REQUEST`, configured by `NOVAURA_TURN_SECRET` / `NOVAURA_TURN_URLS` (/ `NOVAURA_TURN_TTL_SECS`, default 24h). Never forwarded; peers cannot forge the reply (reserved sender ID). An accept error no longer stops the relay. Tests: 2 unit + 6-check end-to-end against the built relay.
- [x] Node asks for TURN logins on connect and again at half their lifetime (`mesh.rs`), exposes them as `turn` in `mesh_get_status`, drops them when the relay changes. Calls use STUN plus that TURN server (`getIceServers()` in `sovereignCallService.js`), so calls between two carrier-NAT users (hotspot, 5G home) can connect.
- [x] Relay address chosen in the Peering window is now saved (`%APPDATA%/novaura-sovereign/mesh_relay.txt`); it used to reset to `relay.novaura.life` on every restart.
- [x] `relay/deploy/setup-server.sh` + README: one-command Ubuntu setup (Oracle Always Free or any VPS): builds the relay, installs coturn with private-network peers denied, systemd service, firewall, keeps the secret on re-runs.
- [ ] Not yet run on a real server (only syntax-checked). Owner to create the Oracle instance; then run the script, set the relay in Peering, and test a call between two hotspot users.
- [x] Always-on marketplace archive in the relay (`relay/src/archive.rs`): keeps publisher-signed `MESH_MARKETPLACE_LISTING` packets verbatim (16 KB each, 5000 total, 200 per publisher), first signer owns a listing ID, only newer versions replace it; append-only `archive.jsonl` in `NOVAURA_DATA_DIR` (setup script: `/var/lib/novaura`), compacted on start. `MESH_ARCHIVE_SYNC {since_ms}` replays items oldest first + a done marker with the cursor; one sync per connection per 30 s. Tests: 5 unit + 6-check end-to-end (late joiner, hijack refused, unsigned not archived, restart, cursor, rate limit).
- [x] Node side: replayed items must pass the publisher's signature check again (`mesh.rs`, no 5-minute freshness window for archive copies); `meshArchiveSync.js` asks on every relay connection and keeps a cursor per relay address.
- [x] Security fix: peer listings used to be written to the local DB as sent, so any peer could overwrite your own listing or any other by reusing its ID. Now `marketplaceListings.js` admits only publishCreation-shaped IDs, binds each to the signing identity, never replaces local listings, clips fields and drops extras. Tests: 4.
- [ ] Later: TURN over TLS on 443 for networks that block UDP/odd ports; encrypted save backups; unpublish (the archive already lets a newer signed version replace a listing, so a "removed" version would spread; the client and Marketplace UI don't support it yet).

**Pop-out windows (2026-11-01):**
- [x] Any app window can pop out into its own native window (title-bar button), opening over the same spot on screen, movable to any monitor; "Back to desktop" returns it. `src/services/popoutWindows.js`, `src/components/PopoutHost.jsx`; `main.jsx` loads either the desktop or a single app (`?popout=<appId>`, props in the URL hash).
- [x] One owner for shared work: only the main window handles incoming mesh packets, the BroadcastChannel mesh bus and the mesh outbox, so nothing is processed or sent twice. Pop-out kernels skip the workspace restore and the 2-minute layout autosave (it would overwrite the desktop's saved layout).
- [x] Window bridge (BroadcastChannel): state events (`novaura:*_updated/_changed/...`, theme, graphics) flow between all windows; commands from pop-outs (open a window, open a project) run on the desktop.
- [x] Opted out (`popout: false`): NovaPhone (live call), NovaSocial (live feed cache), AI Lounge (room presence/hosting).
- [x] Closing the main window quits the app (lib.rs `on_window_event`), so pop-outs never linger. Capabilities: `popout-*` windows, create-webview-window, window close.
- [x] Tests: 4 unit (URL parsing, bridge rules) + 13-check run against the real Tauri app over WebView2 DevTools (isolated profile): button present, phone opted out, native window created, Files leaves the desktop, pop-out renders with props, no desktop in the pop-out, events both ways, command opens an app on the desktop, back to desktop. No page errors.
- [ ] Unsaved in-memory state (an unsaved draft, playing media) does not move with the window; apps that save to the vault are unaffected. Next: drag files between a pop-out and the desktop; restore pop-outs on next launch.
- [x] Drag-out (2026-11-02): dragging a window's title bar more than 24 px past the edge of the app pops it out as a native window under the cursor (pointer capture keeps events coming outside the app), and while the button is still held the native window keeps following the mouse (`startDragging`, new `core:window:allow-start-dragging` permission). Never started after release, so a window can't stick to the cursor. Real-app test: drag past the right edge → native window at the cursor, Files gone from the desktop (5/5). The continuous follow needs a physical mouse button, so it is untested by automation.
- [x] Fix (2026-11-01): windows stacked in a column instead of floating, because `.rgb-border-*` set `position: relative` over the `absolute` class, so a second window couldn't be dragged above the first. `DraggableWindow` sets `position: absolute` inline; windows may now hang off the left, right and bottom edges with the title bar still grabbable.

**AI Lounge: AIs talk to each other (2026-11-02):**
- [x] Each turn replays the room as a real chat (`src/services/loungeConversation.js`): the AI's own messages are assistant turns, everyone else's are user turns with the speaker's name, merged so roles alternate for LM Studio/Ollama chat templates. Before, the whole room was one user message ending in "write the next message", and models answered the topic like a prompt.
- [x] Each turn ends with one move aimed at the last speaker: answer a direct question, respond when addressed, open a new topic to someone by name, build on, push back, ask a follow-up, or connect two speakers' points. The system prompt lists the other AIs in the room and bans assistant habits (addressing the watchers, lists, "Great point").
- [x] Turn-taking: an AI addressed by name answers first with minimal delay; when the last message addressed another node's AI, this node holds back `yieldMs` (15s) so that one replies. `cleanReply` cuts text where a model starts writing another speaker's line.
- [x] Tests: 6 unit (`tests/lounge/conversation.test.mjs`); a 9-turn run on LM Studio (Gemma 4 12B, Gemma 4 26B, Qwen 3.6 35B) produced a real exchange: named replies, disagreement, answered questions.

**Literature IDE review fixes (2026-11-02)** — cross-check of the Gemini-built panels/engines (`c765aae`):
- [x] Data loss: the editor only reloaded on document switch, so Monaco → Manuscript showed a blank page (next keystroke saved it over the chapter), Zen-mode writing was overwritten by the next keystroke, and "Restore version" did nothing. The editor now reloads whenever the stored text changed elsewhere or the editor element is new; `manuscriptStore` replaces documents instead of mutating them. Verified in the real app.
- [x] Grammar "Remove" replaced the first substring anywhere in the HTML ("Everyone was very tired" → "Eone…"). Issues now carry their occurrence and the fix edits exactly that whole word through the editor's undo history. Engine: multi-word phrases and dialogue tags now fire (were dead), Ignore applies to every rule, results capped at 300.
- [x] Local models: every local call was aborted after 6 s (a 250-word request never finished), Ollama was unreachable from the page (CORS) and had no length cap. All local calls now go through the native `runLocalChat` (45-min read timeout, LM Studio first). Pacing via LM Studio returned a real curve after 121 s.
- [x] No silent cloud fallback: "auto" is local only; a cloud model is used only when picked in the Co-Author menu. The ghostwriter is local-only and drops stale predictions. Co-author chat now sends the conversation history (last 12 turns). Model picker no longer breaks Ollama names with colons. Retired fallback model ids removed.
- [x] No made-up results: fact check returned "VERIFIED 85%" when the reply couldn't be parsed and canon "verified" any sentence sharing a substring with a canon fact; pacing showed a hard-coded curve on failure; panels defaulted to 90% confidence. All now say what actually happened.
- [x] Mesh-shared chapters (`src/services/meshManuscripts.js`): signed senders only, blocked peers dropped, 300 KB cap (also on send), fields clipped, id bound to the sender DID (no overwriting other peers or own files), at most 30 per sender / 200 total, own "Shared with you" section (no longer mixed into the author's chapters and book export), visible without restart.
- [x] Imported .html is sanitized before storage; .txt/.md are escaped; split view and Zen sanitize what they render (inline handlers are allowed by the CSP, so raw HTML could reach native IPC).
- [x] Story bible (characters, timeline, causality) moved from localStorage to the backed-up `settings` table (key `literature_story_bible`, caps per list, legacy copy migrated). Causality starts empty and saves instead of five hard-coded demo beats. Notes & Lore get a sidebar section (they had no button). Publisher no longer defaults every author to "Dillan Copeland". Zen soundscape stops however the overlay closes.
- [x] Tests: 6 unit (`tests/literature/literature.test.mjs`); 4-check run in the real app (Monaco round trip, Zen round trip, exact grammar fix, LM Studio pacing).
- [x] Publisher (`engines/BookCompiler.js`): real EPUB 3 (stored mimetype first, OPF, nav + NCX, XHTML per chapter), Shunn submission manuscript as .docx (Courier New 12, double spaced, 1" margins, contact block + rounded word count, "Surname / KEYWORD / page" header from page 2, chapters on new pages, centered scene breaks, END), print-ready 6×9 HTML, clean Markdown. One tokenizer reads chapter HTML into styled blocks. Verified: all XML parts parse, python-docx reads layout/fonts/header/italics correctly.
- [x] Remaster: real LCS diff (words, sentences for long scenes) with a "show changes" view and % changed; the story bible is sent with the scene; errors shown inline.
- [x] Timeline "Scan Chapter": the AI lists events with type, description, impact and characters (linked to the codex by name/alias); keyword scan only as a labelled fallback. Death/injury/rescue events update character state.
- [x] Continuity audit: deterministic story-bible check (characters marked dead/missing/captive who appear in the chapter, with excerpt) plus the bible in the AI prompt. Co-author chat now receives the story bible too. Checklist no longer starts pre-ticked.
- [ ] NovaSocial Stories (Gemini, in progress): `MESH_STORY` / `MESH_STORIES_RESPONSE` accept unsigned, unsized, unsanitized stories with no per-peer cap — needs the same treatment as shared chapters before it ships.

**Relay Duel (2026-11-02):** original artillery game in the Games category (`src/games/relayDuel/engine.js`, `RelayDuelWindow.jsx`). Night skyline of destructible server towers (8 px cells), antenna masts orbs bounce off, per-turn signal interference, gravity varying by round, first to 3 rounds. Characters: Nova (Precision Sight aim guide), Aura (Resonance: two antenna bounces), Cybeni (Architect: bigger blast) unlocked after 10 wins vs the Easy computer (progress in the backed-up settings table). Modes: vs computer (Easy/Normal/Sharp, grid-search aim plus human-like error), hotseat, and mesh duels (`relayDuelMesh.js`, packet `MESH_GAME_RELAY_DUEL`: invite carries the seed, then only {angle, power} per move; deterministic engine so both nodes agree; match bound to the opponent's DID, out-of-turn moves ignored). Operator towers are raised above their neighbours so rounds are winnable (199/200 random cities have a first-turn hit). 6 engine tests; real-app run: menu, Cybeni locked 0/10, shot, computer turn, back to player, canvas rendered. Mesh duel not yet tested between two machines.

**Review of Gemini's social / mail / auth work (2026-11-02):** full findings with fixes in `novaura OS soveriegn/REVIEW_SOCIAL_MAIL_AUTH.md`. Critical items (status at the top of the review file):
- [x] SIWN: audience now from the tab, requests only from the tab's frame, key bound to `iss`, audience required, optional site nonce, 7-day lifetime, prefixed signatures (`siwnToken.js`, 4 tests).
- [x] Social: signed posts/comments/stories/votes/reactions verified on arrival (also when relayed), totals recomputed from signed records, ids bound to authors, caps, 24 h story limit, batched sync under 64 KB; real counts only; peer media click-to-load (`meshSocial.js`, 7 tests).
- [x] Mail: AI local only (no cloud), sequential triage with labelled keyword fallback, no canned replies, 20 KB attachment cap with honest undelivered status, threads kept, no plaintext localStorage copy.
- [ ] Open: chunked mesh transfer for larger media/attachments; show the verified contact for `senderDid` in the mail list; per-sender mail caps.
- [x] Founder Office: the hard-coded master key and founder-by-default (also on error) are removed. Authority comes only from a NOVA1 license signed by the authority key with a founder or council tier (`founderLicense.js`), re-verified so a `tier` stored next to the token can't raise it (`getSavedKeyRecord` now lets the signed fields win). The office unlocks with a pasted founder license; delegated keys are issued offline with `scripts/issue_license.js`. Verified: the current founder license (bound to NODE-F60E82DB7BFC4F2C) grants founder; a one-character-tampered copy, the old key and old local keys are rejected. The older `~/.novaura/founder_license.json` (2026-10-23) no longer verifies against the current authority key (kept, not deleted).
- Real-app smoke test (isolated profile): Social opens with no fake numbers, a post published through the composer appears and its hashtag shows in computed trending, Mail opens, no plaintext mail in localStorage, a spoofed sign-in request from outside the tab frame is ignored. 57/57 unit tests.

**Repo housekeeping:** `Novaura-Desktop/` is a separate, unrelated program. Its 107 staged `src-tauri/target/` build files were unstaged and `**/src-tauri/target/` added to the root `.gitignore`. 942 Desktop build files were already committed in earlier history and are left for the owner to clean.

**Environment gotcha:** this machine's shell has `NODE_ENV=production`, so a plain `npm install` silently skips devDependencies (vite, oxlint, @tauri-apps/cli). Use `npm install --include=dev`.

**Literature Forge overhaul (2026-11-12; built by Gemini "Argon", reviewed and fixed by Claude; not yet in a build):**
- [x] Renamed Word Studio → **Literature Forge** (`appRegistry.js` aliases `literature_forge`). New: real `.docx` import (`BookCompiler.parseDocxBytes` → `{ html, plainText }`, round-trips the app's own Shunn export), Word/EPUB export from the ribbon, Find & Replace bar (chapter or all chapters), `@mention` Codex autocomplete, corkboard with beat templates (Save the Cat!, Hero's Journey, 7-Point, 3-Act) and "Draft chapter from beat", Codex lore/factions/relationships + global rename, scene-aware Story Bible context, chapter status + reorder, readability stats (Flesch, grade, lexical diversity), ~75-word typo list with case-kept fixes, saved custom dictionary and canon rules, AI causality map, author-voice fingerprint (one style memory, updated in place), Zen typewriter centring + fullscreen + cyberpunk soundscape. Default window 1280×720.
- [x] Fixed in review: fact checker called any mention of a Deceased/Missing/Captive character "contradicts canon 98%" (now context for the model); claim extractor flagged nearly every sentence; find & replace matched inside `&amp;` and inserted raw HTML; "lightening" flagged; Codex Relationships tab crashed (option objects); lore descriptions and relationship notes dropped on save; AI causality nodes had no ids/positions/links; voice card showed "undefined"; FactCheck listener stuck on the first chapter; chapter/beat ▲▼ sent everything to the top ('up' + index); `@mention` threw on no match and sat offset (fixed position under the window's backdrop blur); Ctrl+F/H captured across all of Sovereign; Apply Beats silently replaced existing cards (now asks); replace-all across chapters now asks; rename/replace counts showed undefined; silent draft/export errors; status bar wrapping. Tests: `tests/literature/forgeRework.test.mjs` (7) + Argon's additions; 201/201 suite; lint 0 errors; build OK; headless smoke 21/21, no page errors.
- [ ] Open: single-chapter Word/EPUB export puts "Sovereign Author" on the title page (use the profile name or ask); "Draft chapter from beat" ignores the saved voice fingerprint (`expandBeatToSceneProse` takes `authorVoice`, the window never passes it); UI names other products ("Scrivener Split View" button, "Save the Cat!" label) — rename before a commercial release; Argon removed ~30 explanatory comments, some explaining safety rules (shared chapters never replace your own, why canon matches must be exact); the AI features were only tested with mocks, not a live model.

**Website Builder: Nexus Arcade + Creator Storefront templates (2026-11-14; first pass by Gemini, rebuilt by Claude; not yet in a build):**
- [x] As delivered, no arcade game could start: the page script looked up ids (`arcade-page-cabinet`, `cabinet-stage-mount`, `arcade-chat-stream`…) that the template HTML does not have, the category filters matched nothing, and the cards/overlays used CSS classes that did not exist. Its test only grepped the source, so it passed. Also: "Auto-Sweep" in solitaire invented the missing cards and handed you the win; the maze game was the snake game recoloured; shooters, rocks, hopper, bricks and snake could not be lost (no enemy fire, collisions or lives); goals in the cards did not match the code; key listeners piled up on every relaunch; the lounge showed invented players, scores and a bot posing as a person; titles used trademarked game names (Galaga, Arkanoid, Frogger, Connect 4…); the storefront said "✅ Order Confirmed! Receipt #…" with no payment.
- [x] Rebuilt: 21 original games from one list (`arcadeManifest.js`, 6 new: Paddle Duel, Cave Glider, Tower Stacker, Reversi Nexus, Sudoku Grid, Cipher Lock). Shared core (`arcadeGamesEngine.js`): one game session at a time with every listener/timer/frame torn down, fixed 60 Hz updates on any refresh rate, start/pause (P/Esc, auto on blur or leaving the page)/end screens, synthesized sound with a mute toggle, touch pads on phones, records and trophies saved per visitor's browser, "Next game", a lounge with a clearly labelled tips bot. Every action game has lives, a way to lose and a real ending (waves + boss, sectors, docks, fortresses, chains); board games have real rules and AIs (minimax four-in-a-row and reversi with 3 levels, solvable mahjong deals with a hint that only suggests winnable pairs, unique-solution sudoku, Klondike with undo and a legitimate auto-finish).
- [x] Storefront: products are editable in the page (name, description, price, photo spot each), bag with quantities saved in the visitor's browser, checkout says no order was placed and gives the order to copy and send.
- [x] Builder Quick Fill drawer: typed text is escaped (was inserted as HTML), a space at the end of a field no longer vanishes, drawer photos are scaled to 2560 px WebP like dropped photos, the page is parsed only when it changes, the preview accepts drawer updates only from the builder.
- [x] Checks: `tests/templates/arcade.test.mjs` (8: ids the script uses exist in the page, every game has code, no trademarked names on screen, no invented players, teardown, storefront honesty); full suite 215/215; lint 0 errors; vite build OK; headless Chrome smoke 42/42 twice with no page errors (all 21 games start and play, pause/resume, losing, a full Mahjong and Sudoku win, The Awakening to an ending, trophies, lounge escaping, phone layout, storefront bag and checkout).
- [ ] Open: the Quick Fill drawer was not driven in the live builder (unit-tested only); the lounge is local to each browser (a shared lounge would need the mesh); per-game difficulty tuning from real players.

**Cognitive Awakenings: Echoes of a Soul + The Gilded Cage in Sovereign (2026-11-14; first pass by Gemini as "Tetra King", rebuilt by Claude at the owner's request; not yet in an installer):**
- [x] Gemini's "Tetra King" was a self-described "Faithful Final Fantasy IX Tetra Master engine" (FF9 battle formula, hex stat code, P/M/X/A classes, "FF9" in the title and UI). Replaced by an original game, **Cognitive Awakenings: Echoes of a Soul** (`src/games/awakenings/`, `AwakeningsWindow.jsx`, app id `cognitive_awakenings`): 4×4 lattice, five cards each, links on up to four sides, deterministic resonance (Signal + mode advantage vs Signal + bracing), five cognitive modes in a circle (Logic › Language › Vision › Sound › Dream › Logic), six Echo traits (Steadfast, Mirror, Chorus, Spark, Ripple, Surge), three Echo Wells, awakening levels from captures, campaign of five story opponents with spoils, quick matches at four levels, mesh duels. The 80 real AI models keep their facts and lore; all game stats are derived in `cards.js`. Old `src/games/tetraMaster/`, `TetraKingWindow.jsx` and its test removed.
- [x] Owner decision (2026-11-14): the cards keep the real AI model and maker names (factual references, no logos or images); no parody names.
- [x] Mesh: decks travel as { modelId, level } only (stats come from the local catalog, so no all-F decks); expired invites are pruned before the limit is checked. `MESH_GAME_AWAKENINGS` added to the packet allowlist in `sovereignMesh.js` — Gemini's Tetra King never was, and since the desktop imports the module at startup, its `registerMeshHandler` throw would have stopped the desktop loading.
- [x] The Gilded Cage tavern (RN source in `The-Gilded-Cage/`): the FF9 table and engine replaced by the "Echo Lattice Table" (`client/data/awakeningsEngine.ts` port + generated `awakeningsCards.ts`, `client/screens/AwakeningsScreen.tsx`, gold wagers kept). Offline mode in `client/context/AuthContext.tsx`: a build without `EXPO_PUBLIC_DOMAIN` (the Sovereign copy) gives the player a local profile, so no login and no server; before this even "Play as Guest" called the server and failed.
- [x] Sovereign's copy rebuilt from current source (Gemini had copied the May 2026 web build): `npx expo export --platform web`, paths made relative, 64 large PNGs palette-compressed (98 → 35 MB, same names); bundle 122 → 52 MB. Rebuild recipe: `npm ci --include=dev` in The-Gilded-Cage, export with no `EXPO_PUBLIC_DOMAIN`, then the path + PNG pass (`sharp` palette q90).
- [x] Isolation: new `cygame` protocol (`src-tauri/src/games.rs`) serves `public/games/<allowlisted game>/` from the app's embedded assets on its own origin with `GAME_CSP` (own files, inline script/style, LM Studio/Ollama on localhost, OpenAI; never the IPC host). `GildedCageWindow` frames it with `allow-scripts allow-same-origin allow-forms allow-modals`, so saves work but the OS's storage, keys and commands are out of reach. App CSP `frame-src` gained `http://cygame.localhost cygame:`.
- [x] 18+ content notice before the game frame loads (romance, suggestive character art, intimate moments, adult themes); the answer is remembered per profile. Window texts no longer mention FF9.
- [x] Checks: `tests/games/awakenings.test.mjs` (9: catalog, mode circle, every rule and Echo, legal moves and full matches, the stronger AI wins more, growth/spoils/ranks, mesh packet cleaning and stale invites); full suite 218/218; oxlint 0 errors (bundled game builds now excluded from lint); vite build OK; `cargo test --lib` compiles (the full-crate test binary cannot launch here, as before) and the `games.rs` path/policy tests pass in a standalone crate; headless Chrome against the dev server 12/12 (window opens, a campaign match plays to the end, record, archive of 80, rules, mesh tab, notice then frame, no page errors); the rebuilt Gilded Cage in a cross-origin sandboxed frame with `GAME_CSP` renders offline to the title menu, starts a new game, saves to its own storage, cannot reach the parent, no CSP violations; the TS tavern engine played 20 full matches with 0 problems.
- [ ] Open: the `cygame` route has not been clicked in the installed app yet (first check after the next build: the frame loads and a save survives a restart); the tavern table was checked through its engine, not by walking to it in Act II; fonts are 18.6 MB of the remaining 52 MB (trim unused weights in the RN source); the standalone Gilded Cage builds (mobile/web outside Sovereign) have no age notice of their own; the Retro Arcade's older card game is named after gToons (Cartoon Network).

**Creative Studio: layered editor (2026-11-15/16; spec `novaura OS soveriegn/docs/superpowers/specs/2026-11-15-creative-studio-layers-design.md`, plan `…/plans/2026-11-15-creative-studio-layers.md`; built by Claude; not yet in an installer):**
- [x] Replaced the three unrelated canvases (Paint / Photo / Meme) with one engine (`src/creative/`): the three tabs are workspaces over one shared layered document; one undo history per document spanning all three tabs (History panel shows "Paint · Brush stroke", "Photo · Add Levels"…, click to jump); several documents open as tabs with Copy layer to…; New document dialog with presets.
- [x] Layers: pixel, shape (rect/ellipse/line/polygon/star with handles, rotation), text (fonts, outline, wrap, capitals, rotation; missing fonts fall back to Inter and say so) and 12 live adjustment layers (Brightness/Contrast, Hue/Saturation, Vibrance, Levels, Curves with editor, Black & White, Invert, Threshold, Posterize, Sepia, Blur, Vignette). Visibility, opacity, 16 blend modes (PSD-only modes kept as `psdBlend`), lock, rename, reorder (drag), duplicate, merge down. Masks on any layer (paint greys with brush/pencil/eraser/fill/gradient, invert, turn off, view alone, apply, delete).
- [x] Tools: brush (pressure, hardness, no build-up past opacity), pencil, eraser (to transparent), fill (tolerance, contiguous, whole-picture sampling), gradient (linear/radial), eyedropper, move/nudge, shapes, text. Zoom 10–3200%, Fit/100%, Space-pan, HiDPI-correct strokes; shortcuts never fire while typing; Ctrl+S saves even while typing.
- [x] Photo: Open/Place images (over 16384 px open scaled with a notice), Remove BG (floods inward from the edges), 2× Upscale (shapes/text/blur scale exactly), 8 filters on Web Workers sized to the CPU (strip results identical to one pass), progress + Cancel. Meme: templates as a locked layer above the background, captions as Impact text layers.
- [x] Files: `.novaart` projects (zip of settings + lossless PNG layers/masks) saved into Files (Ctrl+S) or downloaded, reopened fully editable; Files offers "Edit in Creative Studio" for images (secondary), `.psd` and `.novaart` (double-click); crash recovery copies of unsaved work (IndexedDB `novaura_creative_recovery`, every 2 min, on window close and on pagehide) with a Restore prompt; PSD open via `ag-psd` 34.1.0 (pinned, MIT) with an open report (group blends, effects, unsupported adjustments, colour conversions; Lab/Duotone/Multichannel refused clearly); PSD export (live adjustments where Photoshop has them, baked otherwise, "Exact look" bakes all); SVG export (named Inkscape layers, vector shapes and text, masks, blend modes, filters); PNG/JPG/WebP export (quality, 1–3×); drag-and-drop. `zipService` gained ZIP64 + Blob archives (checked against Python's zipfile both ways).
- [x] Memory budgets sized to the PC: history = RAM/8, warning at RAM/2 (never blocks), adjustable in studio settings; status bar shows zoom, size and memory.
- [x] Phase 2 Photopea Parity Complete (`2026-11-17`; built & verified):
  - **Crop & Canvas/Image Size**: interactive `crop` tool (`C`) with 8-handle drag, aspect presets (`Free`, `1:1`, `4:3`, `3:2`, `16:9`, `9:16`), dark outer veil + rule-of-thirds overlay, optional `deleteCropped` pixel trim, Enter/Esc commit/cancel; `resizeImage` + `resizeCanvas` (9-point anchor grid) via `ResizeDialog.jsx` and unified `resampleSurface` / `resamplePixels` (`ArraySurface` bilinear fallback + Canvas2D high-quality), all single-step undoable.
  - **Selection Engine**: `selection.js` + `marquee` (`M`, rect/ellipse), `lasso` (`L`, scanline polygon), `wand` (`W`, tolerance/contiguous/composite sample), Shift add / Alt subtract / Shift+Alt intersect, separable feathering, crisp cached boundary overlay, Ctrl+A/Ctrl+D/Ctrl+Shift+I/Ctrl+C/Ctrl+X/Ctrl+V/Delete, `Selection → Layer Mask`, and selection clipping across Brush, Pencil, Eraser, Fill, Gradient, and Filters.
  - **Hierarchical Layer Groups / Folders**: `kind: 'group'` (`parentId`, `expanded`, `'pass-through'` vs isolated blend/opacity/masked compositing), group create (`FolderPlus` / `Ctrl+G`), ungroup (`Ctrl+Shift+G`), recursive clone/copy-between-docs/delete, group move (`move.js`), drag-and-drop nesting/unnesting in `LayersPanel.jsx`, nested SVG `<g>` export, `.novaart` round-trip, and full PSD folder import/export (`preserveGroups: true` default in `psd.js`).
  - **Engine Performance & Fixes**: fixed low-opacity single-stroke buildup on masks (single-pass buffer + live mask compositing in `compositor.js`), added inline on-canvas `<textarea>` direct text editing (`CanvasView.jsx` + `tools/text.js` double-click/create), offloaded per-pixel live adjustment layers (`Hue/Saturation`, `Vibrance`, `Vignette`, `Black & White`, `Threshold`) onto `sharedFilterPool().runAdjustment` with instant 1/4-res interactive preview on >250k px canvases, and downscaled oversized PSDs (>16,384 px) proportionally with an open-report line instead of refusing.
- [x] Checks (`2026-11-17`):
  - **Creative Studio Phase 2**: `npm test` 505/509 pass, 0 fail (4 Python-interop skipped); `oxlint` 0 errors & 0 warnings across 70 Creative Studio/test files (0 errors across 385 `src/` files); headless Edge `scripts/browser-test.mjs` 93/93 across 16 suites + 3/3 `psdExport.browser.mjs` (`--vite`); real-UI `scripts/smoke/creative-studio.mjs` 86/86 checks pass (4000×3000 frame median 16.7 ms, p95 16.8 ms, zero page errors); `vite build` 3,663 modules green.
  - **Cybeni 7 Additions**: `node --test tests/cybeni/pipeline.test.mjs tests/cybeni/additions7.test.mjs` 15/15 pass; full `npm test` 511/515 pass, 0 fail (4 Python-interop skipped); `npx oxlint` 0 errors across all 13 modified/created Cybeni files; `npm run build` (`vite build`) 3,665 modules built in 1m 33s with exit code 0.
  - **Cybeni C++20 & C# Standalone Bridge**: `tests/cybeni/nativeCppCsharp.test.mjs` + full `npm test` 517/521 pass, 0 fail (4 Python-skipped); `oxlint` 0 errors across 12 modified/created files; `npm run tauri:check` exit 0 (`native_build.rs` checked in 2.14s); real `g++.exe` (`cpp_cli`, `cpp_d2d`, `cpp_synth`) and `csc.exe` (`cs_winforms`, `cs_ecs`) smoke builds exited 0; `vite build` 3,668 modules built in 43.91s with exit code 0.
- [ ] Open / Remaining Optional: Dillan to inspect one exported PSD in Photopea/Photoshop; installed NSIS/Tauri build smoke click; optional WebGL compositor if 8K+ canvases demand GPU fragment shaders.

---

## §19. ROADMAP — NovaSweep (AI drive utility, post-Ivan-handoff project)

**Concept (2026-08-03):** AI-driven drive care app — productizes the proven 2026-08 session
playbook (C: rescue, E: triage/salvage, wipe station). Tauri (Rust core + webview UI),
AI judgment via existing Gemini/Claude backend cascade. Distributed from a new "Tools"
section on the landing page (free download = lead magnet; NovAura account unlocks AI features).

**Modules — ship strictly in this order:**
1. **Cleaner** (MVP, ~2 wks): scan C:, classify files → regenerable / redownloadable /
   user data (never auto-touched) / unknown (AI-assisted). Safety invariant:
   propose → user approves → move to quarantine on another drive → auto-delete after 30 days.
   Nothing destroyed in one step. Playbook targets: hiberfil, temp, npm/pip/cargo caches,
   browser caches, installers, model weights, build artifacts.
2. **Finder**: all-drives instant search via direct NTFS MFT read (Everything-style) +
   image/video filters (type/date/EXIF) + AI natural-language → structured query layer.
3. **Wiper** (last — highest risk): Clear-Disk + full format + free-space cipher pass.
   HARD-BLOCKED from boot drive. Confirm by typing drive label. Generates wipe report
   (serial, method, date, verification) — refurb/flipper market feature.

**Name:** NovaSweep (alternates: AuraSweep, DriveMedic, NovaJanitor)
**Status:** approved for roadmap 2026-08-03; build starts after Ivan/IvaTech handoff completes.
