// Official Novaura Sovereign Authority Public Keys Registry.
// Each entry maps an explicit Key ID ('kid') to its Ed25519 public key and operational status.
// Licenses and registry operator certificates both chain to these keys; their
// private keys never ship with the app.
export const TRUSTED_AUTHORITIES = {
  'nova-auth-2026-v1': {
    pubkeyHex: 'e71dced6ba1e1646f9ad868a00c0479933d602775f81cbf81bf6e9b6a49e0143',
    status: 'ACTIVE',
    tier: 'ROOT_GENESIS',
  },
  'nova-auth-operator': {
    pubkeyHex: 'd442d3ac7b1385393c95e17691dade298efe48b79751a550f74ad8de253d8a23',
    status: 'ACTIVE',
    tier: 'FOUNDER_GENESIS',
  },
};
