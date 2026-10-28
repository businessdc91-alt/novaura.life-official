/**
 * Beta feedback routing. Reports never touch a cloud service: they travel over
 * the Sovereign mesh to the NovAura team node, end-to-end encrypted to the
 * feedback inbox key below. Only the node holding the matching secret
 * (vault key `beta_feedback_inbox_key`) can read them.
 *
 * Override per build with VITE_SOVEREIGN_FEEDBACK_NODE / VITE_SOVEREIGN_FEEDBACK_PUBKEY.
 */

// Mesh node ID of the machine that receives beta reports (its hardware node ID,
// shown on the activation screen and in Sovereign Network).
export const FEEDBACK_NODE_ID =
  import.meta.env.VITE_SOVEREIGN_FEEDBACK_NODE || 'NODE-F60E82DB7BFC4F2C';

// Ed25519 public key of the feedback inbox (hex, no 0x).
export const FEEDBACK_INBOX_PUBKEY = (
  import.meta.env.VITE_SOVEREIGN_FEEDBACK_PUBKEY ||
  'a6118b2417f6f3fe7d3e2b8ad96d0c478034f578f62dca7c5c8f6e8b50f0879e'
).replace(/^0x/, '').toLowerCase();

export const FEEDBACK_INBOX_VAULT_KEY = 'beta_feedback_inbox_key';

// Domain-separated message the inbox signs to confirm receipt of a report.
export const feedbackAckMessage = (clientId) => `NOVA-FEEDBACK-ACK:${clientId}`;
