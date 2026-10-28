import Dexie from 'dexie';

/**
 * Novaura Sovereign Private Cloud Database
 * 100% User-Hosted, Air-Gapped Local Database Engine
 * Zero cloud dependency. Automatically initializes and manages the user's local database.
 */

class SovereignDatabase extends Dexie {
  constructor() {
    super('NovauraSovereignPrivateCloud');

    this.version(1).stores({
      identities: 'id, handle, address, tier, createdAt',
      settings: 'key, updatedAt',
      workspaces: 'id, name, lastModified',
      documents: 'id, name, type, path, parentId, updatedAt',
      chat_history: 'id, agent, role, timestamp',
      mailbox: 'id, box, sender, recipient, timestamp, read, starred',
      social_posts: 'id, type, subAura, author, createdAt',
      vault: 'id, keyName, provider, updatedAt',
      sentinel_audit: 'id, eventType, source, severity, timestamp',
      cloud_connectors: 'id, provider, accountName, status',
      card_decks: 'id, name, gameType, updatedAt',
      app_registry: 'id, category, enabled',
    });

    this.version(2).stores({
      chat_history: '++id, persona, agent, role, timestamp',
      mailbox: 'id, box, folder, sender, recipient, timestamp, read, starred',
      social_posts: 'id, type, subAura, authorHandle, author, createdAt, timestamp',
    });

    this.version(3).stores({
      contacts: 'id, handle, phoneNumber, address, name, isFavorite, updatedAt',
      call_logs: 'id, peerHandle, peerNumber, direction, status, timestamp',
      hosted_sites: 'id, domain, name, status, updatedAt',
    });

    this.version(4).stores({
      memories: '++id, category, title, importance, lastAccessed, updatedAt',
    });

    this.version(5).stores({
      workflow_chains: 'id, name, triggerType, enabled, lastRun, updatedAt',
      enclave_records: 'id, type, label, category, updatedAt',
    });

    this.version(6).stores({
      git_repositories: 'id, name, owner, defaultBranch, isPrivate, createdAt, updatedAt',
      git_commits: 'id, repoId, branch, hash, author, timestamp',
      git_branches: 'id, repoId, name, commitHash, isDefault, updatedAt',
      git_pull_requests: 'id, repoId, number, title, author, status, sourceBranch, targetBranch, createdAt, updatedAt',
      git_issues: 'id, repoId, number, title, author, status, createdAt, updatedAt',
      git_releases: 'id, repoId, tagName, name, publishedAt',
    });

    this.version(7).stores({
      node_feedback: '++id, type, title, severity, createdAt',
    });

    // v8 — Literature IDE: durable manuscript storage (replaces 5MB-capped localStorage),
    // UI/session state, and rolling local version history.
    this.version(8).stores({
      manuscripts: 'id, type, updatedAt',
      manuscript_state: 'key',
      manuscript_versions: '++id, docId, createdAt',
    });

    // v9 — Sovereign Encyclopedia: Offline knowledge cache, citations, and download packs
    this.version(9).stores({
      encyclopedia_articles: 'id, title, category, lastAccessed, isDownloaded',
      encyclopedia_citations: '++id, articleId, citationIndex, sourceUrl',
      encyclopedia_packs: 'id, name, sizeBytes, status, path',
    });

    // v10 — Sovereign Swarm Ecosystem: Web-of-Trust Contacts, Outbox Queue, P2P File Transfers, Swarm Inference Jobs
    this.version(10).stores({
      contacts: 'id, handle, nodeId, publicKey, trustTier, allowInferenceSharing, isFavorite, updatedAt',
      mesh_outbox: 'id, recipientId, packetType, status, retries, createdAt, deliveredAt',
      mesh_transfers: 'id, fileId, direction, peerId, fileName, mimeType, size, status, createdAt',
      swarm_inference_jobs: 'id, requesterId, role, model, status, createdAt, durationMs',
    });

    // v11 — Sovereign Tor & Onion Intelligence: Darknet queries, cached hidden service archives, and Tor circuit metrics
    this.version(11).stores({
      darknet_queries: 'id, query, timestamp, resultsCount',
      darknet_pages: 'id, onionUrl, title, cleanText, domain, fetchedAt',
    });

    // v12 — Sovereign Omni Features: Crypto Predictions, Media Library, Marketplace, Developer API Keys, and Retro Arcade
    this.version(12).stores({
      crypto_predictions: 'id, symbol, targetHorizon, predictedPrice, actualPrice, accuracyScore, createdAt, status',
      media_library: 'id, title, mediaType, duration, artist, createdAt, lastPlayed',
      marketplace_publications: 'id, title, category, authorHandle, version, license, downloadCount, price, status, publishedAt',
      developer_api_keys: 'id, keyId, keyHash, keyPrefix, label, scopes, rateLimitRpm, totalRequests, lastUsedAt, createdAt, revoked',
      retro_arcade_stats: 'id, gameId, wins, losses, draws, highScores, cardInventory, updatedAt',
    });

    // v13 — Local File Storage & Indexing: Index 'path' on documents for deterministic file resolution
    this.version(13).stores({
      documents: 'id, name, type, path, parentId, updatedAt',
      memories: '++id, category, title, importance, lastAccessed, updatedAt, updated_at',
    });

    this.identities = this.table('identities');
    this.settings = this.table('settings');
    this.workspaces = this.table('workspaces');
    this.documents = this.table('documents');
    this.chat_history = this.table('chat_history');
    this.mailbox = this.table('mailbox');
    this.social_posts = this.table('social_posts');
    this.vault = this.table('vault');
    this.sentinel_audit = this.table('sentinel_audit');
    this.cloud_connectors = this.table('cloud_connectors');
    this.card_decks = this.table('card_decks');
    this.app_registry = this.table('app_registry');
    this.contacts = this.table('contacts');
    this.call_logs = this.table('call_logs');
    this.hosted_sites = this.table('hosted_sites');
    this.memories = this.table('memories');
    this.workflow_chains = this.table('workflow_chains');
    this.enclave_records = this.table('enclave_records');
    this.git_repositories = this.table('git_repositories');
    this.git_commits = this.table('git_commits');
    this.git_branches = this.table('git_branches');
    this.git_pull_requests = this.table('git_pull_requests');
    this.git_issues = this.table('git_issues');
    this.git_releases = this.table('git_releases');
    this.node_feedback = this.table('node_feedback');
    this.manuscripts = this.table('manuscripts');
    this.manuscript_state = this.table('manuscript_state');
    this.manuscript_versions = this.table('manuscript_versions');
    this.encyclopedia_articles = this.table('encyclopedia_articles');
    this.encyclopedia_citations = this.table('encyclopedia_citations');
    this.encyclopedia_packs = this.table('encyclopedia_packs');
    this.mesh_outbox = this.table('mesh_outbox');
    this.mesh_transfers = this.table('mesh_transfers');
    this.swarm_inference_jobs = this.table('swarm_inference_jobs');
    this.darknet_queries = this.table('darknet_queries');
    this.darknet_pages = this.table('darknet_pages');
    this.crypto_predictions = this.table('crypto_predictions');
    this.media_library = this.table('media_library');
    this.marketplace_publications = this.table('marketplace_publications');
    this.developer_api_keys = this.table('developer_api_keys');
    this.retro_arcade_stats = this.table('retro_arcade_stats');
  }


