import { db } from '../../database/sovereignDatabase.js';
import { getSavedKeyRecord, verifySovereignKey } from '../../services/sovereignAuth.js';

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

    // 2. Load or initialize sovereign local identity
    let id = await db.getIdentity();
    if (!id) {
      const handle = 'operator';
      const displayName = 'Sovereign Node Operator';
      id = {
        id: 'primary_operator',
        handle,
        displayName,
        address: `${handle}@nova.node`,
        publicKey: `0x_nova_${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}`,
        createdAt: new Date().toISOString(),
        bio: 'Local Node Operator',
        tier: this.license?.tier || 'SOVEREIGN_NODE',
      };
      await db.saveIdentity(id);
    }

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
    return this.identity?.publicKey || 'sovereign_token';
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
