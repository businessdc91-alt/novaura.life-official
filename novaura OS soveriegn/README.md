# Novaura Sovereign Desktop

Novaura Sovereign is a locally hosted edition of the Novaura WebOS experience. It has its own full-screen desktop shell and exposes only the applications implemented in this project; it does not import the production site's full app catalog.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`, then serve the generated `dist/` directory with `npm run preview`.

## Desktop shell

- Launch Sovereign apps from desktop icons or the app launcher.
- Open multiple app windows, drag and resize them, maximize and restore, minimize to the taskbar, and close them independently.
- Open **Visual Settings** from the top bar or taskbar to select a particle theme, graphics preset, and particle intensity.
- Theme and graphics preferences are stored in this browser's local storage.
- Use the top-bar command field for Aura commands and voice input where the browser supports the Web Speech API.

The app shell and bundled frontend run locally. Individual application features may still use their existing configured services or network integrations; local hosting by itself does not make those integrations offline.

## Beta release workflow

**Licensing.** Default builds show the activation gate. A tester sends you the Node ID shown on their activation screen, and you mint a key:

```sh
python scripts/mint_tester_license.py --name "Tester Name" --node-id NODE-XXXXXXXXXXXXXXXX --tier TESTER_PREVIEW --days 90
```

To ship an ungated open beta instead, build with `VITE_SOVEREIGN_OPEN_BETA=true`.

**Building.** Run `npm install --include=dev` once (this machine sets `NODE_ENV=production`, which otherwise skips the build tools). Then run `PACKAGE_NOVAURA_OS.bat`. The updater signing key is read from `%USERPROFILE%\.tauri\novaura-sovereign.key`. Back that folder up: without it, installed copies can never receive updates.

**Publishing an update.**

1. Bump `version` in `src-tauri/tauri.conf.json`.
2. Build with `PACKAGE_NOVAURA_OS.bat`.
3. Run `powershell -ExecutionPolicy Bypass -File scripts\publish-update.ps1 -Notes "What changed"`.
4. Upload `release\latest.json` and the installer so they are served from `https://novaura-life-8df2f.web.app/sovereign/`.

Installed copies check that feed shortly after launch and every six hours.

**Feedback.** Reports from Settings › Beta go to `POST /api/beta-feedback/submit` on the NovAura Firebase backend and land in the Firestore collection `sovereign_beta_feedback`. Unsent reports are queued on the tester's machine and retried.