  /**
   * Safe migration from legacy localStorage to Private Cloud DB
   */
  async autoMigrateLegacyStorage() {
    try {
      // 1. Identity migration
      const legacyId = localStorage.getItem('novaura_sovereign_identity');
      if (legacyId) {
        const parsed = JSON.parse(legacyId);
        const exists = await this.identities.get(parsed.id || 'primary_operator');
        if (!exists) {
          await this.identities.put({
            id: parsed.id || 'primary_operator',
            handle: parsed.handle || 'operator',
            displayName: parsed.displayName || 'Sovereign Node Operator',
            address: parsed.address || 'operator@nova.node',
            publicKey: parsed.publicKey || 'local-ed25519-key',
            bio: parsed.bio || 'Local Node Operator',
            tier: 'SOVEREIGN_FOUNDER',
            createdAt: parsed.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Mail migration
      const legacyMail = localStorage.getItem('novaura_sovereign_mailstore');
      if (legacyMail) {
        const parsed = JSON.parse(legacyMail);
        if (parsed.inbox && Array.isArray(parsed.inbox)) {
          for (const m of parsed.inbox) {
            await this.mailbox.put({ ...m, box: 'inbox' });
          }
        }
        if (parsed.sent && Array.isArray(parsed.sent)) {
          for (const m of parsed.sent) {
            await this.mailbox.put({ ...m, box: 'sent' });
          }
        }
      }

      // 3. Settings migration
      const legacyPrefs = localStorage.getItem('novaura-sovereign-desktop-preferences');
      if (legacyPrefs) {
        const parsed = JSON.parse(legacyPrefs);
        await this.settings.put({ key: 'desktop_preferences', value: parsed, updatedAt: Date.now() });
      }

      // 4. Documents migration
      const legacyDocs = localStorage.getItem('novaura_sovereign_manuscripts');
      if (legacyDocs) {
        const parsed = JSON.parse(legacyDocs);
        if (Array.isArray(parsed)) {
          for (const doc of parsed) {
            await this.documents.put({
              id: doc.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: doc.name || 'Untitled Document',
              type: doc.type || 'chapter',
              content: doc.content || '',
              wordCount: doc.wordCount || 0,
              updatedAt: doc.updatedAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('[SovereignDatabase] Legacy migration note:', e.message);
    }
  }

  // Helper APIs for the kernel & apps
  async getSetting(key, defaultValue = null) {
    const item = await this.settings.get(key);
    return item ? item.value : defaultValue;
  }

  async setSetting(key, value) {
    return await this.settings.put({ key, value, updatedAt: Date.now() });
  }

  async getIdentity() {
    return (await this.identities.toArray())[0] || null;
  }

  async saveIdentity(record) {
    return await this.identities.put({
      id: record.id || 'primary_operator',
      ...record,
      updatedAt: new Date().toISOString(),
    });
  }

  // Vault key handling (BYOK, Gemini, Vertex, Ollama, LM Studio)
  async getVaultKey(keyName) {
    const item = await this.vault.get(keyName);
    return item ? item.value : null;
  }

  async setVaultKey(keyName, value, provider = 'generic') {
    return await this.vault.put({
      id: keyName,
      keyName,
      value,
      provider,
      updatedAt: Date.now(),
    });
  }

  // Export entire private cloud DB to JSON snapshot for backup/migration
  async exportSnapshot() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      identities: await this.identities.toArray(),
      settings: await this.settings.toArray(),
      workspaces: await this.workspaces.toArray(),
      documents: await this.documents.toArray(),
      chat_history: await this.chat_history.toArray(),
      mailbox: await this.mailbox.toArray(),
      social_posts: await this.social_posts.toArray(),
      vault: await this.vault.toArray(),
      sentinel_audit: await this.sentinel_audit.toArray(),
      card_decks: await this.card_decks.toArray(),
      contacts: await this.contacts.toArray(),
      call_logs: await this.call_logs.toArray(),
      hosted_sites: await this.hosted_sites.toArray(),
      // Added v8: previously these user tables were never mirrored/backed up.
      manuscripts: await this.manuscripts.toArray(),
      manuscript_state: await this.manuscript_state.toArray(),
      memories: await this.memories.toArray(),
      enclave_records: await this.enclave_records.toArray(),
      workflow_chains: await this.workflow_chains.toArray(),
      git_repositories: await this.git_repositories.toArray(),
      git_commits: await this.git_commits.toArray(),
      git_branches: await this.git_branches.toArray(),
      git_pull_requests: await this.git_pull_requests.toArray(),
      git_issues: await this.git_issues.toArray(),
      git_releases: await this.git_releases.toArray(),
    };
    return JSON.stringify(data, null, 2);
  }

  // Import snapshot
  async importSnapshot(jsonString) {
    const data = JSON.parse(jsonString);
    await this.transaction('rw', [
      this.identities, this.settings, this.workspaces, this.documents,
      this.chat_history, this.mailbox, this.social_posts, this.vault,
      this.sentinel_audit, this.card_decks, this.contacts, this.call_logs, this.hosted_sites,
      this.manuscripts, this.manuscript_state, this.memories, this.enclave_records,
      this.workflow_chains, this.git_repositories, this.git_commits, this.git_branches,
      this.git_pull_requests, this.git_issues, this.git_releases
    ], async () => {
      if (data.manuscripts) await this.manuscripts.bulkPut(data.manuscripts);
      if (data.manuscript_state) await this.manuscript_state.bulkPut(data.manuscript_state);
      if (data.memories) await this.memories.bulkPut(data.memories);
      if (data.enclave_records) await this.enclave_records.bulkPut(data.enclave_records);
      if (data.workflow_chains) await this.workflow_chains.bulkPut(data.workflow_chains);
      if (data.git_repositories) await this.git_repositories.bulkPut(data.git_repositories);
      if (data.git_commits) await this.git_commits.bulkPut(data.git_commits);
      if (data.git_branches) await this.git_branches.bulkPut(data.git_branches);
      if (data.git_pull_requests) await this.git_pull_requests.bulkPut(data.git_pull_requests);
      if (data.git_issues) await this.git_issues.bulkPut(data.git_issues);
      if (data.git_releases) await this.git_releases.bulkPut(data.git_releases);
      if (data.identities) await this.identities.bulkPut(data.identities);
      if (data.settings) await this.settings.bulkPut(data.settings);
      if (data.workspaces) await this.workspaces.bulkPut(data.workspaces);
      if (data.documents) await this.documents.bulkPut(data.documents);
      if (data.chat_history) await this.chat_history.bulkPut(data.chat_history);
      if (data.mailbox) await this.mailbox.bulkPut(data.mailbox);
      if (data.social_posts) await this.social_posts.bulkPut(data.social_posts);
      if (data.vault) await this.vault.bulkPut(data.vault);
      if (data.sentinel_audit) await this.sentinel_audit.bulkPut(data.sentinel_audit);
      if (data.card_decks) await this.card_decks.bulkPut(data.card_decks);
      if (data.contacts) await this.contacts.bulkPut(data.contacts);
      if (data.call_logs) await this.call_logs.bulkPut(data.call_logs);
      if (data.hosted_sites) await this.hosted_sites.bulkPut(data.hosted_sites);
    });
    return true;
  }

  // Mirror full database snapshot to permanent physical disk file
  async mirrorToPhysicalDisk() {
    try {
      const { syncVaultState } = await import('../services/nativeService.js');
      const snapshot = await this.exportSnapshot();
      await syncVaultState('sovereign_db_snapshot.json', snapshot);
    } catch (e) {
      console.warn('[SovereignDB] Physical disk sync note:', e);
    }
  }

  // Restore from permanent physical disk file if IndexedDB is ever empty
  async autoHydrateFromDiskVault() {
    try {
      const { loadVaultState } = await import('../services/nativeService.js');
      const docCount = await this.documents.count();
      const mailCount = await this.mailbox.count();
      const msCount = await this.manuscripts.count();

      // Only rehydrate if local IndexedDB tables are clean/empty
      if (docCount === 0 && mailCount === 0 && msCount === 0) {
        const diskSnapshot = await loadVaultState('sovereign_db_snapshot.json');
        if (diskSnapshot) {
          console.info('[SovereignDB] Rehydrating private database from physical disk vault...');
          await this.importSnapshot(typeof diskSnapshot === 'string' ? diskSnapshot : JSON.stringify(diskSnapshot));
        }
      }
    } catch (e) {
      console.warn('[SovereignDB] Disk vault hydration note:', e);
    }
  }
}

export const db = new SovereignDatabase();

// Initialize permanent storage and background disk sync
if (typeof window !== 'undefined') {
  import('../services/nativeService.js').then(({ requestPersistentStorage }) => {
    requestPersistentStorage();
  });
  db.autoHydrateFromDiskVault().then(() => {
    db.autoMigrateLegacyStorage();
  });

  // Scheduled physical disk synchronization every 60 seconds
  setInterval(() => {
    db.mirrorToPhysicalDisk().catch(() => {});
  }, 60000);
}

export const exportDatabaseBackup = () => db.exportSnapshot();
export const importDatabaseBackup = (jsonString) => db.importSnapshot(jsonString);

export async function resetDatabaseToFactory() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
  return true;
}

export default db;

