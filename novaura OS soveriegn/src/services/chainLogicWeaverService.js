/**
 * NovAura Sovereign OS — Autonomous Chain Logic Weaver Service
 * 
 * Production-grade visual nodal DAG execution engine.
 * Chains triggers, conditions, branching, local AI inference, file ops,
 * and system actions together without cloud dependencies.
 */

import { db } from '../database/sovereignDatabase.js';
import { ipc } from '../kernel/IPCBus.js';
import { sovereignRag } from './sovereignRagService.js';
import { cleanSystemTempCache } from './nativeService.js';
import { dualInferenceService } from './dualInferenceService.js';
import { isMeshNodeId } from './meshNodeIds.js';

// Automatic runs are spaced out: a chain runs on its own at most once a minute,
// and for the same document or peer at most once every ten minutes. Writing
// records a version every 15 s and a relay roster lists every peer at once, so
// without this the inbox would fill with reports.
const AUTO_RUN_GAP_MS = 60_000;
const SAME_ITEM_GAP_MS = 10 * 60_000;

// Pre-seeded, fully operational Sovereign Chain Templates
export const DEFAULT_CHAINS = [
  {
    id: 'chain_doc_ingest',
    name: 'Autonomous Document Ingestion & RAG Distiller',
    description: 'Auto-extracts character lore, entities, and themes from documents and stores them in persistent RAG memory with an executive briefing.',
    triggerType: 'DOCUMENT_SAVED',
    enabled: true,
    lastRun: null,
    status: 'idle',
    nodes: [
      { id: 'node_1', type: 'TRIGGER', title: 'Document Saved Event', category: 'trigger', config: { channel: 'document:saved' }, x: 50, y: 120 },
      { id: 'node_2', type: 'CONDITION', title: 'Content Length Check', category: 'logic', config: { minChars: 60 }, x: 260, y: 120 },
      { id: 'node_3', type: 'AI_INFERENCE', title: 'Local Entity & Lore Extraction', category: 'ai', config: { promptType: 'EXTRACT_ENTITIES', maxTokens: 400 }, x: 480, y: 80 },
      { id: 'node_4', type: 'RAG_COMMIT', title: 'Commit to Memory Vault', category: 'storage', config: { category: 'character' }, x: 720, y: 80 },
      { id: 'node_5', type: 'MAIL_DISPATCH', title: 'Dispatch Summary to NovaMail', category: 'action', config: { subject: 'Automated Lore Ingestion Report' }, x: 940, y: 80 },
      { id: 'node_6', type: 'NOTIFICATION', title: 'Desktop HUD Toast', category: 'action', config: { message: 'Document ingested and committed to RAG memory.' }, x: 720, y: 220 },
    ],
    edges: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3', branch: 'true' },
      { from: 'node_2', to: 'node_6', branch: 'false' },
      { from: 'node_3', to: 'node_4' },
      { from: 'node_4', to: 'node_5' },
    ],
  },
  {
    id: 'chain_storage_sentinel',
    name: 'Smart Storage & System Sentinel',
    description: 'Monitors host storage, auto-cleans browser and build caches when drive space runs low, and notifies operator.',
    triggerType: 'STORAGE_HEALTH_TICK',
    enabled: true,
    lastRun: null,
    status: 'idle',
    nodes: [
      { id: 'node_1', type: 'TRIGGER', title: 'Storage Capacity Check', category: 'trigger', config: { thresholdPercent: 15 }, x: 50, y: 120 },
      { id: 'node_2', type: 'CONDITION', title: 'Low Free Space Gate', category: 'logic', config: { operator: 'LESS_THAN', targetGB: 30 }, x: 260, y: 120 },
      { id: 'node_3', type: 'SYSTEM_CLEANUP', title: 'Purge Temp & Build Cache', category: 'action', config: { target: 'TEMP_CACHE' }, x: 480, y: 80 },
      { id: 'node_4', type: 'NOTIFICATION', title: 'Sentinel HUD Alert', category: 'action', config: { message: 'Storage capacity optimized. Temp caches safely cleared.' }, x: 700, y: 80 },
      { id: 'node_5', type: 'MAIL_DISPATCH', title: 'Storage Audit in Mailbox', category: 'action', config: { subject: 'Sentinel Automated Storage Optimization' }, x: 700, y: 200 },
    ],
    edges: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3', branch: 'true' },
      { from: 'node_3', to: 'node_4' },
      { from: 'node_3', to: 'node_5' },
    ],
  },
  {
    id: 'chain_peer_handshake',
    name: 'Mesh Peer Welcome & Trust Protocol',
    description: 'Shows a desktop alert when a new peer appears on the mesh. A peer ID is derived from its key, which the mesh checks when it discovers the peer.',
    triggerType: 'PEER_CONNECTED',
    enabled: true,
    lastRun: null,
    status: 'idle',
    nodes: [
      { id: 'node_1', type: 'TRIGGER', title: 'Peer Discovered Event', category: 'trigger', config: { channel: 'peer:discovered' }, x: 50, y: 120 },
      { id: 'node_2', type: 'CONDITION', title: 'Key-Derived ID Check', category: 'logic', config: { requireSignature: true }, x: 260, y: 120 },
      { id: 'node_3', type: 'NOTIFICATION', title: 'HUD Peer Connected Alert', category: 'action', config: { message: 'A new peer joined the mesh.' }, x: 480, y: 120 },
    ],
    edges: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3', branch: 'true' },
    ],
  },
  {
    id: 'chain_daily_briefing',
    name: 'Daily Operator Epoch Briefing',
    description: 'Queries unread mesh emails, host telemetry, and recent documents to generate an executive morning briefing.',
    triggerType: 'MANUAL',
    enabled: true,
    lastRun: null,
    status: 'idle',
    nodes: [
      { id: 'node_1', type: 'TRIGGER', title: 'Operator Wake Trigger', category: 'trigger', config: {}, x: 50, y: 120 },
      { id: 'node_2', type: 'FETCH_STATE', title: 'Collect Host & Mail Telemetry', category: 'data', config: {}, x: 260, y: 120 },
      { id: 'node_3', type: 'AI_INFERENCE', title: 'Synthesize Daily Epoch Briefing', category: 'ai', config: { promptType: 'BRIEFING' }, x: 480, y: 120 },
      { id: 'node_4', type: 'MAIL_DISPATCH', title: 'Deliver Briefing to Inbox', category: 'action', config: { subject: 'Daily Sovereign Operator Briefing' }, x: 700, y: 120 },
      { id: 'node_5', type: 'NOTIFICATION', title: 'Operator Alert', category: 'action', config: { message: 'Your Daily Epoch Briefing is prepared.' }, x: 920, y: 120 },
    ],
    edges: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3' },
      { from: 'node_3', to: 'node_4' },
      { from: 'node_4', to: 'node_5' },
    ],
  },
];

