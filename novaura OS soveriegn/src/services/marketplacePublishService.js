/**
 * marketplacePublishService.js — Sovereign Assets Marketplace & Publishing Engine
 * 
 * Supports:
 * 1. 1-Click Publishing for Games, Books/Manuscripts, Cybeni Blueprints, 3D Assets, and Media
 * 2. 100% Free Sovereign P2P Distribution over the Sovereign Mesh network
 * 3. Local Dexie Persistence (`marketplace_publications`)
 * 4. P2P Mesh Ingestion & Discovery (Any node can query & download peers' published creations)
 * 5. Novaura Cloud Pro Ecosystem Bridge (Managed cloud backup, high-speed CDN, verified creator badge)
 */

import { db } from '../database/sovereignDatabase.js';
import { broadcastMeshPacket } from './sovereignMesh.js';
import { getSavedKeyRecord, verifySovereignKey } from './sovereignAuth.js';

export const MARKETPLACE_CATEGORIES = [
  { id: 'all', label: 'All Creations', icon: 'Sparkles' },
  { id: 'games', label: 'Games & Engines (Godot / Unity / Web)', icon: 'Gamepad2' },
  { id: 'books', label: 'Books & Manuscripts', icon: 'BookOpen' },
  { id: 'blueprints', label: 'Cybeni Code & Architectures', icon: 'Code2' },
  { id: 'media', label: 'Audio, Music & Media Tracks', icon: 'Music' },
  { id: 'assets', label: '3D Models & UI Design Assets', icon: 'Layers' },
];

// Curated sovereign starter ecosystem creations (always available offline)
export const STARTER_MARKETPLACE_ITEMS = [
  {
    id: 'pub_godot_rpg_controller',
    title: 'AuraQuest: 28-Skill RPG Character Controller',
    category: 'games',
    authorHandle: '@sovereign_dev',
    version: '1.4.0',
    license: 'MIT / Sovereign Open',
    price: 0,
    isFreeSovereign: true,
    downloadCount: 384,
    rating: 4.9,
    description: 'Complete Godot 4 GDScript character controller featuring stamina, 28 combat skills, state machine, and local AI dialogue hook.',
    tags: ['godot4', 'gdscript', 'rpg', 'game-dev'],
    payloadSnippet: 'extends CharacterBody3D\n# Complete AuraQuest 28-Skill Controller',
    publishedAt: 1729000000000,
  },
  {
    id: 'pub_sovereign_epics_manuscript',
    title: 'The Sovereign Node: Decentralized Civilization',
    category: 'books',
    authorHandle: '@philosopher_node',
    version: '2.0.1',
    license: 'Creative Commons BY-SA',
    price: 0,
    isFreeSovereign: true,
    downloadCount: 612,
    rating: 5.0,
    description: 'A 14-chapter philosophical and technical treatise on sovereign private compute, air-gapped local intelligence, and post-cloud society.',
    tags: ['literature', 'word-studio', 'manifesto', 'sovereign'],
    payloadSnippet: '# The Sovereign Node\n## Chapter 1: The Reclamation of Compute',
    publishedAt: 1729100000000,
  },
  {
    id: 'pub_fastapi_ollama_blueprint',
    title: 'Ultra-Fast Python 3.12 FastAPI + Ollama Streaming Core',
    category: 'blueprints',
    authorHandle: '@cybeni_master',
    version: '3.1.0',
    license: 'Apache 2.0',
    price: 0,
    isFreeSovereign: true,
    downloadCount: 940,
    rating: 4.8,
    description: 'Production-ready FastAPI backend with Pydantic v2 schemas, token streaming SSE, and local Ollama / LM Studio failover.',
    tags: ['python', 'fastapi', 'ollama', 'cybeni'],
    payloadSnippet: 'from fastapi import FastAPI\n# Production Cybeni Core',
    publishedAt: 1729200000000,
  },
  {
    id: 'pub_synthwave_soundtrack',
    title: 'Neon Orbit: 5-Track Sovereign Cyberpunk Synth OST',
    category: 'media',
    authorHandle: '@sound_architect',
    version: '1.0.0',
    license: 'Royalty-Free Open Music',
    price: 0,
    isFreeSovereign: true,
    downloadCount: 520,
    rating: 4.9,
    description: 'High-energy cyberpunk instrumental OST generated with neural audio synthesizers. Ready for game backgrounds and stream overlays.',
    tags: ['music', 'suno', 'synthwave', 'audio'],
    payloadSnippet: 'Audio Album: Neon Orbit (Lossless FLAC & MP3)',
    publishedAt: 1729300000000,
  },
  {
    id: 'pub_cyberpunk_ui_tokens',
    title: 'Cyberpunk Neon Glass React 19 UI Kit',
    category: 'assets',
    authorHandle: '@ui_artisan',
    version: '2.2.0',
    license: 'MIT',
    price: 0,
    isFreeSovereign: true,
    downloadCount: 1120,
    rating: 4.9,
    description: 'Complete CSS Variable design tokens and React 19 components: glowing cards, sovereign data tables, and glassmorphic dialogs.',
    tags: ['react19', 'tailwind', 'ui-kit', 'cyberpunk'],
    payloadSnippet: ':root { --color-neon-cyan: #06b6d4; }',
    publishedAt: 1729400000000,
  },
];

