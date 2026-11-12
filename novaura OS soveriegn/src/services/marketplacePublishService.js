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
   * Fetch all marketplace publications (user published + mesh received)
   */
  async getAllListings(category = 'all', search = '') {
    let localItems = [];
    try {
      localItems = await db.marketplace_publications.toArray();
    } catch (e) {
      console.warn('Could not read marketplace_publications from DB:', e);
    }

    const combined = localItems;
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
      rating: null,
      ratingCount: 0,
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
