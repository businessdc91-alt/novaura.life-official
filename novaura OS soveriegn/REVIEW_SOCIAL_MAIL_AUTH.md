# Review: NovaSocial, NovaMail and Sign in with NovAura (2026-11-02)

Cross-check of the uncommitted social, mail and auth work in `novaura OS soveriegn/`, done by reading the code against the patterns the rest of Sovereign already uses (signed packets via `verifiedSenderDid`, peer caps, local-first AI through `localModels.js`). Line numbers are from the working tree on 2026-11-02 and will drift.

Order: fix **Critical** before anyone outside the founder's machines uses these features, then **High**, then the rest.

## Status (updated 2026-11-02, after the fixes)

**Fixed:**
- **SIWN.** The audience now comes from the tab (`BrowserWindow.jsx`), and only the active tab's own frame may ask. The verifier binds the key to `iss`, requires an audience, and checks an optional site nonce, issue time and lifetime. Signatures carry a `SIWN-v1` prefix, scopes are allow-listed, and lifetime is down from 30 days to 7. Token logic lives in `src/services/siwnToken.js` (tests: `tests/auth/siwn.test.mjs`). The SDK escapes the domain, renders the handle as text and checks nonces.
- **Social** (`src/services/meshSocial.js`, tests: `tests/social/social.test.mjs`):
  - Posts, comments, stories, votes and reactions are signed by their author and verified on arrival, including relayed copies. Reposts embed the signed original.
  - Totals are recomputed from signed per-voter records. Ids are bound to the author, fields are clipped, media must be https or a small inline image, stories last at most 24 h, and there are caps per author and in total. Sync answers are batched to fit 64 KB relay frames and rate-limited.
  - Follows are a set of verified DIDs. Made-up numbers, fake moderators, fake trending and fake playback are gone. Peer media loads only after a click (`social/PeerMedia.jsx`). Nested replies sync. The localStorage copy is slim, and peers can no longer pin or flag their own sites.
- **Mail.** All AI is local only (no cloud), triage runs one message at a time with a labelled keyword fallback, and there are no canned replies. Polish failures are shown. Attachments are capped at 20 KB total and oversized mail is marked undelivered (relay frames are 64 KB). Replies keep their thread. The decrypted copy in localStorage is removed, and received mail records the verified sender key.

**Still open:**
- Media and attachments over a few dozen KB need chunked, content-addressed transfer over the mesh.
- The mail list still shows the sender's typed address; it should show the contact name for `senderDid`, or warn when it doesn't match. There's no per-sender cap on incoming mail yet.
- SIWN lifetime could go shorter with silent refresh.
- ~~**Founder Office:** hard-coded master key and founder-by-default.~~ Fixed:
  - Founder or council authority now comes only from a NOVA1 license signed by the authority key (`src/services/founderLicense.js`, tests: `tests/auth/founder.test.mjs`), re-verified so stored fields can't raise the tier.
  - The Founder Office unlocks with a pasted founder license. Delegated keys are issued offline with `scripts/issue_license.js`, and the app explains how.
  - `getSavedKeyRecord` now lets the verified fields override stored ones.

---

## 1. Sign in with NovAura (SIWN)

Files: `src/services/decentralizedAuthService.js`, `src/services/novaAuthClient.js`, `src/components/modals/SovereignAuthModal.jsx`, `src/components/windows/BrowserWindow.jsx` (~line 693 and ~1590).

The core idea is right: a self-signed Ed25519 token, consent per site, no central OAuth server.

### Critical: the requesting page chooses which site the token is for
`BrowserWindow.jsx` builds the request with `domain: data.domain || cleanDomain`. The page supplies `data.domain`. Any page, including any ordinary website opened in a browser tab, can ask for a token for `bank.nova` with `appName: "Bank"`. The modal shows "bank.nova", the user approves, and the page now holds a valid 30-day login for bank.nova.
**Fix:** ignore `data.domain`. Set the audience from what the host knows: the `.nova` domain the tab is rendering (srcDoc pages), or `new URL(e.origin).host` for real web pages. Show that host in the modal; show the page's `appName` only as a secondary, unverified label.

### Critical: requests are accepted from any window
The `message` listener never checks `e.source`. A nested iframe inside a site (an ad, an embed) can call `window.top.postMessage(...)`; with the audience fix it would receive a token for the hosting site.
**Fix:** accept only `e.source === iframeRef.current?.contentWindow` for the active tab, and drop requests while a consent modal is already open.

