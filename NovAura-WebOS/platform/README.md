# Platform App (marketplace / unified platform SPA)

This directory holds the source for the platform SPA served at
`novaura.life/platform/**` (plus the `/login`, `/browse`, `/market`,
`/domains` rewrites — see `../firebase.json`).

> **Status:** this directory was previously a git submodule with no
> configured URL, so fresh clones received an empty folder and
> `npm run build` failed at the platform step. The stale gitlink has been
> removed — the platform source should now be committed **directly** into
> this directory (vendored, no submodule).
>
> To restore it: copy the contents of your local `NovAura-WebOS/platform/`
> folder here, **delete any `.git` folder inside it first**, then commit.

Expected layout (from SITEMAP.md):

```
platform/
├── package.json
├── vite.config.js        # base: /platform/, outDir: ../dist/platform
├── index.html
└── src/
    ├── pages/            # HomePage, BrowsePage, CheckoutPage, OrdersPage,
    │                     # CreatorUpload, CreatorEarnings, ...
    ├── components/
    └── stores/
```

The root build (`npm run build` in `NovAura-WebOS/`) builds the OS, the
landing page, then this app via `scripts/build-platform.mjs` — which
skips with a loud warning if this directory has no `package.json`.
