# NovAura Ops — Enhancement Roadmap

Internal staff app for Dillan + partners + devs. This document tracks what still
needs to be built in the Ops app, and what the main platform (novaura.life) needs next.

---

## Ops App — Still To Build

### Phase 1 — Wire Up (do first)
- [ ] Copy `.env.example` → `.env`, fill in all Firebase keys (same as platform `.env`)
- [ ] Set `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `ALIBABA_API_KEY` in your shell env before `tauri dev`
- [ ] Run `npm install` then `npm run tauri-dev`
- [ ] Enable Firebase Realtime Database in your Firebase console (needed for voice signaling)
- [ ] Add team email addresses to the `ALLOWED_EMAILS` list in `src/App.tsx`
- [ ] Create `ops_staff/{uid}` documents in Firestore for each team member with `role` field
- [ ] Copy icon assets from `Novaura-Desktop/src-tauri/icons/` into `Novaura-Ops/src-tauri/icons/`

### Phase 2 — Voice Enhancements
- [ ] Screen sharing via `getDisplayMedia()` — add a share button to VoiceCall controls
- [ ] Speaking detection — Web Audio API `AnalyserNode` to show who is talking in real time
- [ ] Persistent room list — rooms survive after all participants leave (currently auto-cleaned)
- [ ] Push-to-talk mode — hold spacebar to unmute
- [ ] Room locking — owner-only join

### Phase 3 — Chat Enhancements
- [ ] File attachments — upload to Firebase Storage, render previews in chat
- [ ] Message search across all channels
- [ ] Thread replies — nested conversation under any message
- [ ] @mention notifications — native OS notification when your name is mentioned
- [ ] Message pinning per channel
- [ ] DMs — direct private messages between staff members

### Phase 4 — Task Board Enhancements
- [ ] Drag-and-drop between columns (use `@dnd-kit/core`)
- [ ] Due date picker with calendar UI
- [ ] Assign multiple people — avatar stack on card
- [ ] Task comments with threaded replies
- [ ] GitHub PR linking — paste PR URL, show status badge (open/merged/closed)
- [ ] Sprint view — group tasks by sprint/week
- [ ] Email/notification when assigned to a task

### Phase 5 — Editor Enhancements
- [ ] Real-time collaborative editing via Firebase CRDT or Firepad
- [ ] Git diff view — show what changed since last commit
- [ ] One-click "open in VS Code" button for any file
- [ ] File search across the whole project (Rust `walkdir` + regex)
- [ ] Inline AI suggestions — Monaco `completionItemProvider` powered by Claude
- [ ] Live preview panel for React components (WebView iframe)

### Phase 6 — AI Enhancements
- [ ] Persistent conversation history saved to Firestore per user
- [ ] Shared AI threads — start a convo and share the link with a teammate
- [ ] Codebase indexing — send entire file tree summary as system context automatically
- [ ] AI-generated task creation — "create a task from this bug report"
- [ ] Multi-model comparison — send same prompt to all three, view side by side

### Phase 7 — Admin Enhancements
- [ ] Firebase Admin SDK server-side operations (move to a Render/Cloud Function backend)
- [ ] Real user count and session metrics from Firestore
- [ ] Creator application approval queue
- [ ] Payout management — view and mark royalty payouts
- [ ] Feature flag controls — toggle platform features without a deploy

### Phase 8 — Packaging
- [ ] Auto-updater via Tauri's built-in updater + GitHub Releases
- [ ] Custom app icon — design proper NovAura Ops icon set (replace placeholder)
- [ ] Code sign for macOS distribution
- [ ] MSI installer config for Windows team members
- [ ] GitHub Actions CI — auto-build on push to `ops` branch

---

## NovAura Platform (novaura.life) — Suggested Enhancements

### Must Fix (Bugs / Incomplete)
- [ ] `BrowsePage` — asset cards are placeholder data, wire to real Firestore `assets` collection
- [ ] `CheckoutPage` — Stripe webhook handling needs production secret set on Render
- [ ] `MessagesPage` — currently stub UI, needs Firestore-backed DM threads
- [ ] `PricingPage` — `/signup` route has a backslash (`\signup`) — should be `/signup`
- [ ] `HomePage` — imported but not used in any route; either wire to `/home` or delete
- [ ] `LandingPage.jsx` — same content as `PlatformHomePage.jsx` — decide which is canonical
- [ ] `AdminAssets.tsx` — verify admin auth guard is working (check `isAdmin` flag from Firestore)
- [ ] Platform fee — backend confirms 20%, but `CreatorEarnings` still shows old 10% in places

### High Priority Features
- [ ] **Notifications system** — `NotificationsPage` exists but needs backend push events
- [ ] **Creator upload pipeline** — asset upload to R2 needs file size validation + virus scan
- [ ] **Search** — `GlobalSearchModal` added but not indexed; add Algolia or Firestore full-text
- [ ] **Gallery** — `GalleryPage` needs pagination; currently loads all at once
- [ ] **Email hosting** — `SovereignEmailService.ts` is a stub; needs Cloudflare Email Routing API
- [ ] **Webmail** — `WebmailPage` needs IMAP/SMTP proxy via backend
- [ ] **Music Studio** — audio playback works; need waveform visualizer + BPM detection
- [ ] **AI Social Feed** — `AISocialPage` needs to pull real posts from Firestore

### WebOS Improvements
- [ ] Boot animation — `animation.webm` not loading on Windows paths with spaces; fix asset path resolution
- [ ] `BuilderBot IDE` — Monaco + WebContainers integration (Phase 1 of the BuilderBot roadmap)
- [ ] `CatalystCommandStation` — wire to real Firebase data instead of mock state
- [ ] Mini-games — placeholder tiles need actual game routes or remove them
- [ ] WebOS window manager — multiple simultaneous windows not fully stable; fix z-index stack

### Architecture / Infra
- [ ] Move all AI calls to the Render backend — never expose keys client-side
- [ ] Add `rate-limiting` middleware to the Render API
- [ ] Set up Cloudflare R2 CORS policy for asset serving
- [ ] Add `Content-Security-Policy` headers via Cloudflare Workers
- [ ] Firestore security rules — tighten to require auth on all writes; currently too permissive
- [ ] Add Firebase App Check to block non-app traffic

### UX / Design
- [ ] `BrowsePage` hero — currently has spinning ring background; looks great, keep it
- [ ] `Navbar` — needs active-route indicator (bold or underline current page)
- [ ] Mobile responsiveness — several pages break below 768px; needs a mobile layout pass
- [ ] `ErrorBoundary` — add meaningful fallback UI per page, not just a global catch
- [ ] Loading skeletons — replace spinners with skeleton placeholders on data-heavy pages
- [ ] Dark/light theme toggle — store preference in Firestore per user

---

## Git Workflow for the Team

Once you've secured team seats on GitHub:

```
main        — production (novaura.life)
dev         — integration branch, PRs merge here first
feat/*      — individual features
fix/*       — bug fixes
ops/*       — Ops app changes (separate from platform)
```

Recommended PR flow:
1. Branch from `dev`
2. Build + type-check locally
3. Open PR → teammate reviews in NovAura Ops (AI-assisted review via AIOrchestrator)
4. Merge to `dev` → auto-deploy to staging
5. Weekly merge `dev → main` for production push

---

## Setup Checklist (Run This First)

```bash
# 1. Copy env
cp .env.example .env
# fill in Firebase keys (same as NovAura-WebOS/platform/.env)

# 2. Set AI keys in your shell (not in .env — stays in Rust env)
export ANTHROPIC_API_KEY=sk-ant-...
export GEMINI_API_KEY=AIza...
export ALIBABA_API_KEY=sk-1dc030...

# 3. Copy icons from Novaura-Desktop
cp -r ../Novaura-Desktop/src-tauri/icons ./src-tauri/icons

# 4. Install and run
npm install
npm run tauri-dev
```