### Critical: the verifier trusts a key the token supplies about someone else
`verifySovereignToken` verifies the signature with `payload.operator.publicKey || payload.iss`. A token can set `iss: did:nova:<victim>` and `operator.publicKey: <attacker key>`, sign with the attacker key, and pass. A site that keys accounts on `iss` logs the attacker in as the victim.
**Fix:** derive the key only from `iss` (`did:nova:<64 hex>`), reject when `operator.publicKey` is present and differs, and make `expectedDomain` required (no audience check at all when it is omitted today).

### High
- **No relying-party challenge.** The nonce is generated by the same page that receives the token, and `verifySovereignToken` never checks it. A token can be replayed for 30 days. Let the site pass its own server-issued nonce through `requestLogin({ nonce })`, put it in the payload, and have the verifier require it. Consider a much shorter default lifetime (hours, with silent refresh) than 30 days.
- **Responses go to `'*'`.** `sourceWindow.postMessage(..., '*')`. For real web pages use `e.origin` as the target. Opaque srcDoc frames (`'null'`) need `'*'`, which is acceptable only once the source check above is in.
- **No domain separation in the signature.** Tokens are signed with the same node identity key that signs mesh packets. The formats can't collide today, but prefix the signed bytes (for example `"SIWN-v1\n" + header.payload`) so they never can.

### Medium
- `novaAuthClient.renderButton` puts `session.operator.handle` into `innerHTML`. Handles are self-chosen, so use `textContent`.
- `generateAuthEmbedSnippet(domain)` puts `domain` inside a JS string without escaping. Use `JSON.stringify(domain)`.
- The embed snippet accepts any `NOVA_AUTH_RESPONSE`; it should check that the nonce matches, as the ES module client does.
- Unknown scopes from the page are passed into the token. Allow only the keys of `STANDARD_AUTH_SCOPES`.

---

## 2. NovaSocial

Files: `src/services/sovereignMesh.js` (social cases ~line 400–560 and the social layer ~1550–2110), `src/components/windows/NovaSocialWindow.jsx`, `src/components/windows/social/*`.

The feed features (hot/new/top/rising, nested comments, reactions, reposts, stories) are a solid UI foundation. The network layer trusts every packet completely.

### Critical: any peer can rewrite any post's votes and reactions
- `MESH_REACTION` replaces a post's whole `reactions` and `reactionUsers` with what the packet says. `MESH_VOTE` (older, committed code) does the same for `upvotes`, `downvotes` and `voters`. One peer can set any count on any post, erase everyone else's reactions, or vote in other people's names, since voter ids are just strings in the payload.
- **Fix (one model for votes, reactions and comment votes):** each packet carries only the sender's own action (`{ postId, reaction }` or `{ postId, vote: 'up'|'down'|null }`). The receiver keys it by `verifiedSenderDid(packet)`, ignores unsigned packets, and recomputes counts from the per-voter map. Never accept counts from the wire.

### Critical: posts, reposts and stories are unsigned and unvalidated
- `MESH_REPOST`, `MESH_POSTS_RESPONSE`, `MESH_STORY` and `MESH_STORIES_RESPONSE` store whatever object arrives: any author name, handle or node id (impersonation), any size, any `expiresAt` (a "24 h story" can be set to the year 9999), and first-come ids (a peer can pre-claim ids).
- **Fix:** model it on `src/services/meshManuscripts.js` (shared chapters, already done this way):
  - Bind the author to the signer (`authorNodeId = verifiedSenderDid`). For relayed content (posts responses, stories responses, reposts), carry the original author's signature over the content and verify it, or show it as "via @relayer" without author claims.
  - Clip every field, allow-list `type`/`subAura`/reaction keys, cap `expiresAt` at now + 24 h, cap per sender and in total.
  - Bind ids to the signer so they can't be squatted.

