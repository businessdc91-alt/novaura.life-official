# Auto-Deploy Setup (one-time)

The workflow at `.github/workflows/deploy-webos.yml` builds `NovAura-WebOS`
and deploys the `/os/` + landing bundles to the live Firebase Hosting site
**novaura-life-8df2f** on every push to `master`, `main`, or the active
`claude/*` branch. It also runs on-demand from the **Actions** tab
("Run workflow").

You add the secrets **once**, then every push ships automatically — including
whatever IvaTech pushes.

## Step 1 — Firebase service account (the deploy key)

1. Firebase Console → ⚙ **Project settings** → **Service accounts**
2. Click **Generate new private key** → downloads a JSON file
3. GitHub repo → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT` — Value: paste the **entire JSON file**

> Tip: `firebase init hosting:github` can generate this secret automatically
> if you'd rather use the CLI.

## Step 2 — Public Firebase web config

These are **not secret** (they ship in every client bundle by design), but the
build needs them to connect to Firebase. Copy them from either:

- Firebase Console → ⚙ Project settings → **Your apps** → SDK setup/config, **or**
- your existing local `NovAura-WebOS/.env` (the one you build from today)

Add each as an Actions repository secret:

| Secret name | Example / source |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIza...` from Firebase config |
| `VITE_FIREBASE_AUTH_DOMAIN` | `novaura-life.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `novaura-life` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `novaura-life.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | numeric sender ID |
| `VITE_FIREBASE_APP_ID` | `1:...:web:...` |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID (for Google sign-in) |
| `VITE_FCM_OAUTH_CLIENT_ID` | push-notification OAuth client (optional) |
| `VITE_FCM_SENDER_ID` | FCM sender ID (optional) |
| `VITE_FCM_VAPID_KEY` | FCM web push VAPID key (optional) |
| `VITE_BACKEND_URL` | `https://us-central1-novaura-life.cloudfunctions.net/api` |
| `VITE_API_URL` | same as backend URL, or your custom API domain |

Any secret you leave unset just falls back to a safe default or degrades that
one feature — the build still succeeds.

## Step 3 — push

Once the secrets are in, push to a covered branch (or hit **Run workflow**).
The Actions tab shows the build + deploy; on success, novaura-life-8df2f.web.app
serves the new bundle.

## Cloud Functions (backend API)

The backend API (`functions/`) — AI inference, Stripe, orders, royalties,
email — deploys via `.github/workflows/deploy-functions.yml`. It reuses the
`FIREBASE_SERVICE_ACCOUNT` secret above, plus one more:

### `FUNCTIONS_ENV_FILE` secret

This one secret holds the **entire contents** of `functions/.env` — all the
server-side keys, one per line. Add it as an Actions repository secret named
`FUNCTIONS_ENV_FILE`, pasting a block like:

```
OPENROUTER_API_KEY=sk-or-v1-<fresh key>
GEMINI_API_KEY=<fresh key>
GEMINI_API_KEY_BACKUP=<fresh key>
STRIPE_SECRET_KEY=sk_live_<your live key>
STRIPE_WEBHOOK_SECRET=whsec_<from Stripe dashboard>
ANTHROPIC_API_KEY=sk-ant-<key>
KIMI_API_KEY=<key>
AZURE_OPENAI_KEY=<key>
AZURE_OPENAI_ENDPOINT=https://<resource>.services.ai.azure.com/
SMTP_HOST=<host>
SMTP_USER=<user>
SMTP_PASS=<pass>
VAULT_ENCRYPTION_SECRET=<random 32+ char string>
USER_KEY_ENCRYPTION_SECRET=<random 32+ char string>
INTERNAL_SERVICE_TOKEN=<random string>
```

See `functions/.env.example` for the full list of recognized keys. Anything
you omit just disables that one provider/feature — the deploy still succeeds.

Then run **Deploy Cloud Functions** from the Actions tab. Once it succeeds, the
AI-inference fixes and Stripe webhook go live.

> ⚠️ **Never commit real keys.** They belong only in these Actions secrets (or
> your local, git-ignored `functions/.env`). Keys committed to this **public**
> repo are exposed the instant they're pushed and must be regenerated.
