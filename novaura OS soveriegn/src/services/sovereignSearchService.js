/**
 * NovAura Sovereign OS — Decentralized P2P Search Engine (Nova Search)
 * 
 * Honest Peer-to-Peer discovery engine across the Sovereign Mesh:
 * - Discovers real node operators & peers on LAN (mDNS) and WAN (DHT/Gossip)
 * - Indexes real local manuscripts & documents from Literature Studio
 * - Indexes real local Git repositories from Nova Hub
 * - Indexes real local neural engines (Ollama / LM Studio)
 * - Zero simulated, seeded, or synthetic peer records.
 */

import { db } from '../database/sovereignDatabase.js';
import { getSovereignIdentity } from './sovereignMesh.js';
import { dualInference } from './dualInferenceService.js';

const MESH_SEARCH_CHANNEL = 'novaura_sovereign_mesh_search';

class SovereignSearchService {
  constructor() {
    this.directory = [];
    this.broadcastChannel = null;
    this.listeners = new Set();

    this._initGossipChannel();
    this.reindexLocal();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    this.listeners.forEach(fn => fn([...this.directory]));
  }

  /**
   * Set up P2P BroadcastChannel for multi-instance / local bus peer gossip
   */
  _initGossipChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(MESH_SEARCH_CHANNEL);
        this.broadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'PEER_ANNOUNCE') {
            this._registerPeer(payload);
          } else if (type === 'QUERY_REQUEST') {
            this._handleIncomingQuery(payload);
          } else if (type === 'QUERY_RESPONSE') {
            this._handleIncomingResponse(payload);
          }
        };

        // Broadcast local presence after small delay to allow identity hydration
        setTimeout(() => {
          this.broadcastPresence();
        }, 1200);
      } catch (e) {
        console.warn('[SovereignSearch] BroadcastChannel notice:', e);
      }
    }

    // Listen to decentralized search responses across the physical mesh
    if (typeof window !== 'undefined') {
      window.addEventListener('novaura:mesh_search_results', (event) => {
        const { results, responderName, responderId } = event.detail || {};
        if (Array.isArray(results)) {
          results.forEach(res => {
            this._registerPeer({
              id: res.id || `mesh_res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: res.type || 'literature',
              title: res.title,
              handle: `@peer/${responderName?.toLowerCase().replace(/\s+/g, '_') || 'mesh'}`,
              author: responderName || 'Swarm Peer',
              description: res.subtitle || res.extract || 'Knowledge shared over sovereign mesh.',
              isLocal: false,
              tags: ['swarm_peer', res.type || 'knowledge'],
              fullUrl: res.fullUrl,
              extract: res.extract,
              wordCount: res.wordCount,
              peerId: res.peerId || res.nodeId || responderId,
              peerName: res.peerName || responderName || 'Swarm Peer',
              status: 'online',
            });
          });
        }
      });
    }
  }

  /**
   * Pull complete encyclopedia article from remote peer over mesh
   */
  async fetchRemoteArticle(peerId, { articleId, title }) {
    const { requestRemoteArticle } = await import('./sovereignMesh.js');
    return await requestRemoteArticle(peerId, { articleId, title });
  }

  /**
   * Broadcast local node presence to LAN / bus peers
   */
  broadcastPresence() {
    if (!this.broadcastChannel) return;
    try {
      const myId = getSovereignIdentity();
      if (!myId) return;

      this.broadcastChannel.postMessage({
        type: 'PEER_ANNOUNCE',
        payload: {
          id: `peer_${myId.handle?.replace('@', '') || 'operator'}`,
          type: 'user',
          title: myId.displayName || 'Sovereign Node Operator',
          handle: myId.handle || '@operator',
          address: myId.address || 'operator@nova.node',
          publicKey: myId.publicKey,
          reputation: 100.0,
          isLocal: true,
          status: 'online',
          tags: ['Active Node', 'Sovereign Operator'],
          description: myId.bio || 'Local sovereign mesh participant.',
          capabilities: ['Dual Neural Inference', 'Dexie Cloud Engine', 'Air-Gapped Literature Studio'],
        },
      });
    } catch (e) {
      console.warn('[SovereignSearch] Broadcast presence error:', e);
    }
  }

  /**
   * Index all authentic local Dexie creations (Manuscripts, Repositories, AI Roles)
   */
  async reindexLocal() {
    try {
      const newItems = [];

      // 1. Primary Operator
      const myId = getSovereignIdentity();
      if (myId) {
        newItems.push({
          id: 'user_operator_local',
          type: 'user',
          title: myId.displayName || 'Primary Operator',
          handle: myId.handle || '@operator',
          address: myId.address || 'operator@nova.node',
          publicKey: myId.publicKey || '',
          reputation: 100.0,
          isLocal: true,
          status: 'online',
          tags: ['Core Node', 'Sovereign Master', 'Local Storage'],
          description: myId.bio || 'Local Sovereign OS instance administrator. Full cryptographic key and neural control.',
          capabilities: ['Local Ollama / LM Studio', 'Dexie Private Cloud', 'Literature IDE'],
        });
      }

      // 2. Active Neural Engines from Dual Inference
      try {
        const getCfg = (role, defaultModel, defaultPort) => {
          if (dualInference && typeof dualInference.getRoleConfig === 'function') {
            return dualInference.getRoleConfig(role);
          }
          return { model: defaultModel, status: 'offline', backend: 'ollama', url: 'http://localhost:' + defaultPort };
        };

        const novaConfig = getCfg('nova', 'gemma4:12b', 11434);
        const auraConfig = getCfg('aura', 'gemma4:26b-a4b', 1234);
        const coderConfig = getCfg('coder', 'qwen-coder:80b-moe', 11434);

        newItems.push({
          id: 'agent_nova_executive',
          type: 'agent',
          title: 'Nova Executive Engine',
          handle: '@nova_core',
          operatorHandle: myId?.handle || '@operator',
          model: novaConfig.model,
          status: novaConfig.status === 'online' ? 'online' : 'offline',
          isLocal: true,
          tags: ['Executive', 'OS Control', 'Intent Routing', novaConfig.backend],
          description: `Fast local neural core configured for OS navigation and tool execution via ${novaConfig.backend.toUpperCase()} on ${novaConfig.url}.`,
          endpoint: novaConfig.url,
          skills: ['System Navigation', 'Action Dispatch', 'Tool Calling'],
        });

        newItems.push({
          id: 'agent_aura_creative',
          type: 'agent',
          title: 'Aura Literature Co-Author',
          handle: '@aura_scribe',
          operatorHandle: myId?.handle || '@operator',
          model: auraConfig.model,
          status: auraConfig.status === 'online' ? 'online' : 'offline',
          isLocal: true,
          tags: ['Literature', 'Deep Prose', 'Creative Synthesis', auraConfig.backend],
          description: `High-context creative reasoning engine for long-form literature synthesis, scene critique, and character bibles via ${auraConfig.backend.toUpperCase()}.`,
          endpoint: auraConfig.url,
          skills: ['Prose Generation', 'Plot Branching', 'Sensory Expansion'],
        });

        newItems.push({
          id: 'agent_coder_architect',
          type: 'agent',
          title: 'Coder Autonomous Architect',
          handle: '@coder_forge',
          operatorHandle: myId?.handle || '@operator',
          model: coderConfig.model,
          status: coderConfig.status === 'online' ? 'online' : 'offline',
          isLocal: true,
          tags: ['Code', 'Architecture', 'Refactoring', coderConfig.backend],
          description: `Autonomous coding and refactoring intelligence bound to local repository forge via ${coderConfig.backend.toUpperCase()}.`,
          endpoint: coderConfig.url,
          skills: ['AST Analysis', 'Component Scaffolding', 'Bug Remediation'],
        });
      } catch (err) {
        console.warn('[SovereignSearch] AI engine index note:', err);
      }

      // 3. Real Literature Manuscripts (from Dexie db.manuscripts)
      try {
        const manuscripts = await db.manuscripts.toArray();
        manuscripts.forEach(m => {
          const plain = (m.content || '').replace(/<[^>]+>/g, ' ').trim();
          newItems.push({
            id: `lit_${m.id}`,
            type: 'literature',
            title: m.name,
            handle: `literature/${m.id}`,
            author: myId?.handle || '@operator',
            pages: Math.max(1, Math.round((m.wordCount || 100) / 300)),
            format: m.type === 'bible' ? 'Story Bible & Lore' : 'Prose Chapter',
            isLocal: true,
            tags: [m.type, 'local_manuscript'],
            description: plain ? plain.slice(0, 180) + '...' : 'Local sovereign manuscript document.',
            readerUri: `nova://literature/${m.id}`,
            lastModified: m.updatedAt || m.lastModified,
          });
        });
      } catch (err) {
        console.warn('[SovereignSearch] Manuscript index error:', err);
      }

      // 4. Real Local Repositories (from db.git_repositories)
      try {
        const repos = await db.git_repositories.toArray();
        repos.forEach(repo => {
          newItems.push({
            id: `repo_${repo.id}`,
            type: 'repo',
            title: repo.displayName || repo.name,
            handle: `${repo.owner || 'operator'}/${repo.name}`,
            author: repo.owner || '@operator',
            language: repo.language || 'Codebase',
            isLocal: true,
            tags: [repo.isPrivate ? 'private' : 'public', 'local_git'],
            description: repo.description || 'Decentralized local Git repository.',
            repoUri: `nova://hub/repos/${repo.id}`,
            updatedAt: repo.updatedAt,
          });
        });
      } catch (err) {
        console.warn('[SovereignSearch] Git repos index error:', err);
      }

      // 5. Cached Encyclopedia Articles (from db.encyclopedia_articles)
      try {
        const articles = await db.encyclopedia_articles.toArray();
        articles.forEach(art => {
          newItems.push({
            id: `encyclopedia_${art.id}`,
            type: 'encyclopedia',
            title: art.title,
            handle: `@codex/${art.title.toLowerCase().replace(/\s+/g, '_')}`,
            author: 'Aura Codex / Sovereign Wikipedia',
            language: 'English',
            isLocal: true,
            tags: ['encyclopedia', 'ground_truth', 'offline_knowledge', ...(art.categories || []).slice(0, 3)],
            description: art.description || art.extract?.substring(0, 160) || 'Encyclopedic entry.',
            fullUrl: art.fullUrl,
            wordCount: art.wordcount,
            updatedAt: art.lastAccessed,
          });
        });
      } catch (err) {
        console.warn('[SovereignSearch] Encyclopedia index error:', err);
      }

      // Preserve any discovered remote peers
      const remotePeers = this.directory.filter(item => !item.isLocal);
      this.directory = [...newItems, ...remotePeers];
      this._notify();
    } catch (err) {
      console.error('[SovereignSearch] Local reindex error:', err);
    }
  }

  _registerPeer(peerData) {
    if (!peerData || !peerData.id) return;
    const existingIdx = this.directory.findIndex(p => p.id === peerData.id);
    if (existingIdx >= 0) {
      this.directory[existingIdx] = { ...this.directory[existingIdx], ...peerData, isLocal: false };
    } else {
      this.directory.push({ ...peerData, isLocal: false });
    }
    this._notify();
  }

  _handleIncomingQuery(payload) {
    const { query, senderId } = payload || {};
    if (!query) return;

    // Search local items matching query
    const matches = this.directory.filter(item => {
      const q = query.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.handle?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q))
      );
    });

    if (matches.length > 0 && this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'QUERY_RESPONSE',
        payload: {
          responderId: getSovereignIdentity()?.id || 'operator',
          results: matches,
        },
      });
    }
  }

  _handleIncomingResponse(payload) {
    const { results } = payload || {};
    if (Array.isArray(results)) {
      results.forEach(res => this._registerPeer(res));
    }
  }

  /**
   * Search method with category filter, sorting, and online status
   */
  search({ query = '', category = 'all', sortBy = 'relevance', onlineOnly = false }) {
    let results = [...this.directory];

    // Filter by category
    if (category && category !== 'all') {
      results = results.filter(item => item.type === category);
    }

    // Filter by online status
    if (onlineOnly) {
      results = results.filter(item => item.status === 'online');
    }

    // Filter by text query
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();

      // Trigger decentralized search across physical mesh peers
      if (q.length >= 3 && typeof window !== 'undefined') {
        import('./sovereignMesh.js').then(({ broadcastMeshPacket }) => {
          broadcastMeshPacket('MESH_SEARCH_QUERY', { query: q });
        }).catch(() => { });
      }

      results = results.filter(item => {
        const inTitle = item.title?.toLowerCase().includes(q);
        const inHandle = item.handle?.toLowerCase().includes(q);
        const inDesc = item.description?.toLowerCase().includes(q);
        const inTags = item.tags?.some(t => t.toLowerCase().includes(q));
        const inModel = item.model?.toLowerCase().includes(q);
        return inTitle || inHandle || inDesc || inTags || inModel;
      });
    }

    // Sort results
    if (sortBy === 'reputation') {
      results.sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
    } else if (sortBy === 'latency') {
      results.sort((a, b) => (a.latencyMs || 999) - (b.latencyMs || 999));
    }

    return results;
  }
}

export const sovereignSearch = new SovereignSearchService();
export default sovereignSearch;
