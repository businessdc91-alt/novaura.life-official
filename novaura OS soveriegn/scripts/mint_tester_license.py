#!/usr/bin/env python3
"""
mint_tester_license.py — Sovereign Node License Minter for Peer Testing

Empowers the Novaura Sovereign Node Operator to cryptographically mint authentic
offline Ed25519 activation license tokens for friends, testers, and peer nodes.

Usage:
  python scripts/mint_tester_license.py --name "Alex" --node-id "NODE-F60E82DB7BFC4F2C"
  
Or simply run without arguments for interactive prompt:
  python scripts/mint_tester_license.py
"""

import os
import sys
import json
import base64
import time
import secrets
import argparse
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ed25519

DEFAULT_KEY_LOCATIONS = [
    Path.home() / ".novaura" / "sovereign_authority_key.json",
    Path("z:/Novaura platform/sovereign_authority_key.json"),
    Path(".novaura/sovereign_authority_key.json")
]

KID = "nova-auth-operator"
EXPECTED_PUBKEY_HEX = "d442d3ac7b1385393c95e17691dade298efe48b79751a550f74ad8de253d8a23"

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def load_authority_private_key(explicit_path=None) -> ed25519.Ed25519PrivateKey:
    # 1. Explicit path
    if explicit_path and Path(explicit_path).exists():
        key_path = Path(explicit_path)
    else:
        # 2. Search default paths
        key_path = None
        for candidate in DEFAULT_KEY_LOCATIONS:
            if candidate.exists():
                key_path = candidate
                break

    # 3. Environment variable fallback
    env_priv = os.environ.get("NOVAURA_AUTHORITY_PRIVKEY_HEX")
    if env_priv and env_priv.strip():
        priv_bytes = bytes.fromhex(env_priv.strip())
        return ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)

    if not key_path:
        raise FileNotFoundError(
            f"Authority key not found. Searched:\n" +
            "\n".join(f"  - {p}" for p in DEFAULT_KEY_LOCATIONS) +
            "\nPlease specify --key-file or set NOVAURA_AUTHORITY_PRIVKEY_HEX."
        )

    with open(key_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        priv_hex = data.get("privateKeyHex") or data.get("privkey")
        if not priv_hex:
            raise ValueError(f"Invalid authority key format in {key_path}")
        return ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(priv_hex))

def mint_license(holder: str, node_id: str, tier: str = "PRO_SOVEREIGN", days_valid: int = 365, priv_key = None):
    holder = holder.strip()
    node_id = node_id.strip()

    if not holder:
        raise ValueError("Holder name cannot be empty.")
    if not node_id:
        raise ValueError("Node ID cannot be empty.")
    if node_id == "*":
        raise ValueError("Wildcard Node IDs ('*') are rejected by Sovereign security rules.")

    if priv_key is None:
        priv_key = load_authority_private_key()

    # Verify public key matches
    derived_pub = priv_key.public_key().public_bytes_raw().hex().lower()
    if derived_pub != EXPECTED_PUBKEY_HEX.lower():
        print(f"[!] Warning: Derived authority pubkey {derived_pub} differs from {EXPECTED_PUBKEY_HEX}")

    now = int(time.time())
    expires = now + (days_valid * 86400)
    license_id = secrets.token_hex(16)

    payload = {
        "v": 1,
        "kid": KID,
        "licenseId": license_id,
        "holder": holder,
        "tier": tier,
        "nodeId": node_id,
        # Bound to the Windows installation ID only (not the old PC-name ID)
        "bind": "machine",
        "issued": now,
        "expires": expires
    }

    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
    payload_b64 = b64url_encode(payload_json)

    # Sign the base64url payload string
    signature = priv_key.sign(payload_b64.encode('utf-8'))
    sig_b64 = b64url_encode(signature)

    token = f"NOVA1.{payload_b64}.{sig_b64}"

    # Self-verify
    pub_key = priv_key.public_key()
    pub_key.verify(signature, payload_b64.encode('utf-8'))

    return token, payload

