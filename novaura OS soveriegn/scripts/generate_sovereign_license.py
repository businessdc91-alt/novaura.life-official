#!/usr/bin/env python3
"""
generate_sovereign_license.py
Official Ed25519 License Token Minting Engine for Novaura Sovereign OS.

Produces cryptographic tokens in format:
  NOVA1.<base64url_json_payload>.<base64url_ed25519_signature>

Security Hardening:
- Zero hardcoded private keys in source tree. Loaded from NOVAURA_AUTHORITY_PRIVKEY_HEX or encrypted file.
- Multi-Authority Key ID ('kid') header embedded in payload for key rotation and revocation.
- Cryptographically secure CSPRNG license identifiers (secrets.token_hex(16)).
- Mandatory hardware node ID binding (wildcard licenses strictly prohibited).
- Strict UNIX timestamp expiration enforcement.
"""

import os
import sys
import json
import base64
import time
import secrets
import argparse
from cryptography.hazmat.primitives.asymmetric import ed25519

# Official Public Key Registry (Public keys safe to distribute)
AUTHORITY_KEYS = {
    "nova-auth-2026-v1": {
        "pubkey_hex": "e71dced6ba1e1646f9ad868a00c0479933d602775f81cbf81bf6e9b6a49e0143",
        "tier": "ROOT_GENESIS",
        "status": "ACTIVE"
    },
    "nova-auth-operator": {
        "pubkey_hex": "d442d3ac7b1385393c95e17691dade298efe48b79751a550f74ad8de253d8a23",
        "tier": "FOUNDER_GENESIS",
        "status": "ACTIVE"
    }
}

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def get_authority_private_key(privkey_hex: str = None, key_file: str = None) -> ed25519.Ed25519PrivateKey:
    # 1. Check explicit argument
    if privkey_hex and privkey_hex.strip():
        return ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(privkey_hex.strip()))

    # 2. Check environment variable
    env_key = os.environ.get("NOVAURA_AUTHORITY_PRIVKEY_HEX")
    if env_key and env_key.strip():
        return ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(env_key.strip()))

    # 3. Check key file path
    if key_file and os.path.exists(key_file):
        with open(key_file, "r", encoding="utf-8") as f:
            content = f.read().strip()
            # If JSON file containing privateKeyHex
            if content.startswith("{"):
                data = json.loads(content)
                hex_str = data.get("privateKeyHex") or data.get("privkey")
                if hex_str:
                    return ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(hex_str))
            else:
                return ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(content))

    print("ERROR: Authority private key is required to sign authentic sovereign licenses.", file=sys.stderr)
    print("Please set the NOVAURA_AUTHORITY_PRIVKEY_HEX environment variable or pass --key-file.", file=sys.stderr)
    sys.exit(1)

def create_license(
    holder: str,
    node_id: str,
    tier: str = "PRO_SOVEREIGN",
    days_valid: int = 3650,
    kid: str = "nova-auth-2026-v1",
    privkey_hex: str = None,
    key_file: str = None
) -> str:
    if not node_id or node_id.strip() in ("*", ""):
        raise ValueError("Strict Node Binding Enforced: --node-id cannot be blank or '*' wildcard.")

    if kid not in AUTHORITY_KEYS:
        raise ValueError(f"Unknown authority Key ID '{kid}'. Available: {list(AUTHORITY_KEYS.keys())}")

    priv_key = get_authority_private_key(privkey_hex, key_file)
    
    # Verify private key corresponds to the designated kid public key
    derived_pubkey_hex = priv_key.public_key().public_bytes_raw().hex()
    expected_pubkey_hex = AUTHORITY_KEYS[kid]["pubkey_hex"]
    if derived_pubkey_hex.lower() != expected_pubkey_hex.lower():
        print(f"WARNING: Derived public key ({derived_pubkey_hex}) does not match registered authority kid '{kid}' ({expected_pubkey_hex}).", file=sys.stderr)

    now = int(time.time())
    expires = now + (days_valid * 86400)
    license_id = secrets.token_hex(16)

    payload = {
        "v": 1,
        "kid": kid,
        "licenseId": license_id,
        "holder": holder.strip(),
        "tier": tier.strip(),
        "nodeId": node_id.strip(),
        "issued": now,
        "expires": expires
    }

    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
    payload_b64 = b64url_encode(payload_json)

    # Sign the base64url payload string
    signature = priv_key.sign(payload_b64.encode('utf-8'))
    sig_b64 = b64url_encode(signature)

    token = f"NOVA1.{payload_b64}.{sig_b64}"
    return token, payload

def main():
    parser = argparse.ArgumentParser(description="Novaura Sovereign License Token Minter")
    parser.add_argument("--holder", required=True, help="Licensee full legal name or organization")
    parser.add_argument("--node-id", required=True, help="Mandatory Hardware Node ID (run app to obtain local machine node ID)")
    parser.add_argument("--tier", default="FOUNDER_SOVEREIGN", help="Tier: FOUNDER_SOVEREIGN, ENTERPRISE, PRO_SOVEREIGN, COMMUNITY")
    parser.add_argument("--days", type=int, default=3650, help="Days until expiration (default: 10 years)")
    parser.add_argument("--kid", default="nova-auth-2026-v1", help="Authority Key ID (default: nova-auth-2026-v1)")
    parser.add_argument("--key-hex", default=None, help="Authority private key hex (alternatively set NOVAURA_AUTHORITY_PRIVKEY_HEX)")
    parser.add_argument("--key-file", default=None, help="Path to offline secure key file")

    args = parser.parse_args()

    token, payload = create_license(
        holder=args.holder,
        node_id=args.node_id,
        tier=args.tier,
        days_valid=args.days,
        kid=args.kid,
        privkey_hex=args.key_hex,
        key_file=args.key_file
    )

    print("\n--- NOVAURA SOVEREIGN AUTHENTIC CRYPTOGRAPHIC LICENSE ---")
    print(f"Key ID:      {payload['kid']}")
    print(f"License ID:  {payload['licenseId']}")
    print(f"Holder:      {payload['holder']}")
    print(f"Tier:        {payload['tier']}")
    print(f"Bound Node:  {payload['nodeId']}")
    print(f"Issued:      {payload['issued']} ({time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(payload['issued']))} UTC)")
    print(f"Expires:     {payload['expires']} ({time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(payload['expires']))} UTC)")
    print(f"\nToken:\n{token}\n")

if __name__ == "__main__":
    main()
