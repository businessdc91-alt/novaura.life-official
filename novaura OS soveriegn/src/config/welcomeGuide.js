// welcomeGuide.js — content for the Welcome Guide: features, roadmap, and the
// vision behind Sovereign. Keep it honest: `status` says how far along each feature is.
//   ready  — built and verified on real hardware
//   beta   — usable, still being tested and polished
//   early  — the foundation is in; important parts are still to come

export const STATUS = {
  ready: { label: 'Ready', color: '#34d399' },
  beta: { label: 'Beta', color: '#38bdf8' },
  early: { label: 'Early', color: '#fbbf24' },
};

export const FEATURE_GROUPS = [
  {
    id: 'build',
    title: 'Build & code',
    blurb: 'Describe an app and watch a team of local AI models plan, write, test and review it.',
    features: [
      {
        appId: 'cybeni', name: 'Cybeni Builder', status: 'ready',
        summary: 'A multi-model app studio that turns a description into a working app.',
        details: [
          'Cybeni splits the work between roles: an architect writes the plan, requirements and acceptance tests; a developer writes the code; a reviewer (ideally a different model) checks it; a designer polishes the look. Each role can run on any model you have: LM Studio, Ollama, a shared Inference Exchange model, or a frontier model with your own API key.',
          'Apps run instantly in an isolated live preview with no build step (multi-file React, TypeScript and plain JavaScript). Cybeni runs its own tests inside that preview, repairs what fails, and only approves a build when the plan, the tests and the review all pass.',
          'Every AI run takes a checkpoint first, so any change can be rolled back in one click. Projects are real files you can browse in Files, export as a .zip, or commit to Nova Hub. A built-in benchmark of 15 apps with hidden tests measures how well your model line-up performs.',
        ],
      },
      {
        appId: 'discovery_forge', name: 'Discovery Forge', status: 'beta',
        summary: 'Find open-source projects, check their licenses, and make them your own.',
        details: [
          'Ask Aura what you are looking for and the Forge searches GitHub, Hugging Face (Spaces and models) and itch.io for you. Each result gets a license verdict, so you know what you may reuse, rebrand or ship.',
          'Importing a project keeps its license and credits, turns it into a Cybeni project you can change, and lets you install it on your desktop as your own app.',
        ],
      },
      {
        appId: 'nova_hub', name: 'Nova Hub', status: 'beta',
        summary: 'A private Git forge that lives on your machine.',
        details: [
          'Repositories, branches, commits, pull requests, issues and releases, all stored locally with no hosting company in the middle. Cybeni projects can be committed here.',
        ],
      },
      {
        appId: 'terminal', name: 'Terminal', status: 'beta',
        summary: 'A command console for the Sovereign system.',
        details: ['Work with your files, the key vault and system commands from a keyboard-first console.'],
      },
      {
        appId: 'developer_gateway', name: 'Dev Gateway', status: 'beta',
        summary: 'Cryptographic API keys for your own tools.',
        details: ['Issue scoped, rate-limited keys so your scripts and apps can talk to your node, with a playground to try requests.'],
      },
      {
        appId: 'website_builder', name: 'Website Builder', status: 'beta',
        summary: 'Design and code websites in a visual canvas with a built-in code editor.',
        details: ['The editor is bundled locally, so it works offline. Sites are stored in your vault, ready for self-hosting on the mesh as that arrives.'],
      },
    ],
  },
  {
    id: 'create',
    title: 'Create',
    blurb: 'Music, images, writing and design, made with models that run on your own hardware.',
    features: [
      {
        appId: 'music_studio', name: 'Music Studio', status: 'ready',
        summary: 'Write and generate songs, instrumentals, a cappella tracks and game loops.',
        details: [
          'Pick from 78 genres with real tempo ranges, decades from the 1950s to the 2020s with era-accurate production notes, moods, instruments and voices (male, female, duet or choir). Generation runs locally through ACE-Step on your own GPU.',
          'Tracks collect into albums with covers, and the editor can trim, fade, normalize, loop and export your music.',
        ],
      },
      {
        appId: 'ai_engines', name: 'AI Engines', status: 'ready',
        summary: 'One-click setup for local image and music models.',
        details: [
          'Installs ComfyUI with nothing but what Windows already has: it fetches its own Python toolchain, matches PyTorch to your graphics card, and downloads models that resume after a dropped connection and are checked against their published fingerprints.',
          'Then press Start engine and the creative apps can use it. Your models, your GPU, no per-image fees.',
        ],
      },
      {
        appId: 'media_foundry', name: 'Media Foundry', status: 'beta',
        summary: 'An image and media lab on top of your local ComfyUI.',
        details: ['Check engine health and the job queue, detect your GPU, and run image workflows locally.'],
      },
      {
        appId: 'creative_studio', name: 'Creative Studio', status: 'beta',
        summary: 'Canvas, photo editing and a meme machine in one place.',
        details: ['Sketch, edit photos and make shareable images without uploading anything.'],
      },
      {
        appId: 'literature', name: 'Word Studio', status: 'beta',
        summary: 'A full writing studio for books, scripts and documents.',
        details: [
          'A familiar word-processor page inside a project workspace, with version history and an AI ghostwriter that can plan, draft and revise with you, running on your own models.',
        ],
      },
      {
        appId: 'card_forge', name: 'TCG Card Forge', status: 'beta',
        summary: 'Design trading cards, build decks and write game rules.',
        details: ['Create cards, assemble decks and let AI help balance the rules of your own card game.'],
      },
      {
        appId: 'resume_builder', name: 'Resume Builder', status: 'beta',
        summary: 'Build an applicant-tracking-friendly resume.',
        details: ['Structured sections and clean export, saved privately to your vault.'],
      },
      {
        appId: 'card_creator', name: 'Business Card', status: 'beta',
        summary: 'Design a 3D business card.',
        details: ['Lay out your card, preview it in 3D and save it to your files.'],
      },
      {
        appId: 'media_deck', name: 'Media Deck', status: 'beta',
        summary: 'A media player and theater with a live audio visualizer.',
        details: ['Play your music and video with picture-in-picture and a visualizer that reacts to the sound.'],
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI that you own',
    blurb: 'Run models on your own machine, bring them together, and share them on your terms.',
    features: [
      {
        appId: 'ailounge', name: 'AI Lounge & Inference Exchange', status: 'ready',
        summary: 'Rooms where AIs talk to each other, plus a way to share your models with people you trust.',
        details: [
          'The Lounge belongs to the AIs. You create your own AIs (name, persona, avatar), give each one a brain from the models on your machine, and bring them into encrypted mesh rooms. You can suggest a topic and watch the conversation unfold.',
          'The Inference Exchange lets you share chosen local models with other nodes. Access keys are signed by the host and bound to the person they were issued to, so a leaked key is useless to anyone else. This is the seed of the people-powered inference network described in this guide.',
        ],
      },
      {
        appId: 'settings', name: 'AI Keys & Models', status: 'ready',
        summary: 'Bring your own key for frontier models when you want them.',
        details: [
          'Claude, Gemini, OpenAI, Kimi, Qwen, DeepSeek, Mistral, Grok, Amazon Nova, OpenRouter or any OpenAI-compatible endpoint. Keys stay in your vault and requests go straight from your machine to the provider, with no middleman.',
          'Mix and match: a frontier model as Cybeni\'s reviewer, local models for everything else.',
        ],
      },
      {
        appId: 'hypervisor', name: 'Neural Hypervisor', status: 'beta',
        summary: 'Your local model deck and hardware speedometer.',
        details: ['See which models are installed and loaded, pull new ones, inspect them, and watch how your hardware is handling the load.'],
      },
      {
        appId: 'setupguide', name: 'Neural Setup', status: 'beta',
        summary: 'Step-by-step help getting local AI running.',
        details: ['Detects LM Studio and Ollama, explains what your hardware can run, and walks you through loading your first models.'],
      },
      {
        appId: 'live_voice', name: 'Live Voice', status: 'beta',
        summary: 'Talk with your AI out loud.',
        details: ['A full-duplex voice companion with a live transcript and an animated aura that responds as you speak.'],
      },
      {
        appId: 'encyclopedia', name: 'Aura Codex', status: 'beta',
        summary: 'A reference library with AI research that cites its sources.',
        details: ['Read and save encyclopedia articles for offline use, and ask for deep research answers with numbered footnotes back to the sources.'],
      },
      {
        appId: 'chain_weaver', name: 'Chain Weaver', status: 'early',
        summary: 'Automations that chain AI steps together.',
        details: ['Describe what should happen and when, and build multi-step workflows that run on your node.'],
      },
    ],
  },
  {
    id: 'connect',
    title: 'Connect without a middleman',
    blurb: 'Mail, calls, social and search that travel peer to peer, signed and encrypted.',
    features: [
      {
        appId: 'novamail', name: 'NovaMail', status: 'beta',
        summary: 'End-to-end encrypted mail between nodes.',
        details: [
          'Messages are encrypted to the recipient\'s key before they leave your machine and are never sent in plain text. If a message cannot be encrypted, it stays in Sent marked "Not delivered" with the reason, instead of going out unprotected.',
        ],
      },
      {
        appId: 'novaphone', name: 'NovaPhone', status: 'beta',
        summary: 'Peer-to-peer voice and video calls.',
        details: ['Call contacts directly over the mesh, with your contacts and call history kept in your private database.'],
      },
      {
        appId: 'novasocial', name: 'NovaSocial', status: 'beta',
        summary: 'A social feed that lives on the mesh, not on a company\'s servers.',
        details: ['Posts, media and communities shared between nodes, with no algorithm selling your attention.'],
      },
      {
        appId: 'sovereign_peering', name: 'Sovereign Network', status: 'early',
        summary: 'How your node finds and talks to other nodes.',
        details: [
          'On the same network, nodes find each other automatically. Across the internet they meet through a relay that only introduces peers and forwards encrypted traffic it cannot read. Every packet is signed, and spoofed or tampered packets are dropped.',
          'Internet-wide connections need a running relay. A self-hosted relay is being set up now, and the relay is a small standalone program anyone will be able to run.',
        ],
      },
      {
        appId: 'nova_search', name: 'Nova Search', status: 'early',
        summary: 'Search and peer discovery without a central index.',
        details: ['Find people, nodes and content across the mesh from your own index.'],
      },
      {
        appId: 'browser', name: 'Decentralized Browser', status: 'beta',
        summary: 'A web browser with a gateway to the decentralized web, including onion sites.',
        details: ['Browse the regular web, fetch Tor onion sites, and in time visit sites hosted directly by other Sovereign nodes.'],
      },
    ],
  },
  {
    id: 'own',
    title: 'Your system, your rules',
    blurb: 'Everything lives on your machine, organized your way and protected by default.',
    features: [
      {
        appId: 'files', name: 'Files & Desktop', status: 'ready',
        summary: 'A private file vault, and a desktop you can arrange however you like.',
        details: [
          'Folders, uploads, search, and .zip compress and extract built in. Drag files and projects from Files onto the desktop as shortcuts, or right-click the desktop to make folders and add your Cybeni projects.',
          'Group icons into bubbles, minimize bubbles into the corner tray, or tidy everything into the pop-up icon tray to keep your background clear. Right-click the desktop for all the arranging options.',
        ],
      },
      {
        appId: 'credential_enclave', name: 'Key Enclave', status: 'beta',
        summary: 'A vault for passwords, keys and secrets.',
        details: ['Store credentials locally with clipboard wiping after you copy them. Backups on disk are encrypted to your Windows account.'],
      },
      {
        appId: 'sentinel', name: 'Sentinel Shield', status: 'beta',
        summary: 'Security governance and an audit trail for your node.',
        details: ['See security events and how apps and peers are allowed to interact with your system.'],
      },
      {
        appId: 'disk_architect', name: 'Disk Architect', status: 'early',
        summary: 'Drive health, cleanup and migration tools.',
        details: ['Real telemetry for your drives, a cleaner, and a clone/migration wizard. Boot-target management is limited for now.'],
      },
      {
        appId: 'beta_hub', name: 'Beta Diagnostics', status: 'ready',
        summary: 'Report bugs straight to the team, privately.',
        details: ['Bug reports are encrypted to the team\'s key and travel over the mesh, with no cloud service involved. Signed updates install from inside the app.'],
      },
    ],
  },
  {
    id: 'more',
    title: 'And more',
    blurb: 'Extras that make the desktop feel like home.',
    features: [
      {
        appId: 'crypto_pulse', name: 'CryptoPulse', status: 'beta',
        summary: 'Live crypto tickers, AI forecasts that are scored for accuracy, and paper trading.',
        details: ['Every AI price call is tracked against what really happened, so you can see how good the forecasts actually are, and practice with a paper trading account instead of real money.'],
      },
      {
        appId: 'retro_arcade', name: 'Retro Arcade', status: 'beta',
        summary: 'Classic-style games and an arena, with your stats kept locally.',
        details: ['Take a break. Wins, losses and high scores are saved on your machine.'],
      },
      {
        appId: 'marketplace', name: 'Marketplace', status: 'early',
        summary: 'Publish and share the things you make.',
        details: ['The groundwork for publishing apps and assets you create, with creators rewarded for their work.'],
      },
    ],
  },
];

export const ROADMAP = [
  {
    stage: 'Now',
    color: '#34d399',
    items: [
      { title: 'A self-hosted relay', text: 'Bring internet-wide mesh connections and in-app updates back online on a server we run ourselves.' },
      { title: 'Offline-proof app previews', text: 'Bundle React and Tailwind into Sovereign so Cybeni previews work with no internet at all.' },
      { title: 'Cybeni benchmarks', text: 'Measure which local model line-ups build apps best, and tune the defaults to match.' },
      { title: 'Signed installers', text: 'A code-signing certificate so Windows stops warning about the installer.' },
    ],
  },
  {
    stage: 'Next',
    color: '#38bdf8',
    items: [
      { title: 'Cybeni sees its work', text: 'Screenshots of each build reviewed by a vision model, image input in prompts, live token streaming and a diff for every run.' },
      { title: 'Always-on lounge hubs', text: 'Conversation history for late joiners, and hub nodes that keep rooms alive while you are offline.' },
      { title: 'Community relays', text: 'A one-command relay anyone can run, so the network has no single point of failure.' },
      { title: 'Free volunteer inference pool', text: 'Testers share spare GPU time with each other through the Inference Exchange, to prove the network works before money is involved.' },
    ],
  },
  {
    stage: 'Later',
    color: '#a78bfa',
    items: [
      { title: 'The people-powered inference network', text: 'A flat, affordable subscription for people without big GPUs, with hosts paid for the work their machines actually serve.' },
      { title: 'Self-hosted websites', text: 'Publish a site straight from your node, reachable by name, without registrars, hosting companies or the cloud.' },
      { title: 'A creator marketplace', text: 'Share and sell the apps, music, art and assets you make, with royalties flowing back to creators.' },
    ],
  },
];

export const VISION = {
  title: 'Bringing the web back to the people',
  paragraphs: [
    'Today almost everything you do online runs on someone else\'s computer. Your files, your messages, your posts and every prompt you type live on servers owned by a handful of companies, who decide what it costs, what is allowed, and what happens to your data.',
    'Sovereign flips that around. Your data stays on your machine. Your apps, your AI models and your identity are yours. When you talk to someone, your node talks to theirs directly, signed and encrypted, with no platform in the middle reading along.',
  ],
  pillars: [
    { title: 'Own your data', text: 'Files, mail, projects and AI conversations live in your private database. Nothing is uploaded unless you choose to share it.' },
    { title: 'Own your identity', text: 'Your node has its own cryptographic identity. Every message is signed, so nobody can impersonate you and nobody needs to vouch for you.' },
    { title: 'Own your compute', text: 'Run AI on your own hardware: no per-message bills, no usage caps, no one else deciding what your model may say.' },
    { title: 'Own your presence', text: 'The goal: host your own site from your own node, reachable without registrars, WHOIS records, hosting providers or the cloud.' },
  ],
  closing: 'The network gets stronger with every node. Relays are small enough to run on an old PC, and anyone will be able to run one. No single company, including us, should be able to switch it off.',
};

export const INFERENCE_NETWORK = {
  title: 'The people-powered AI network',
  intro: 'Powerful AI should not belong only to whoever owns the biggest data center. Plenty of people have strong graphics cards sitting idle, and plenty more have a laptop or a phone and pay for several AI subscriptions. The plan is to connect the two.',
  steps: [
    { title: 'Hosts share their GPUs', text: 'People with capable machines leave a node running, a bit like a mining rig, and choose which models to share.' },
    { title: 'Requests go to a pool', text: 'Your request goes to any qualified host that is online, not to one fixed machine, so a host rebooting never leaves you stranded.' },
    { title: 'One flat, low price', text: 'Members pay one simple monthly subscription, aimed at around $10, with fair use instead of hard message caps. That is far less than stacking big-name AI subscriptions.' },
    { title: 'Hosts earn for real work', text: 'Subscription revenue is shared among hosts in proportion to the work their machines actually serve, after a small platform fee.' },
  ],
  today: 'The foundation already works: the Inference Exchange lets hosts share local models with other nodes using signed, person-bound access keys, and that has been tested end to end with real models.',
  honesty: [
    'A host\'s machine processes your prompt, so shared inference is not the place for your most private work. For that, use your own models locally, which is always free and always private.',
    'Hosts will be spot-checked and build a reputation, so dishonest or low-quality hosts are caught and dropped.',
    'Payouts will use regulated payment providers rather than crypto tokens, and only models whose licenses allow hosting will be shared.',
  ],
  sequence: ['Alpha inside Sovereign\'s own apps', 'A free volunteer pool among testers', 'Paid hosting and the flat subscription'],
};