class MarketplacePublishService {
  constructor() {
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const sub of this.subscribers) {
      try { sub(); } catch (e) { console.error('Marketplace subscriber err:', e); }
    }
  }

  /**
   * Fetch all marketplace publications (starter items + user published + mesh received)
   */
  async getAllListings(category = 'all', search = '') {
    let localItems = [];
    try {
      localItems = await db.marketplace_publications.toArray();
    } catch (e) {
      console.warn('Could not read marketplace_publications from DB:', e);
    }

    const combined = [...localItems, ...STARTER_MARKETPLACE_ITEMS];
    // Deduplicate by ID
    const uniqueMap = new Map();
    combined.forEach(item => uniqueMap.set(item.id, item));
    const all = Array.from(uniqueMap.values());

    return all.filter(item => {
      const matchCat = category === 'all' || item.category === category;
      const matchSearch = !search || 
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    }).sort((a, b) => b.publishedAt - a.publishedAt);
  }

  /**
   * 1-Click Publish: Publishes a creation to local Dexie & broadcasts to Sovereign Mesh peers
   */
  async publishCreation({
    title,
    category,
    description,
    tags = [],
    content = '',
    version = '1.0.0',
    license = 'Sovereign Open License',
    authorHandle = '@operator',
  }) {
    if (!title || !category) throw new Error('Title and Category are required to publish');

    const publicationId = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const record = {
      id: publicationId,
      title,
      category,
      authorHandle,
      version,
      license,
      price: 0,
      isFreeSovereign: true,
      downloadCount: 1,
      rating: 5.0,
      description,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
      payloadSnippet: content.slice(0, 10000),
      publishedAt: Date.now(),
      status: 'active',
    };

    // 1. Store in local Dexie database
    await db.marketplace_publications.put(record);

    // 2. Broadcast to P2P Mesh swarm if connected
    try {
      broadcastMeshPacket('MESH_MARKETPLACE_LISTING', {
        listing: {
          id: record.id,
          title: record.title,
          category: record.category,
          authorHandle: record.authorHandle,
          version: record.version,
          description: record.description,
          tags: record.tags,
          isFreeSovereign: record.isFreeSovereign,
          publishedAt: record.publishedAt,
        },
      });
    } catch (e) {
      console.warn('Mesh broadcast for marketplace listing omitted:', e);
    }

    this.notify();
    return record;
  }

  /**
   * Increment download count for an item
   */
  async downloadItem(itemId) {
    const item = await db.marketplace_publications.get(itemId);
    if (item) {
      item.downloadCount = (item.downloadCount || 0) + 1;
      await db.marketplace_publications.put(item);
      this.notify();
    }
  }

  /**
   * Cryptographically Verified Sovereign Pro Subscription State Check.
   * Pro / Creator capabilities are strictly unlocked via authentic Ed25519 Sovereign Node licenses.
   */
  getProSubscriptionState() {
    let isSubscribed = false;
    let tierName = 'Sovereign Community Node';
    let licenseHolder = null;
    let nodeId = null;
    let expires = null;

    try {
      const record = getSavedKeyRecord();
      if (record && record.valid) {
        const tier = (record.tier || '').toUpperCase();
        if (tier === 'FOUNDER_SOVEREIGN' || tier === 'PRO_SOVEREIGN' || tier === 'ENTERPRISE') {
          isSubscribed = true;
          tierName = tier === 'FOUNDER_SOVEREIGN' ? 'Genesis Founder Sovereign (Lifetime Cloud)' : 'Novaura Pro Sovereign Node';
          licenseHolder = record.holder;
          nodeId = record.nodeId;
          expires = record.expires;
        }
      }
    } catch (e) {
      console.warn('[Marketplace] License verification note:', e);
    }

    return {
      isSubscribed,
      tier: tierName,
      licenseHolder,
      nodeId,
      expires,
      unlockedFeatures: [
        '100% Free P2P Mesh Asset Downloads',
        'Direct Sovereign Publishing',
        'Local-First Offline Access',
        'Zero Cloud Dependency',
      ],
      cloudProFeatures: [
        'Global Anycast Edge CDN Acceleration',
        'Verified Creator Golden Badge & Crypto Payouts',
        'Automated Sovereign Multi-Cloud Vault Backup',
        'Dedicated GPU Swarm Inference Priority',
        'Unlimited Online Cloud Hosting & Domain Mapping',
      ],
    };
  }

  /**
   * Activate Pro features via cryptographically signed sovereign token
   */
  activateProSubscription(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Valid NOVA1 cryptographic token required.');
    }
    const result = verifySovereignKey(token);
    if (!result.valid) {
      throw new Error(result.reason || 'Cryptographic signature verification failed.');
    }
    this.notify();
    return this.getProSubscriptionState();
  }

  // Compatibility helper
  toggleProSubscription() {
    // If not subscribed, open the Sovereign Activation Gate
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novaura:open_activation_gate'));
    }
    return this.getProSubscriptionState();
  }
}

export const marketplacePublish = new MarketplacePublishService();
