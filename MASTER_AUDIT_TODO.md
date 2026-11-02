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
- [ ] Previews load React/Tailwind from CDNs, so an outage looks like broken code and the repair loop "fixes" working apps for an hour. Sovereign should vendor them locally (and the verifier should report "offline" instead of app errors).
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
- [ ] Still shallow: "EPUB" is an HTML file and "Shunn" is plain text; remaster "diff" is a word-count delta; timeline event detection is three keyword checks; remaster ignores the story bible it is passed.
- [ ] NovaSocial Stories (Gemini, in progress): `MESH_STORY` / `MESH_STORIES_RESPONSE` accept unsigned, unsized, unsanitized stories with no per-peer cap — needs the same treatment as shared chapters before it ships.

**Repo housekeeping:** `Novaura-Desktop/` is a separate, unrelated program. Its 107 staged `src-tauri/target/` build files were unstaged and `**/src-tauri/target/` added to the root `.gitignore`. 942 Desktop build files were already committed in earlier history and are left for the owner to clean.

**Environment gotcha:** this machine's shell has `NODE_ENV=production`, so a plain `npm install` silently skips devDependencies (vite, oxlint, @tauri-apps/cli). Use `npm install --include=dev`.

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
