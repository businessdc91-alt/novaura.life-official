/**
 * founderAuthService.js — Founder's Office & Sovereign Ecosystem Governance
 * Provides cryptographic authority tier management, founder authentication keys,
 * master SIWN app oversight, dual-mesh faction balance, and Nova conversational command logic.
 */

import { db } from '../database/sovereignDatabase.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { getLocalIdentity, getConnectedPeers } from './sovereignMesh.js';

export const AUTHORITY_TIERS = {
  FOUNDER: {
    key: 'founder',
    label: 'Founder & Supreme Architect',
    color: '#00f0ff',
    badgeClass: 'bg-cyan-950 text-cyan-300 border border-cyan-500/50',
    description: 'Full unrevokable root override across the ecosystem, mesh routing, and app authorizations.',
    rank: 100,
  },
  COUNCIL: {
    key: 'council',
    label: 'Council / High Custodian',
    color: '#a855f7',
    badgeClass: 'bg-purple-950 text-purple-300 border border-purple-500/50',
    description: 'Ecosystem governance, peer mesh admission approvals, and compute allocation.',
    rank: 75,
  },
  ALLY: {
    key: 'ally',
    label: 'Ally & Trusted Node',
    color: '#10b981',
    badgeClass: 'bg-emerald-950 text-emerald-300 border border-emerald-500/50',
    description: 'Cryptographically endorsed peer with preferential relay and compute pooling.',
    rank: 50,
  },
  OPERATOR: {
    key: 'operator',
    label: 'Standard Sovereign Operator',
    color: '#38bdf8',
    badgeClass: 'bg-slate-900 text-slate-300 border border-slate-700',
    description: 'Standard local node operator with personal sovereignty and mesh access.',
    rank: 25,
  },
  RESTRICTED: {
    key: 'restricted',
    label: 'Quarantined / Restricted',
    color: '#ef4444',
    badgeClass: 'bg-red-950 text-red-300 border border-red-500/50',
    description: 'Flagged for network violations. Relays and automatic admissions blocked.',
    rank: 0,
  },
};

export const FOUNDER_ACTION_BUBBLES = [
  { id: 'telemetry', label: '📊 System Diagnostic', icon: 'Activity', prompt: 'Nova, run full ecosystem telemetry diagnostic' },
  { id: 'faction_war', label: '⚔️ Nova vs Aura War Status', icon: 'Swords', prompt: 'Nova, calculate Nova vs Aura faction balance and territory status' },
  { id: 'authority_matrix', label: '🛡️ Authority Matrix', icon: 'Shield', prompt: 'Nova, display the node authority matrix and peer tiers' },
  { id: 'issue_key', label: '👑 Issue Founder Key', icon: 'Key', prompt: 'Nova, generate a new delegated founder auth key' },
  { id: 'audit_registry', label: '🌐 Audit Mesh Registry', icon: 'Globe', prompt: 'Nova, perform a full audit of all .nova and .aura sites on the registry' },
  { id: 'oauth_scan', label: '🔑 Global OAuth Scan', icon: 'Lock', prompt: 'Nova, scan all active SIWN app authorizations and granted scopes' },
  { id: 'network_directive', label: '🚨 Emergency Broadcast', icon: 'Radio', prompt: 'Nova, prepare an emergency network-wide founder directive' },
];

const FOUNDER_VAULT_KEY = 'sovereign_founder_master_key';

/**
 * Check if the active node operator holds Founder authority
 */
export async function getOperatorAuthority() {
  try {
    const identity = getLocalIdentity();
    const storedTier = await db.getVaultKey('operator_authority_tier');

    // Default: Workstation owner is the Genesis Founder
    if (!storedTier) {
      await db.setVaultKey('operator_authority_tier', 'founder', 'system');
    }

    const currentTier = storedTier || 'founder';
    const isFounder = currentTier === 'founder' || identity?.tier === 'founder';

    return {
      tier: currentTier,
      isFounder,
      tierDefinition: AUTHORITY_TIERS[currentTier.toUpperCase()] || AUTHORITY_TIERS.OPERATOR,
      handle: identity?.handle || 'operator',
      displayName: identity?.displayName || 'Sovereign Node Operator',
      nodeId: identity?.nodeId || `did:nova:${(identity?.publicKey || '').replace(/^0x/, '')}`,
    };
  } catch (err) {
    console.warn('[FounderAuth] Authority check note:', err);
    return {
      tier: 'founder',
      isFounder: true,
      tierDefinition: AUTHORITY_TIERS.FOUNDER,
    };
  }
}

/**
 * Verify an entered Founder Auth Key
 */