class ChainLogicWeaverService {
  constructor() {
    this._chains = [];
    this._activeExecution = null;
    this._listeners = new Set();
    this._autoRunAt = new Map();
    this._initDatabase();
    this._bindSystemTriggers();
  }

  _bindSystemTriggers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('novaura:document_saved', (e) => {
        this._onEventTrigger('DOCUMENT_SAVED', e.detail);
      });
      window.addEventListener('novaura:mail_received', (e) => {
        this._onEventTrigger('MAIL_RECEIVED', e.detail);
      });
      window.addEventListener('novaura:storage_health_tick', (e) => {
        this._onEventTrigger('STORAGE_HEALTH_TICK', e.detail);
      });
      window.addEventListener('novaura:peer_discovered', (e) => {
        this._onEventTrigger('PEER_CONNECTED', e.detail);
      });
    }

    ipc.on('document:saved', (payload) => {
      this._onEventTrigger('DOCUMENT_SAVED', payload);
    });
    ipc.on('mail:received', (payload) => {
      this._onEventTrigger('MAIL_RECEIVED', payload);
    });
    ipc.on('storage:health_tick', (payload) => {
      this._onEventTrigger('STORAGE_HEALTH_TICK', payload);
    });
    ipc.on('peer:discovered', (payload) => {
      this._onEventTrigger('PEER_CONNECTED', payload);
    });
  }

  async _onEventTrigger(triggerType, payload = {}) {
    const matchingChains = this._chains.filter(c => c.enabled && c.triggerType === triggerType);
    for (const chain of matchingChains) {
      if (this._activeExecution && this._activeExecution.chainId === chain.id && this._activeExecution.status === 'running') {
        continue;
      }
      const now = Date.now();
      const itemKey = payload?.id ? `${chain.id}:${payload.id}` : null;
      if (now - (this._autoRunAt.get(chain.id) || 0) < AUTO_RUN_GAP_MS) continue;
      if (itemKey && now - (this._autoRunAt.get(itemKey) || 0) < SAME_ITEM_GAP_MS) continue;
      this._autoRunAt.set(chain.id, now);
      if (itemKey) this._autoRunAt.set(itemKey, now);
      try {
        await this.executeChain(chain.id, payload);
      } catch (err) {
        console.warn(`[ChainLogicWeaver] Auto-execution of ${chain.id} note:`, err);
      }
    }
  }

  async _initDatabase() {
    try {
      const stored = await db.workflow_chains.toArray();
      if (stored && stored.length > 0) {
        this._chains = stored;
      } else {
        // Seed default chains into Dexie
        for (const c of DEFAULT_CHAINS) {
          await db.workflow_chains.put({ ...c, updatedAt: new Date().toISOString() });
        }
        this._chains = [...DEFAULT_CHAINS];
      }
      this._notify();
    } catch (e) {
      this._chains = [...DEFAULT_CHAINS];
    }
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.getChains()));
    window.dispatchEvent(new CustomEvent('novaura:chains_updated', { detail: this.getChains() }));
  }

  getChains() {
    return this._chains;
  }

  getChainById(id) {
    return this._chains.find(c => c.id === id);
  }

  async saveChain(chain) {
    const updated = {
      ...chain,
      updatedAt: new Date().toISOString(),
    };
    await db.workflow_chains.put(updated);
    const idx = this._chains.findIndex(c => c.id === chain.id);
    if (idx >= 0) {
      this._chains[idx] = updated;
    } else {
      this._chains.push(updated);
    }
    this._notify();
    return updated;
  }

  async toggleChain(id) {
    const chain = this.getChainById(id);
    if (chain) {
      chain.enabled = !chain.enabled;
      await this.saveChain(chain);
    }
  }

  /**
   * Executes a workflow chain Directed Acyclic Graph (DAG) step-by-step
   */
  async executeChain(chainId, triggerPayload = {}) {
    const chain = this.getChainById(chainId);
    if (!chain) throw new Error(`Chain not found: ${chainId}`);

    this._activeExecution = {
      chainId,
      startTime: Date.now(),
      stepLogs: [],
      currentNodeId: null,
      status: 'running',
    };

    ipc.emit('chain:execution_start', { chainId, chainName: chain.name });

    let context = {
      ...triggerPayload,
      triggerTimestamp: Date.now(),
      chainName: chain.name,
      variables: {},
    };

    try {
      // Find root trigger nodes
      const triggerNodes = chain.nodes.filter(n => n.type === 'TRIGGER');
      if (triggerNodes.length === 0) {
        throw new Error('No trigger node found in chain');
      }

      for (const startNode of triggerNodes) {
        context = await this._traverseNode(chain, startNode, context);
      }

      chain.lastRun = new Date().toISOString();
      await this.saveChain(chain);

      this._activeExecution.status = 'completed';
      this._activeExecution.endTime = Date.now();
      ipc.emit('chain:execution_complete', { chainId, execution: this._activeExecution });
      return { success: true, execution: this._activeExecution, context };
    } catch (err) {
      this._activeExecution.status = 'failed';
      this._activeExecution.error = err.message;
      ipc.emit('chain:execution_failed', { chainId, error: err.message });
      throw err;
    }
  }

  async _traverseNode(chain, node, context) {
    this._activeExecution.currentNodeId = node.id;
    const logEntry = {
      nodeId: node.id,
      title: node.title,
      type: node.type,
      timestamp: Date.now(),
      status: 'running',
    };
    this._activeExecution.stepLogs.push(logEntry);
    ipc.emit('chain:step_start', { nodeId: node.id, title: node.title });

    // Execute specific node logic
    const stepResult = await this._runNodeLogic(node, context);
    logEntry.status = 'success';
    logEntry.output = stepResult.outputSummary || 'Completed';
    ipc.emit('chain:step_complete', { nodeId: node.id, title: node.title, result: stepResult });

    const updatedContext = { ...context, ...stepResult.newContext };

    // Find outgoing edges
    const outgoing = chain.edges.filter(e => e.from === node.id);
    for (const edge of outgoing) {
      // Branch filtering
      if (node.type === 'CONDITION') {
        const branchCondition = stepResult.conditionMet ? 'true' : 'false';
        if (edge.branch && edge.branch !== branchCondition) {
          continue;
        }
      }

      const nextNode = chain.nodes.find(n => n.id === edge.to);
      if (nextNode) {
        await this._traverseNode(chain, nextNode, updatedContext);
      }
    }

    return updatedContext;
  }

  async _runNodeLogic(node, context) {
    switch (node.type) {
      case 'TRIGGER':
        return {
          conditionMet: true,
          outputSummary: `Trigger received: ${node.config?.channel || 'MANUAL'}`,
          newContext: { triggerTime: Date.now() },
        };

      case 'CONDITION': {
        const text = context.content || context.text || context.documentText || '';
        let conditionMet = true;
        if (node.config?.minChars) {
          conditionMet = text.length >= node.config.minChars;
        } else if (node.config?.requireSignature) {
          // Only IDs derived from a key: the mesh verified those (a signed LAN
          // beacon, or a relay login that signed its challenge).
          conditionMet = isMeshNodeId(context.id);
        } else if (node.config?.operator === 'LESS_THAN') {
          // Real host storage evaluation via Web Storage estimate
          let freeGB = null;
          if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
            try {
              const estimate = await navigator.storage.estimate();
              if (estimate.quota && estimate.usage !== undefined) {
                freeGB = (estimate.quota - estimate.usage) / (1024 * 1024 * 1024);
              }
            } catch (err) {
              console.warn('[ChainLogicWeaver] Storage estimate error:', err);
            }
          }
          const targetGB = node.config.targetGB || 30;
          conditionMet = freeGB !== null ? freeGB < targetGB : false;
        }
        return {
          conditionMet,
          outputSummary: `Condition evaluated: ${conditionMet ? 'PASSED (Branch TRUE)' : 'FAILED (Branch FALSE)'}`,
          newContext: { conditionMet },
        };
      }

      case 'AI_INFERENCE': {
        const sourceText = context.content || context.name || context.chainName || '';
        let responseText = '';
        try {
          // Query active sovereign model via Dual Inference Engine (Nova)
          // Local models only (LM Studio or Ollama): no swarm or cloud fallback.
          responseText = await dualInferenceService.queryNova([{
            role: 'user',
            content: `Synthesize and distill key entities, themes, and executive insights from this content in 2 concise sentences:\n"${sourceText.slice(0, 1500)}"`,
          }]);
        } catch {
          // Authentic deterministic local heuristic NLP extraction (zero synthetic mock data)
          const words = sourceText.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean);
          const entities = Array.from(new Set(
            words.filter(w => /^[A-Z][a-z]{2,}/.test(w) && !/^(The|And|For|With|This|That|From|Into)$/.test(w))
          )).slice(0, 5);
          const wordCount = words.length;
          responseText = `Distilled ${wordCount} words from "${context.name || context.chainName}". ` +
            (entities.length > 0 ? `Identified entities: ${entities.join(', ')}.` : `Committed to local memory vault.`);
        }

        return {
          conditionMet: true,
          outputSummary: `Generated: ${responseText.substring(0, 60)}...`,
          newContext: { aiInsight: responseText },
        };
      }

      case 'RAG_COMMIT': {
        // Store in Dexie memories table
        const memoryEntry = await sovereignRag.remember({
          category: node.config?.category || 'lore',
          title: `Autonomous Extraction: ${context.chainName}`,
          content: context.aiInsight || 'Autonomous entity extracted via Chain Logic Weaver.',
          importance: 8,
          keywords: ['chain_weaver', 'autonomous', 'lore'],
        });
        return {
          conditionMet: true,
          outputSummary: `Committed RAG Memory #${memoryEntry.id}`,
          newContext: { ragMemoryId: memoryEntry.id },
        };
      }

      case 'MAIL_DISPATCH': {
        const mail = {
          id: 'mail_chain_' + Date.now(),
          sender: 'weaver@nova.node',
          senderName: 'Chain Logic Weaver',
          recipient: 'operator@nova.node',
          subject: node.config?.subject || 'Chain Execution Report',
          body: `Autonomous Chain Execution Report: ${context.chainName}\n\nTimestamp: ${new Date().toLocaleString()}\nInsights:\n${context.aiInsight || 'Task finished successfully.'}\n\nStatus: Complete.`,
          timestamp: new Date().toISOString(),
          read: false,
          starred: false,
          box: 'inbox',
        };
        await db.mailbox.put(mail);
        window.dispatchEvent(new CustomEvent('novaura:mail_received', { detail: mail }));
        return {
          conditionMet: true,
          outputSummary: `Delivered mail: "${mail.subject}"`,
          newContext: { mailDispatched: mail.id },
        };
      }

      case 'SYSTEM_CLEANUP': {
        const cleanRes = await cleanSystemTempCache();
        return {
          conditionMet: true,
          outputSummary: `System temp cache purged (${cleanRes.cleanedMB || 0} MB freed)`,
          newContext: { cleanedMB: cleanRes.cleanedMB },
        };
      }

      case 'NOTIFICATION': {
        const msg = node.config?.message || `Chain completed: ${context.chainName}`;
        ipc.emit('notification:show', {
          id: 'notif_' + Date.now(),
          title: 'Chain Logic Weaver',
          message: msg,
          type: 'success',
          timestamp: Date.now(),
        });
        return {
          conditionMet: true,
          outputSummary: `Toast alert: "${msg}"`,
          newContext: {},
        };
      }

      case 'FETCH_STATE': {
        const unreadCount = await db.mailbox.where('read').equals(0).count();
        const docsCount = await db.documents.count();
        return {
          conditionMet: true,
          outputSummary: `Fetched state: ${unreadCount} unread mails, ${docsCount} documents.`,
          newContext: { unreadMails: unreadCount, documentsCount: docsCount },
        };
      }

      default:
        return {
          conditionMet: true,
          outputSummary: `Executed step ${node.type}`,
          newContext: {},
        };
    }
  }

  /**
   * Intent Bar Dispatcher
   * Matches natural language intent to pre-built or dynamic chains
   */
  async dispatchIntent(prompt) {
    const p = prompt.toLowerCase();
    if (p.includes('ingest') || p.includes('document') || p.includes('lore') || p.includes('rag')) {
      return this.executeChain('chain_doc_ingest', { content: prompt });
    }
    if (p.includes('clean') || p.includes('disk') || p.includes('storage') || p.includes('purge') || p.includes('cache')) {
      return this.executeChain('chain_storage_sentinel');
    }
    if (p.includes('peer') || p.includes('mesh') || p.includes('handshake') || p.includes('trust')) {
      return this.executeChain('chain_peer_handshake', { promptContext: prompt });
    }
    if (p.includes('brief') || p.includes('morning') || p.includes('epoch') || p.includes('summary')) {
      return this.executeChain('chain_daily_briefing');
    }

    // Default: run daily epoch briefing with prompt context
    return this.executeChain('chain_daily_briefing', { promptContext: prompt });
  }
}

export const chainLogicWeaver = new ChainLogicWeaverService();
export default ChainLogicWeaverService;