def main():
    parser = argparse.ArgumentParser(description="Novaura Sovereign License Token Minter for Testers")
    parser.add_argument("--name", "-n", dest="holder", help="Friend or Tester Name / Handle")
    parser.add_argument("--node-id", "-i", dest="node_id", help="Friend's Hardware Node ID (NODE-XXXXXXXXXXXXXXXX)")
    parser.add_argument("--tier", "-t", default="PRO_SOVEREIGN", choices=["PRO_SOVEREIGN", "FOUNDER_SOVEREIGN", "FOUNDER_GENESIS", "TESTER_PREVIEW"], help="License tier")
    parser.add_argument("--days", "-d", type=int, default=365, help="Days valid (default: 365)")
    parser.add_argument("--key-file", "-k", help="Path to authority private key JSON")
    parser.add_argument("--out", "-o", help="Optional output text file")

    args = parser.parse_args()

    print("=" * 72)
    print("      NOVAURA SOVEREIGN OS — TESTER LICENSE MINTER")
    print("=" * 72)

    try:
        priv_key = load_authority_private_key(args.key_file)
        print(f"[+] Loaded Authority Key: {KID}")
    except Exception as e:
        print(f"[x] Error loading authority key: {e}")
        sys.exit(1)

    holder = args.holder
    if not holder:
        try:
            holder = input("\nEnter friend or tester name/handle: ").strip()
        except EOFError:
            holder = "Novaura Tester"

    node_id = args.node_id
    if not node_id:
        try:
            print("\nNote: Your friend will see their Node ID on the Sovereign Activation Screen")
            print("Example format: NODE-F60E82DB7BFC4F2C\n")
            node_id = input("Enter friend's Hardware Node ID: ").strip()
        except EOFError:
            node_id = ""

    if not node_id:
        print("[x] Error: Node ID is required for hardware-bound cryptographic activation.")
        sys.exit(1)

    try:
        token, payload = mint_license(
            holder=holder,
            node_id=node_id,
            tier=args.tier,
            days_valid=args.days,
            priv_key=priv_key
        )
    except Exception as e:
        print(f"[x] Failed to mint license: {e}")
        sys.exit(1)

    issue_date = time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(payload['issued']))
    expire_date = time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(payload['expires']))

    print("\n" + "=" * 72)
    print("           AUTHENTIC SOVEREIGN ACTIVATION KEY GENERATED")
    print("=" * 72)
    print(f" Licensee:    {payload['holder']}")
    print(f" Bound Node:  {payload['nodeId']}")
    print(f" Tier:        {payload['tier']}")
    print(f" Authority:   {payload['kid']}")
    print(f" Issued:      {issue_date}")
    print(f" Valid Until: {expire_date} ({args.days} days)")
    print("-" * 72)
    print("\nSEND THIS ACTIVATION KEY TO YOUR FRIEND:\n")
    print(token)
    print("\n" + "-" * 72)

    # Save to file
    out_filename = args.out or f"activation_key_{holder.replace(' ', '_').lower()}.txt"
    content = f"""NOVAURA SOVEREIGN OS — TESTER ACTIVATION INSTRUCTIONS
----------------------------------------------------------------------
Welcome {payload['holder']} to Novaura Sovereign OS testing!

1. Download and install Novaura Sovereign OS (or launch app.exe).
2. When the Sovereign Activation Gate appears, paste your Activation Key:

{token}

3. Click "Activate Node" to unlock full sovereign functionality.
----------------------------------------------------------------------
Bound Hardware Node: {payload['nodeId']}
License Tier:        {payload['tier']}
Valid Until:         {expire_date}
Authority:           {payload['kid']} (Ed25519 Cryptographic Signature)
"""
    try:
        with open(out_filename, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[+] Saved complete friend activation instructions to:\n    {os.path.abspath(out_filename)}\n")
    except Exception as e:
        print(f"[!] Note: Could not write output file: {e}")

if __name__ == "__main__":
    main()