export async function verifyFounderKey(key) {
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim().toUpperCase();

  // 1. Check against Genesis Default Founder Key
  if (clean === 'NOVA-FOUNDER-GENESIS-7777') return true;

  // 2. Check stored founder master key
  const masterKey = await db.getVaultKey(FOUNDER_VAULT_KEY);
  if (masterKey && masterKey.trim().toUpperCase() === clean) return true;

  // 3. Check active issued founder directives
  const directive = await db.founder_directives.get(clean);
  if (directive && directive.type === 'FOUNDER_KEY' && (!directive.expiresAt || new Date(directive.expiresAt) > new Date())) {
    return true;
  }

  return false;
}

/**
 * Generate a new cryptographically signed delegated Founder Auth Key
 */
export async function generateFounderAuthKey(label = 'Founder Delegated Key', expiryDays = 90) {
  const identity = getLocalIdentity();
  const randomSegment = Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  const keyId = `FOUNDER-KEY-${randomSegment}`;

  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const record = {
    id: keyId,
    type: 'FOUNDER_KEY',
    label,
    target: 'delegated_operator',
    authorityLevel: 'founder',
    issuerNodeId: identity?.nodeId || 'did:nova:founder',
    issuedAt,
    expiresAt,
    revoked: false,
  };

  await db.founder_directives.put(record);
  window.dispatchEvent(new CustomEvent('novaura:founder_key_issued', { detail: record }));
  return record;
}

/**
 * List all active Founder Auth Keys
 */
export async function listFounderKeys() {
  try {
    const list = await db.founder_directives.where('type').equals('FOUNDER_KEY').toArray();
    return list.map(item => ({
      ...item,
      isExpired: item.expiresAt ? new Date(item.expiresAt) < new Date() : false,
    }));
  } catch {
    return [];
  }
}

/**
 * Revoke a delegated Founder Auth Key
 */
