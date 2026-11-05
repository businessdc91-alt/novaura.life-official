import { ed25519 } from '@noble/curves/ed25519.js';
import { db } from '../../database/sovereignDatabase.js';
import { getSavedKeyRecord, verifySovereignKey } from '../../services/sovereignAuth.js';

const toHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

// The real public key: derived from the stored secret when there is one, else
// a stored key that looks like one. Older builds stored a made-up "0x_nova_..." string.
function realPublicKey(row) {
  const secret = String(row?.secretKeyHex || '');
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    try {
      return '0x' + toHex(ed25519.getPublicKey(Uint8Array.from(secret.match(/../g), h => parseInt(h, 16))));
    } catch { /* fall through */ }
  }
  const pub = String(row?.publicKey || '');
  return /^0x[0-9a-f]{64}$/i.test(pub) ? pub : '';
}

/**
 * NovAura Sovereign OS — Auth Subsystem
 * Local Cryptographic Sovereign Identity.
 * 100% Offline & Air-Gapped. No Firebase Auth dependency.
 */

class AuthSubsystem {
  constructor() {
    this._kernel = null;
    this.isAuthenticated = false;
    this.currentUser = null;
    this.uid = null;
    this.identity = null;
    this.license = null;
  }

  init(kernel) {
    this._kernel = kernel;
  }

  async onReady() {
    // 1. Check local offline license record
    const savedKey = getSavedKeyRecord();
    if (savedKey && savedKey.valid) {
      this.license = savedKey;
    }

    // 2. The identity row belongs to the mesh layer (sovereignMesh.js), which
    // creates it with a real Ed25519 key pair. Auth only reads it: when both
    // wrote it at first launch, Auth's copy could replace the row without its
    // secret key, and the node got a new identity on the next start.
    const row = await db.getIdentity();
    const { secretKeyHex: _secret, ...stored } = row || {};
    const handle = stored.handle || 'operator';
    const id = {
      id: 'primary_operator',
      handle,
      displayName: stored.displayName || 'Sovereign Node Operator',
      address: stored.address || `${handle}@nova.node`,
      createdAt: stored.createdAt || new Date().toISOString(),
      bio: stored.bio || 'Local Node Operator',
      tier: stored.tier || this.license?.tier || 'SOVEREIGN_NODE',
      ...stored,
      // Never the secret: this identity goes out on the kernel's event bus.
      publicKey: realPublicKey(row),
    };

    this.identity = id;
    this.uid = id.id;
    this.currentUser = {
      uid: id.id,
      email: id.address,
      displayName: id.displayName,
      handle: id.handle,
      tier: id.tier,
    };
    this.isAuthenticated = true;

    this._kernel.ipc.emit('auth:changed', {
      user: this.currentUser,
      uid: this.uid,
      isAuthenticated: this.isAuthenticated,
      identity: this.identity,
    });
  }

  async getToken() {
    return this.identity?.publicKey || '';
  }

  async signOut() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.uid = null;
    this._kernel.ipc.emit('auth:changed', {
      user: null,
      uid: null,
      isAuthenticated: false,
      identity: null,
    });
  }
}

export default AuthSubsystem;
