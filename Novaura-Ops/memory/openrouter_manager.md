---
name: openrouter_manager_key
description: OpenRouter manager/provisioning key — used to create, limit, and revoke API keys for staff and customers
type: reference
---

OpenRouter manager key is used via the Key Management API to:
- Provision API keys for staff (auto on onboarding)
- Provision customer keys gated behind NovAura subscription tiers
- Revoke keys when users are banned or downgrade
- Set credit limits per tier

Key lives in .env as OPENROUTER_MANAGER_KEY (never hardcoded in source).

**How to apply:** Any key creation/revocation logic calls the Rust `openrouter_admin` module, which reads OPENROUTER_MANAGER_KEY from env. Frontend never sees the manager key.