### High
- **`MESH_FOLLOW`** adds 1 to your follower count for every packet, unsigned, matched by handle (handles aren't unique), and shows a toast each time: a free spam and inflation channel. Track followers as a set of verified DIDs; derive the count from it; rate-limit toasts.
- **Made-up numbers.** These are shown as real to every new user:
  - `getSocialProfile` defaults to `followers: 12, following: 8, karma: 420, postKarma: 310, commentKarma: 110, verifiedNode: true`.
  - `SocialProfileModal.jsx` uses 24 / 580 / 410 / 170.
  - `SubAuraSidebar.jsx` shows "418 Active" etc. and hard-coded "trending" tags with post counts.
  - `AuraTubePlayer.jsx` shows "1.4k Node Subscribers".
  - `createPost` defaults a video's duration to `'04:20'`.

  Start every count at 0 and compute them from real data. Leave out "online" and "trending" until there is real data behind them.
- **Peer media is loaded straight from the internet.** `mediaUrl` and story `bgGradient` from other peers go into `<img src>`, `<video src>` and CSS `background`. Every viewer's IP goes to whatever host the poster chose, which is a tracking pixel by design. The rest of Sovereign turns off remote images for peer content (`sanitizeRichHtml(..., { allowRemoteImages: false })`). For peer posts, show remote media only after a click ("Load media from example.com"). Allow only known `bgGradient` values (the `GRADIENTS` list). Later, send media over the mesh as content-addressed blobs.
- **Nested replies arrive flat.** `addComment(postId, content, parentId)` nests locally, but the `MESH_COMMENT` receiver pushes every comment to the top level and ignores `parentId`.

### Medium
- Every social action writes the whole social cache, including any `data:` media, to `localStorage` (`SOCIAL_STORAGE`). That hits the ~5 MB quota fast, the failure is silent, and IndexedDB already has the data. Drop the localStorage copy.
- `reactToPost` adds an upvote when you react, but removing the reaction doesn't remove the upvote.
- The video player shows a ticking progress bar over a still image when the URL isn't a direct .mp4/.webm, so it looks like playback. Show "can't play this link" or open it externally.
- `file://` media URLs are offered in the composer. They don't load in the app, and broadcasting them leaks the poster's local file paths. Remove them.
- `admitRemoteSite` now accepts `isPinned`, `isFlagged`, `favicon` and `category` from the remote peer. A peer shouldn't be able to pin its own site in other people's registries. Pinning and flagging are local choices.

---

## 3. NovaMail

Files: `src/components/windows/NovaMailWindow.jsx`, `src/components/windows/mail/*`, `src/services/mailAiService.js`, `sendMail` / `MESH_MAIL` in `sovereignMesh.js`.

The transport is right: mail is sealed to the recipient's key and never broadcast in plaintext (`markUndelivered` when no key). The new UI (folders, threads, shortcuts, encryption indicator) is good.

### Critical: private mail is sent to the cloud automatically
- `NovaMailWindow.refreshMails` runs `triageInboxMail` on every untriaged message each time the inbox opens.
- `mailAiService.getPreferredAiProvider` falls back to Gemini when the local runtimes don't answer a 600 ms ping, and Ollama never answers a fetch from the app page (CORS; see the Literature IDE fix).
- So with a Gemini key saved, every incoming email body goes to Google without the user ever choosing that.
- **Fix:** make mail AI local only by default, through `runLocalChat` (`src/services/localModels.js`, native, works with LM Studio and Ollama). `queryUniversalInference({ ..., localOnly: true })` in `literatureAiService.js` already does this. Use a cloud model only if the user explicitly turns it on for mail. Run triage only on request, or on new mail with a concurrency limit of 1–2.

### High
- **Canned "smart replies."** When the AI fails, `generateMailSmartReplies` returns four fixed replies that read as if they understood the email ("I will verify the node signatures and relay parameters…"). A user could send nonsense. Return an empty list with a reason instead.
- `polishMailDraft` silently returns the draft unchanged on failure; the UI should say it didn't run.
- **mailAiService problems:**
  - It hard-codes model `llama3:latest` (most users won't have it), sends no `model` to LM Studio, and uses retired `gemini-1.5-flash`.
  - It puts the API key in the URL query string through a page fetch. `cloudProviders.js` uses the native `cloud_ai_request` precisely to keep keys out of the web view.
  - It reads vault keys named `gemini_api_key` etc., while the rest of the app uses `gemini`.
  - The `vertex`, `openai` and `anthropic` branches are declared but not implemented.

  Replace the whole provider layer with the shared one.
- **No attachment size limit.** The composer reads any file into a data URL. A large file sits in memory, gets written to localStorage (quota fails silently) and is sealed into one mesh packet, which can exceed the relay's line limit, so the mail fails. Cap the total (for example 10 MB) with a clear message.

### Medium
- An inline reply calls `sendMail({ to, subject, body })` without the thread id, so replies drop out of their thread.
- `sendMail` also writes the decrypted mail cache, including attachments, to `localStorage` (`MAIL_STORAGE`), in plaintext next to the IndexedDB copy. Drop the localStorage copy.

---

## Already handled elsewhere (for reference)

- Shared chapters over the mesh: `src/services/meshManuscripts.js` + `manuscriptStore.receiveSharedManuscript`. This is the pattern for posts and stories: signed sender, sanitized and clipped fields, id bound to the signer, per-sender and total caps.
- Local AI: `src/services/localModels.js` (`runLocalChat`, `discoverLocalModels`) and `queryUniversalInference` in `src/services/literatureAiService.js` (local by default, no silent cloud fallback, accepts `{ prompt, systemPrompt, ... }`, which `socialAiService.js` already calls it with).
