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
4. Copy `release\latest.json` and the installer to the relay server so they are served from `https://relay.novaura.life/sovereign/`.

Installed copies check that feed shortly after launch and every six hours.

**Feedback.** Reports from Settings › Beta never touch a cloud service. Each report is encrypted with a one-time key to the feedback inbox public key in `src/config/betaFeedback.js`. It then waits in the mesh outbox, addressed to the team node. When that node comes online, the report travels directly over LAN or through the relay tunnel. The team node files it in NovaMail and sends back a receipt signed by the inbox key. Until that receipt arrives, the tester's app shows the report as awaiting delivery and re-sends it.

To receive reports, load the inbox secret on the team node once. Open the Terminal app and run the command printed in `%USERPROFILE%\.novaura\beta_feedback_inbox_key.txt`. Keep that file private.

**Relay server.** The relay is its own crate in `relay/` with no Tauri dependency. On a Linux VPS:

```sh
cd relay && cargo build --release
./target/release/novaura_relay --port 43889
```

Open TCP 43889 and point the `relay.novaura.life` A record at the VPS. Serve the update files from the same box over HTTPS at `/sovereign/` with any static server, for example Caddy. The relay only forwards frames from registered sockets. Identity-signed packets are accepted only when their Ed25519 signature verifies.
