# 🤝 NovAura Partner Developer Onboarding

> **Welcome to the team.** This guide gets you from zero to running the full NovAura
> platform locally. Read it top to bottom — every section matters.
>
> **Last updated:** May 4, 2026
> **Maintained by:** Dillan Copeland (Founder) & Antigravity AI

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Repository Access](#repository-access)
3. [Project Architecture](#project-architecture)
4. [Service Account Setup](#service-account-setup)
5. [Environment Configuration](#environment-configuration)
6. [Running Locally](#running-locally)
7. [AI Provider Configuration](#ai-provider-configuration)
8. [Deployment](#deployment)
9. [Git Workflow](#git-workflow)
10. [Troubleshooting](#troubleshooting)
11. [Contact & Escalation](#contact--escalation)

---

## 🔧 Prerequisites

Install these before cloning:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18+ (LTS recommended) | [nodejs.org](https://nodejs.org) |
| **Git** | Latest | [git-scm.com](https://git-scm.com) |
| **Firebase CLI** | Latest | `npm install -g firebase-tools` |
| **VS Code** | Latest (recommended) | [code.visualstudio.com](https://code.visualstudio.com) |

### Optional (for local AI inference)

| Tool | Purpose | Download |
|------|---------|----------|
| **Ollama** | Local LLM inference | [ollama.com](https://ollama.com) |
| **LM Studio** | Alternative local inference | [lmstudio.ai](https://lmstudio.ai) |

---

## 📦 Repository Access

### Clone the main repo

```bash
git clone https://github.com/businessdc91-alt/novaura.life-official.git "Novaura platform"
cd "Novaura platform"
```

### Related repositories

| Repo | Purpose | URL |
|------|---------|-----|
| **novaura.life-official** | Main platform (WebOS + backend) | `businessdc91-alt/novaura.life-official` |
| **auraxos** | OS Suites (modular apps) | `Polsia-Inc/auraxos` |
| **Aetherium_Master** | TCG Card Game | `lostitonce420-beep/Aetherium_Master` |
| **Aetherium-web-os-edition** | WebOS Game Edition | `businessdc91-alt/Aetherium-web-os-edition` |

> **Note:** If you don't have access, ask Dillan to add your GitHub account as a collaborator.

---

## 🏗️ Project Architecture

```
Novaura platform/
├── NovAura-WebOS/                # ⭐ MAIN APPLICATION
│   ├── src/                      # Frontend (React + Vite)
│   │   ├── App.jsx               # Root — window manager, routing, AI orchestration
│   │   ├── components/           # All UI components
│   │   │   ├── windows/          # 50+ app windows (IDE, Browser, Games, etc.)
│   │   │   ├── CommandPalette.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Toolbar.jsx
│   │   │   └── MobileLayout.jsx
│   │   ├── pages/                # Full-page routes (Landing, About, Pricing)
│   │   ├── utils/                # AI Orchestrator, helpers
│   │   └── index.css             # Global styles + theme system
│   ├── functions/                # ⭐ BACKEND (Firebase Cloud Functions)
│   │   ├── src/
│   │   │   ├── init.ts           # Firebase Admin initialization
│   │   │   ├── api/
│   │   │   │   ├── app.ts        # Express app (CORS, middleware)
│   │   │   │   ├── routes/       # All API endpoints
│   │   │   │   │   ├── ai.ts     # Multi-provider AI routing
│   │   │   │   │   ├── assets.ts # Asset marketplace pipeline
│   │   │   │   │   ├── auth.ts   # Authentication
│   │   │   │   │   ├── stripe.ts # Payment processing
│   │   │   │   │   ├── email.ts  # Email services
│   │   │   │   │   ├── vertex.ts # Vertex AI (image/video gen)
│   │   │   │   │   └── ...       # 15+ more route files
│   │   │   └── services/         # Business logic layer
│   │   ├── .env.example          # ← COPY THIS TO .env
│   │   └── package.json
│   ├── public/                   # Static assets (games, images)
│   ├── firebase.json             # Firebase hosting + functions config
│   ├── firestore.rules           # Database security rules
│   └── package.json              # Frontend dependencies
├── Novaura-Desktop/              # Tauri desktop wrapper
├── Novaura-Extension/            # VS Code extension
├── NovAura-Coding-Partner/       # AI coding assistant extension
├── NovAura-Unified/              # Cross-platform unified build
├── Kimi_Agent_Deployment_v*/     # AI agent swarm deployments
├── novaura_complete_overview_master.json  # ⭐ BUILD LOG — READ THIS FIRST
├── MASTER_AUDIT_TODO.md          # Current task list
└── GETTING_STARTED_GUIDE.md      # End-user guide
```

### Key files to read first

1. **`novaura_complete_overview_master.json`** — Current build state, recent changes, active TODOs
2. **`MASTER_AUDIT_TODO.md`** — What needs work
3. **`NovAura-WebOS/src/App.jsx`** — The brain of the frontend
4. **`NovAura-WebOS/functions/src/api/routes/ai.ts`** — Multi-provider AI routing

---

## 🔐 Service Account Setup

**⚠️ IMPORTANT: Service account credentials are NOT in the repo. You must get them from Dillan.**

### Step 1: Get your credentials

Contact Dillan to:
1. Add your Google account to the **novaura-life** Firebase project
2. Receive your **IAM role assignment** (Editor, Developer, or Viewer)
3. Generate a **service account key JSON** for your local dev environment

### Step 2: Firebase project access

Dillan will add you via the [Firebase Console](https://console.firebase.google.com):

```
Project: novaura-life
Region: us-central1
```

### Step 3: Place your credentials

Once you receive your service account JSON:

```bash
# Place it OUTSIDE the repo (never commit it!)
mkdir -p ~/.novaura
mv your-service-account.json ~/.novaura/firebase-credentials.json
```

### Step 4: Login to Firebase CLI

```bash
firebase login
firebase projects:list  # Verify you see "novaura-life"
```

### IAM Roles Reference

| Role | Can do | Who gets it |
|------|--------|-------------|
| **Owner** | Everything (billing, IAM, delete) | Dillan only |
| **Editor** | Deploy, read/write all data | Core dev partners |
| **Cloud Functions Developer** | Deploy functions only | Backend-focused devs |
| **Firebase Hosting Admin** | Deploy frontend only | Frontend-focused devs |
| **Viewer** | Read-only access | QA, testers |

---

## ⚙️ Environment Configuration

### Frontend (.env)

Create `NovAura-WebOS/.env`:

```bash
# Points to your local backend OR production
VITE_BACKEND_URL=http://localhost:3000

# For production testing:
# VITE_BACKEND_URL=https://us-central1-novaura-life.cloudfunctions.net/api
```

### Backend (.env)

```bash
cd NovAura-WebOS/functions
cp .env.example .env
```

Then edit `functions/.env` with your actual values:

```bash
# ─── Firebase Admin SDK ──────────────────────────────────────────────────
# Point to your local credentials file
GOOGLE_APPLICATION_CREDENTIALS=~/.novaura/firebase-credentials.json

# ─── AI Providers (configure at least ONE) ───────────────────────────────
# Ask Dillan for shared dev keys, OR use your own

# Google Gemini (recommended as primary)
GEMINI_API_KEY=your-key-here

# OpenRouter (1500+ models — great for testing multiple providers)
OPENROUTER_API_KEY=your-key-here

# Anthropic Claude
ANTHROPIC_API_KEY=your-key-here

# Kimi / Moonshot
KIMI_API_KEY=your-key-here

# ─── Stripe (use TEST keys for dev) ─────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Email ───────────────────────────────────────────────────────────────
SMTP_HOST=smtp.name.com
SMTP_PORT=587
SMTP_USER=your-email@novaura.life
SMTP_PASS=your-app-password

# ─── Encryption (generate with: openssl rand -hex 32) ───────────────────
VAULT_ENCRYPTION_SECRET=generate-your-own-32-byte-hex
USER_KEY_ENCRYPTION_SECRET=generate-your-own-32-byte-hex
INTERNAL_SERVICE_TOKEN=generate-your-own-token

# ─── Backend URL ─────────────────────────────────────────────────────────
BACKEND_URL=http://localhost:3000
```

> **⚠️ NEVER commit `.env` files.** They are already in `.gitignore`.

---

## 🚀 Running Locally

### Frontend only (fastest start)

```bash
cd "Novaura platform/NovAura-WebOS"
npm install
npm run dev
```

Opens at **http://localhost:5173**

### Full stack (frontend + backend)

**Terminal 1 — Backend:**
```bash
cd "Novaura platform/NovAura-WebOS/functions"
npm install
npm run build
firebase emulators:start --only functions
```

**Terminal 2 — Frontend:**
```bash
cd "Novaura platform/NovAura-WebOS"
npm install
npm run dev
```

### With local AI (Ollama)

```bash
# Terminal 3 — Start Ollama
ollama serve

# Pull a model
ollama pull llama3
ollama pull codellama

# The WebOS will auto-detect Ollama at http://localhost:11434
```

### Available dev commands

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | `NovAura-WebOS/` | Start frontend dev server |
| `npm run build` | `NovAura-WebOS/` | Production build → `dist/` |
| `npm run preview` | `NovAura-WebOS/` | Preview production build |
| `npm run lint` | `NovAura-WebOS/` | Run ESLint |
| `npm run build` | `NovAura-WebOS/functions/` | Compile TypeScript backend |
| `firebase emulators:start` | `NovAura-WebOS/` | Run all Firebase emulators |
| `firebase deploy` | `NovAura-WebOS/` | Deploy to production ⚠️ |

---

## 🤖 AI Provider Configuration

NovAura supports **10+ AI providers** with automatic fallback. Configure what you have:

### Provider Priority (production)

| Priority | Provider | Models | Use Case |
|----------|----------|--------|----------|
| 1 | **Gemini** | Flash 2.0, Pro 2.5 | Primary inference (cost-effective) |
| 2 | **Vertex AI** | Imagen 3, Veo 2 | Image/video generation |
| 3 | **Claude** | Opus, Sonnet | Complex reasoning, code gen |
| 4 | **Kimi/Moonshot** | Moonshot-v1 | Long-context tasks (128K+) |
| 5 | **OpenRouter** | 1500+ models | Fallback + variety |
| 6 | **Azure AI** | GPT-4o, Phi-4 | Enterprise fallback |
| 7 | **Ollama** | Llama 3, CodeLlama | Local/offline inference |
| 8 | **LM Studio** | Any GGUF model | Local alternative |

### Minimum viable setup

You need **at least one** provider configured. Recommended for dev:

```bash
# Option A: Gemini (free tier available)
GEMINI_API_KEY=your-key

# Option B: Ollama (completely free, runs locally)
# Just start ollama serve — no env var needed

# Option C: OpenRouter (pay-per-use, all models)
OPENROUTER_API_KEY=your-key
```

### BYOK (Bring Your Own Key)

Users can configure their own API keys in the WebOS UI:
- Settings → AI → API Keys
- Keys are encrypted with AES-256 before storage
- Stored in Firestore under user's profile

---

## 🚢 Deployment

### Deploy frontend only

```bash
cd NovAura-WebOS
npm run build
firebase deploy --only hosting
```

### Deploy backend only

```bash
cd NovAura-WebOS/functions
npm run build
firebase deploy --only functions
```

### Deploy everything

```bash
cd NovAura-WebOS
firebase deploy
```

### Production URLs

| Service | URL |
|---------|-----|
| **WebOS** | [novaura.life](https://novaura.life) |
| **API** | `us-central1-novaura-life.cloudfunctions.net/api` |
| **Firestore** | Firebase Console → novaura-life |

> **⚠️ Do NOT deploy to production without Dillan's approval.**
> Use Firebase emulators for local testing.

---

## 🌿 Git Workflow

### Branch naming

```
feature/your-name/description    # New features
fix/your-name/description        # Bug fixes
chore/your-name/description      # Maintenance
```

### Commit message format

```
type: brief description

- Detail 1
- Detail 2

Signed-off-by: Your Name
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

### Before pushing

```bash
# 1. Make sure you're not committing secrets
git diff --cached | Select-String "sk-|api_key|secret|password" -CaseSensitive:$false

# 2. Make sure .env files aren't staged
git status

# 3. Build succeeds
cd NovAura-WebOS && npm run build

# 4. Push
git push origin your-branch
```

### Pull request flow

1. Create a feature branch
2. Make your changes
3. Push and create a PR against `master`
4. At least one review required
5. Dillan merges

---

## 🐛 Troubleshooting

### "Module not found" errors

```bash
# Nuclear option — clean reinstall
rm -rf node_modules package-lock.json
npm install
```

### Firebase emulator won't start

```bash
# Make sure you're logged in
firebase login

# Check Java is installed (emulators need it)
java -version

# If missing, install JDK 11+
```

### AI routes return 401/403

- Check your `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Verify your service account has the right IAM role
- Make sure `functions/.env` is populated

### Port conflicts

```bash
# Frontend on different port
npm run dev -- --port 3001

# Check what's using a port (Windows)
netstat -ano | findstr :5173
```

### "Push declined — secrets detected"

GitHub Push Protection blocked your push. Check for:
- Service account JSON files
- API keys hardcoded in source
- `.env` files accidentally staged

```bash
# Find and remove
git rm --cached filename.json
echo "filename.json" >> .gitignore
git commit --amend
```

---

## 📊 Codebase Scale

As of May 2026:
- **4,000,000+ lines** of code across the ecosystem
- **50+ app windows** in the WebOS
- **15+ API route files** in the backend
- **10+ AI providers** integrated
- **React + Vite** frontend, **Firebase Cloud Functions** backend
- **Firestore** database, **Cloud Storage** for assets

This is a **production-grade platform**, not a prototype. Treat every line with care.

---

## 📞 Contact & Escalation

| Need | Contact |
|------|---------|
| **Repo access / IAM** | Dillan (founder) |
| **Architecture questions** | Check `novaura_complete_overview_master.json` first |
| **API key requests** | Dillan — shared dev keys available |
| **Bug reports** | Create a GitHub Issue |
| **Emergency (prod down)** | Dillan direct message |

### Communication channels

- **Email:** dillan.copeland@novaura.xyz
- **GitHub:** @businessdc91-alt
- **Support:** support@novaura.life

---

## ✅ Onboarding Checklist

- [ ] Cloned the repo
- [ ] Got Firebase project access from Dillan
- [ ] Placed service account JSON in `~/.novaura/`
- [ ] Created `functions/.env` from `.env.example`
- [ ] Configured at least 1 AI provider
- [ ] Ran `firebase login` successfully
- [ ] Started frontend with `npm run dev`
- [ ] Read `novaura_complete_overview_master.json`
- [ ] Read `MASTER_AUDIT_TODO.md`
- [ ] Created a feature branch for first task

**Once all boxes are checked, you're ready to build. Welcome to NovAura.** 🚀