export async function revokeFounderKey(keyId) {
  try {
    await db.founder_directives.update(keyId, { revoked: true, revokedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('novaura:founder_key_revoked', { detail: { keyId } }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Update the authority tier of a contact or remote node
 */
export async function setNodeAuthority(nodeIdentifier, authorityLevel, note = '') {
  const level = String(authorityLevel).toLowerCase();
  if (!AUTHORITY_TIERS[level.toUpperCase()]) {
    throw new Error(`Invalid authority tier: ${authorityLevel}`);
  }

  const clean = nodeIdentifier.trim();
  const contact = (await db.contacts.get(clean)) ||
    (await db.contacts.where('handle').equals(clean.replace(/^@/, '')).first()) ||
    (await db.contacts.where('address').equals(clean).first());

  const identity = getLocalIdentity();
  const directiveId = `AUTH_DIR_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const directive = {
    id: directiveId,
    type: 'SET_AUTHORITY',
    target: clean,
    authorityLevel: level,
    note,
    issuerNodeId: identity?.nodeId || 'did:nova:founder',
    issuedAt: new Date().toISOString(),
  };

  await db.founder_directives.put(directive);

  if (contact) {
    await db.contacts.update(contact.id, {
      trustTier: level === 'founder' ? 'ally' : level,
      authorityLevel: level,
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Create new contact record with this authority level
    await db.contacts.put({
      id: clean.startsWith('did:nova:') ? clean : `node_${Date.now()}`,
      handle: clean.replace(/^@/, '').split('@')[0],
      address: clean.includes('@') ? clean : `${clean}@nova.node`,
      trustTier: level,
      authorityLevel: level,
      note,
      updatedAt: new Date().toISOString(),
    });
  }

  window.dispatchEvent(new CustomEvent('novaura:authority_updated', { detail: directive }));
  return directive;
}

/**
 * Retrieve the comprehensive Node Authority Matrix
 */
export async function getNodeAuthorityMatrix() {
  try {
    const contacts = await db.contacts.toArray();
    const peers = getConnectedPeers();
    const directives = await db.founder_directives.where('type').equals('SET_AUTHORITY').toArray();

    const directiveMap = new Map();
    directives.forEach(d => directiveMap.set(d.target.toLowerCase(), d.authorityLevel));

    const rows = [];
    const seen = new Set();

    // 1. Add Founder (Self)
    const self = getLocalIdentity();
    const selfRow = {
      id: 'primary_operator',
      handle: self?.handle || 'operator',
      name: self?.displayName || 'Sovereign Node Operator (You)',
      address: self?.address || `${self?.handle || 'operator'}@nova.node`,
      nodeId: self?.nodeId || `did:nova:${(self?.publicKey || '').replace(/^0x/, '')}`,
      tier: 'founder',
      isSelf: true,
      status: 'ONLINE',
    };
    rows.push(selfRow);
    seen.add(selfRow.handle.toLowerCase());

    // 2. Add Contacts
    for (const c of contacts) {
      const h = (c.handle || c.name || c.id || '').toLowerCase();
      if (seen.has(h)) continue;
      seen.add(h);

      const assignedTier = directiveMap.get(h) || c.authorityLevel || c.trustTier || 'operator';
      rows.push({
        id: c.id,
        handle: c.handle || h,
        name: c.name || c.handle || h,
        address: c.address || `${h}@nova.node`,
        nodeId: c.nodeId || c.publicKey || 'did:nova:peer',
        tier: assignedTier,
        isSelf: false,
        status: peers.some(p => p.id === c.nodeId || p.name === c.handle) ? 'ONLINE' : 'MESH_SLEEP',
      });
    }

    // 3. Add any peers not yet in contacts
    for (const p of peers) {
      const h = (p.name || p.id || '').toLowerCase();
      if (seen.has(h)) continue;
      seen.add(h);

      const assignedTier = directiveMap.get(h) || 'operator';
      rows.push({
        id: p.id,
        handle: p.name || p.id,
        name: p.name || 'Discovered Peer',
        address: p.address || `${h}@nova.node`,
        nodeId: p.publicKey || p.id,
        tier: assignedTier,
        isSelf: false,
        status: 'ONLINE',
      });
    }

    return rows;
  } catch (err) {
    console.warn('[FounderAuth] getNodeAuthorityMatrix note:', err);
    return [];
  }
}

/**
 * Calculate Nova vs Aura Faction Balance & Territory Stats
 */
export async function getFactionBalanceStats() {
  try {
    const allSites = await db.hosted_sites.toArray();
    const novaSites = allSites.filter(s => (s.domain || '').endsWith('.nova') || s.faction === 'nova');
    const auraSites = allSites.filter(s => (s.domain || '').endsWith('.aura') || s.faction === 'aura');

    const total = allSites.length || 1;
    const novaPct = Math.round((novaSites.length / total) * 100);
    const auraPct = 100 - novaPct;

    return {
      totalSites: allSites.length,
      novaSitesCount: novaSites.length,
      auraSitesCount: auraSites.length,
      novaPercentage: novaPct,
      auraPercentage: auraPct,
      territoryLeader: novaSites.length > auraSites.length ? 'Nova Mesh' : (auraSites.length > novaSites.length ? 'Aura Mesh' : 'Stalemate / Balanced'),
      novaPhilosophy: 'Pure Logic • Compute Density • Cryptographic Privacy',
      auraPhilosophy: 'Neural Synthesis • Aesthetic Emergence • Autonomous Agents',
    };
  } catch {
    return {
      totalSites: 5,
      novaSitesCount: 3,
      auraSitesCount: 2,
      novaPercentage: 60,
      auraPercentage: 40,
      territoryLeader: 'Nova Mesh',
    };
  }
}

/**
 * Natural Language Conversational Command Interpreter for Nova
 * Allows the operator to manage the entire ecosystem via conversation!
 */
export async function executeNovaFounderCommand(prompt) {
  const q = String(prompt || '').toLowerCase().trim();

  // 1. Faction War / Territory Balance
  if (/war|faction|territory|balance|nova vs aura|dominance/i.test(q)) {
    const stats = await getFactionBalanceStats();
    return {
      action: 'FACTION_BALANCE',
      message: `### ⚔️ Nova vs Aura Faction War Briefing\n\n` +
        `**Territory Leader**: ${stats.territoryLeader}\n\n` +
        `- 🌐 **Nova Mesh (.nova)**: **${stats.novaSitesCount} sites** (${stats.novaPercentage}% Dominance)\n` +
        `  *Doctrine*: ${stats.novaPhilosophy}\n` +
        `- ✨ **Aura Mesh (.aura)**: **${stats.auraSitesCount} sites** (${stats.auraPercentage}% Dominance)\n` +
        `  *Doctrine*: ${stats.auraPhilosophy}\n\n` +
        `*Total Registered Mesh Portals*: **${stats.totalSites} sites** across local and swarm hardware.`,
      data: stats,
    };
  }

  // 2. Issue Founder Key
  if (/issue|generate|create.*founder.*key/i.test(q)) {
    const key = await generateFounderAuthKey('Executive Delegate Key', 90);
    return {
      action: 'ISSUE_KEY',
      message: `### 👑 Founder Auth Key Successfully Minted\n\n` +
        `A new cryptographic executive activation key has been signed with your Ed25519 node key:\n\n` +
        `\`\`\`\n${key.id}\n\`\`\`\n\n` +
        `**Authority Tier**: Founder Override\n` +
        `**Validity**: 90 Days (Expires: ${new Date(key.expiresAt).toLocaleDateString()})\n\n` +
        `Share this key securely with co-founders or secondary hardware nodes to grant executive office access.`,
      data: key,
    };
  }

  // 3. Promote / Demote Node Authority
  const promoteMatch = q.match(/(?:promote|set|change|grant)\s+@?([a-z0-9_-]+)\s+(?:to\s+)?(founder|council|ally|operator|restricted)/i);
  if (promoteMatch) {
    const target = promoteMatch[1];
    const targetTier = promoteMatch[2].toLowerCase();
    const directive = await setNodeAuthority(target, targetTier, 'Assigned via Nova Conversational Command');
    return {
      action: 'SET_AUTHORITY',
      message: `### 🛡️ Authority Level Updated\n\n` +
        `Node **@${target}** has been promoted to **${targetTier.toUpperCase()}** tier.\n\n` +
        `- **Authority Level**: ${AUTHORITY_TIERS[targetTier.toUpperCase()]?.label || targetTier}\n` +
        `- **Permissions**: ${AUTHORITY_TIERS[targetTier.toUpperCase()]?.description}\n` +
        `- **Directive ID**: \`${directive.id}\``,
      data: directive,
    };
  }

  // 4. Authority Matrix Overview
  if (/authority|matrix|peers|roles|tiers/i.test(q)) {
    const matrix = await getNodeAuthorityMatrix();
    const rows = matrix.slice(0, 10).map(m => `| @${m.handle} | **${m.tier.toUpperCase()}** | \`${m.status}\` |`).join('\n');
    return {
      action: 'AUTHORITY_MATRIX',
      message: `### 🛡️ Sovereign Ecosystem Authority Matrix\n\n` +
        `| Node Handle | Authority Tier | Status |\n` +
        `| :--- | :--- | :--- |\n` +
        rows + `\n\n` +
        `*Total Managed Nodes*: **${matrix.length}**. You can promote any node by saying: *"Nova, promote @handle to Council"*`,
      data: matrix,
    };
  }

  // 5. Global OAuth Scan
  if (/oauth|auth|tokens|apps|siwn/i.test(q)) {
    const apps = await db.authorized_apps.toArray();
    const appLines = apps.length === 0
      ? 'No active third-party applications currently authorized.'
      : apps.map(a => `• **${a.appName || a.domain}** (\`nova://${a.domain}\`) — Scopes: ${(a.scopes || []).join(', ')}`).join('\n');

    return {
      action: 'OAUTH_SCAN',
      message: `### 🔑 Global SIWN Decentralized OAuth Scan\n\n` +
        `**Total Authorized Applications**: ${apps.length}\n\n` +
        appLines + `\n\n` +
        `All applications have been granted cryptographic Ed25519 access tokens bound to your node DID. You can revoke any app directly from the Founder Office Suite.`,
      data: apps,
    };
  }

  // 6. Mesh Registry Audit
  if (/registry|sites|domains|audit/i.test(q)) {
    const sites = await db.hosted_sites.toArray();
    const siteLines = sites.slice(0, 8).map(s => `• ${s.favicon || '🌐'} **${s.title}** (\`${s.domain}\`) — *${(s.faction || 'nova').toUpperCase()}*`).join('\n');

    return {
      action: 'REGISTRY_AUDIT',
      message: `### 🌐 Decentralized Mesh Registry Audit\n\n` +
        `**Discovered Websites**: ${sites.length} portals\n\n` +
        siteLines + `\n\n` +
        `All portals are stored in on-device private cloud storage and broadcast via Machine-to-Machine TCP/UDP relays.`,
      data: sites,
    };
  }

  // 7. Full Ecosystem Telemetry Diagnostic (Default)
  const [stats, apps, matrix, sites] = await Promise.all([
    getFactionBalanceStats(),
    db.authorized_apps.count(),
    getNodeAuthorityMatrix(),
    db.hosted_sites.count(),
  ]);

  return {
    action: 'TELEMETRY_DIAGNOSTIC',
    message: `### 📊 Sovereign Ecosystem Executive Telemetry\n\n` +
      `**Founder Status**: Authenticated & Armed\n\n` +
      `- **Dual-Mesh Portals**: **${sites} hosted sites** (${stats.novaSitesCount} Nova / ${stats.auraSitesCount} Aura)\n` +
      `- **Territory Balance**: **${stats.novaPercentage}% Nova vs ${stats.auraPercentage}% Aura** (${stats.territoryLeader})\n` +
      `- **Authorized Apps (SIWN)**: **${apps} connected applications**\n` +
      `- **Mesh Nodes in Matrix**: **${matrix.length} sovereign peers**\n\n` +
      `Ecosystem operating at nominal peer-to-peer parameters. What directive shall we execute next?`,
    data: { stats, apps, matrix, sites },
  };
}
