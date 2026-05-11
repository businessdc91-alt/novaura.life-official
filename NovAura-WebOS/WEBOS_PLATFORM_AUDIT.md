# WebOS + Platform Site Map and Routing Audit

## Overview
This audit covers both halves of the Novaura system:
- **WebOS app** (inside `NovAura-WebOS/src/`) with its internal landing page
- **Platform app** (inside `NovAura-WebOS/platform/`) served under `/platform/`
- The **standalone marketing/search page** entrypoint in `NovAura-WebOS/src/landing-main.jsx`

## Entry points

### WebOS app
- `NovAura-WebOS/src/main.jsx` is the main WebOS app entry.
- `NovAura-WebOS/src/App.jsx` controls the WebOS flow.
- `NovAura-WebOS/src/pages/LandingPage.jsx` is the actual WebOS landing page used when `showOS` is false.

### Standalone landing page
- `NovAura-WebOS/src/landing-main.jsx` renders `LandingPage` in a standalone mode and redirects launch to `https://os.novaura.life`.
- This is a separate build target and should not be confused with the in-OS landing experience.

### Platform app
- `NovAura-WebOS/platform/src/main.tsx` is the platform app entry.
- `NovAura-WebOS/platform/src/App.tsx` defines the platform router and routes.
- `NovAura-WebOS/platform/vite.config.ts` configures `base: '/platform/'` and outputs build to `dist/platform`.

## WebOS app routing / flow

### Routing style
- WebOS does not use a full React Router route tree for all pages.
- `src/App.jsx` uses `useLocation()` and path detection to drive app state:
  - `/os` or `/system` → show OS
  - `/login` or `/register` → show OS auth wall
  - `/platform` or `/platform/*` → show OS and open social window
  - `/window/*` → show OS and open a specific window
- The WebOS landing page is keyed by `showOS === false`.

### WebOS landing page behavior
- `src/pages/LandingPage.jsx` renders the WebOS landing experience.
- It includes platform-targeted links:
  - `/platform/feed`
  - `/platform/browse`
  - `/platform/domains`
  - `/platform/login`
- It also includes an OS launch button via `onLaunchOS()`.
- This means the WebOS landing page is indeed inside the WebOS app, and it is the correct landing experience for the OS flow.

### WebOS feature flow
- If OS is not active, the app shows the landing page.
- When user launches OS:
  - `showOS` becomes `true`
  - if not authenticated, it shows `AuthPage`
  - if authenticated but setup incomplete, it shows `SetupPage`
  - once complete, it renders the OS desktop window environment
- The OS app is therefore a hybrid landing + desktop/window manager flow, not a pure router-based SPA.

## Platform app route audit

### Key findings
- Platform is served under `/platform/`.
- `platform/src/App.tsx` defines routes for market, auth, buyer, creator, admin, and NovaLow.
- Platform currently uses `Router basename="/platform"`.
- `platform/src/App.tsx` has a shell route mapping:
  - `/` → `AISocialPage`
  - `/*` → `AISocialPage`
- This is correct for the platform app namespace, but the WebOS landing page links must align with it.

### Platform route structure
Public routes include:
- `/` → HomePage
- `/browse`, `/browse/:category`
- `/asset/:id`
- `/creator/:username`
- `/search`
- `/legal/privacy`, `/legal/licensing`, `/legal/royalties`, `/legal/terms`, `/legal/agreement`, `/legal/cookies`, `/legal/creator-terms`
- `/contact`, `/studio-showcase`, `/music`, `/gallery`, `/gallery/submit`, `/games`, `/software`, `/free`, `/profile/:username`, `/reader`, `/registry`, `/feed`, `/hub`
- `/chat`, `/voice-studio`, `/music-studio`, `/ai-studio`, `/studio` redirect to `/music-studio`
- `/practice`, `/pricing`, `/api-keys`, `/shop`
- `/platform` shell is handled by `AISocialPage` inside the platform namespace
- `/novalow` redirects to `/domains`
- `/domains`, `/hosting`, `/builder`, `/devtools`, `/tutorials`, `/security`, `/promote`
- `/about`, `/investors`, `/email`, `/webmail`

Protected routes include buyer, creator, and admin sections.

### Platform alias routes
- `/marketplace` → `/browse`
- `/upload`, `/creator/upload` → `/creator/assets/new`
- `/creator/analytics` → `/creator/earnings`
- `/settings/notifications` → `/notifications`
- `/admin` → `/admin/dashboard`
- `/docs`, `/legal/faq` → `/help`
- `/legal/indemnification` → `/legal/terms`

## Hosting and build config

### WebOS build
- `vite.config.js` base is `/os/` for production
- build output goes to `dist/os`
- local dev uses `/`
- `src/landing-main.jsx` is used for standalone `landing` build mode

### Platform build
- `platform/vite.config.ts` base `/platform/`
- build output goes to `dist/platform`

### Firebase hosting behavior
- `firebase.json` rewrites `/platform` and `/platform/**` to `/platform/index.html`
- rewrites `/os` and `/os/**` to `/os/index.html`
- fallback `**` to `/index.html`

## Correct landing-page mapping

### Right landing page
The actual WebOS landing page is inside the WebOS app:
- `NovAura-WebOS/src/pages/LandingPage.jsx`
- rendered from `NovAura-WebOS/src/App.jsx` when `showOS` is false

### Standalone landing page
- `NovAura-WebOS/src/landing-main.jsx` is a separate search/marketing landing build,
- not the live WebOS app experience.

## Current state after inspection
- The WebOS root landing experience remains inside `src/App.jsx` and `src/pages/LandingPage.jsx`.
- `src/landing-main.jsx` is a standalone landing-build entrypoint and is not the active WebOS root page.
- `platform/src/App.tsx` is a platform-specific app shell built to `dist/platform` with `basename="/platform"`, which is consistent with the `/platform/` namespace.
- `firebase.json` rewrites for `/platform` and `/os` match the multi-app hosting layout.

## Immediate correction needed
- No WebOS root landing path changes are required.
- Avoid changing `src/App.jsx` landing behavior unless the OS flow itself needs refactoring.
- Preserve `/platform/` as the separate platform namespace and keep platform-specific routing inside `platform/src/App.tsx`.

## Recommendation
Create a single shared audit document for:
1. WebOS landing / OS app flow
2. WebOS internal feature/window list
3. Platform routes and feature map
4. Hosting rewrites and build outputs

This file can be the canonical reference for the team.
