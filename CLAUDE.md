# NovAura Platform — Session Instructions

**READ THIS AT THE START OF EVERY SESSION.**

## Master Audit File
[MASTER_AUDIT_TODO.md](MASTER_AUDIT_TODO.md) is the living truth document for this project.
- Read it before doing any work
- Update it when features are completed or status changes
- Do NOT rely on memory alone — always cross-reference against the audit

## Project Owner
Dillan Copeland — founder, sole owner. Email: business.dc91@gmail.com (also the staff gate email)

## Stack Overview
- **Web OS + Platform + Backend:** `NovAura-WebOS/` — React/Vite frontend, Firebase Functions v2 backend
- **Desktop App:** `Novaura-Desktop/` — Tauri v1
- **Ops Tool:** `Novaura-Ops/` — Tauri, internal staff use
- **VS Code Extension:** `NovAura-Coding-Partner/` — needs npm install + vsce build
- **Legacy VS Code Extension:** `Novaura-Extension/` (separate, Aura hub connector)

## Firebase Project
- Project ID: `novaura-life`
- Hosting: `novaura-life-8df2f.web.app` / `novaura.life`
- Functions URL: `https://api-o2wu5bcxiq-uc.a.run.app` (reachable via `novaura.life/api/...`)

## Critical Rules
1. **NEVER blank out `functions/.env`** — always merge, never overwrite from scratch
2. **All builds:** landing (`vite.landing.config.js` → `dist/`), OS (`vite.config.js` → `dist/os/`), Platform (`platform/` → `dist/platform/`)
3. **Staff gate email:** `business.dc91@gmail.com`
4. **Platform fee:** 10% (do NOT change to 20%)
5. **`<catalyst>`** is the auth gate code for staff onboarding
6. **Functions deploy:** `firebase deploy --only functions` from `NovAura-WebOS/`
7. **Do NOT use Firebase Secret Manager** — use `functions/.env` directly (IAM issues)

## OS Routing — KNOWN GOTCHA (do not "fix" this)
The OS build source is `os.html` (root level). Vite derives the output filename from the source,
so it ALWAYS outputs `dist/os/os.html` — NOT `index.html`.
`firebase.json` rewrites `/os` and `/os/**` to `/os/os.html`. **This is correct. Do not change it to index.html.**
`index.html` at root is the landing page — completely separate build.

## Key Files
- `NovAura-WebOS/functions/.env` — ALL backend keys (never expose to frontend)
- `NovAura-WebOS/.env` — Frontend Vite vars (`VITE_*`) + backend key source of truth
- `NovAura-WebOS/firebase.json` — Hosting rewrites, function routing
- `NovAura-WebOS/build-deploy.bat` — Combined build + deploy script

## What's Live
- Hosting: ✅ `novaura.life` (landing, `/os/`, `/platform/`, `/download`, `/staff`)
- Functions: ✅ All 12 functions deployed (as of 2026-05-26)
- Storage rules: ✅ Deployed
- Stripe: ⚠️ Key set in `functions/.env`, webhook secret still needed
