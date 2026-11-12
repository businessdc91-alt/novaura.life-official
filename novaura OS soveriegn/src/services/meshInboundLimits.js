/**
 * Per-sender limits on what other nodes can make this one do. Checked after the
 * signature, so a budget belongs to a key and nobody can spend someone else's.
 *
 * - Requests that make this node send data back (feed sync, site and search
 *   lookups...) get small budgets, so nobody can use the mesh to flood a peer
 *   with this node's uploads.
 * - Mail and greeting cards get budgets, so nobody can fill an inbox.
 * - Everything else shares one generous ceiling per sender. File-transfer packets
 *   are left out: transfers pace themselves (a few 4 MB pieces in flight).
 */

// burst: how many may arrive at once; perMinute: how fast the allowance refills
export const TYPE_LIMITS = {
  MESH_POSTS_REQUEST: { burst: 2, perMinute: 1 },
  MESH_STORIES_REQUEST: { burst: 2, perMinute: 1 },
  MESH_SITE_QUERY: { burst: 10, perMinute: 20 },
  MESH_SEARCH_QUERY: { burst: 5, perMinute: 10 },
  MESH_ARTICLE_REQUEST: { burst: 5, perMinute: 10 },
  MESH_WEB_SEARCH: { burst: 5, perMinute: 10 },
  MESH_DOMAIN_QUERY: { burst: 20, perMinute: 60 },
  MESH_PHONE_LOOKUP: { burst: 5, perMinute: 10 },
  MESH_INFERENCE_DISCOVER: { burst: 3, perMinute: 6 },
  MESH_INFERENCE_REQUEST: { burst: 3, perMinute: 6 },
  // 10 at once, then 30 an hour
  MESH_MAIL: { burst: 10, perMinute: 0.5 },
  MESH_GREETING_CARD: { burst: 3, perMinute: 0.2 },
};

export const GENERAL_LIMIT = { burst: 400, perMinute: 1200 };

// Budgets kept before idle ones are dropped
const MAX_BUCKETS = 20_000;
const IDLE_MS = 10 * 60_000;

export function createInboundLimiter(now = () => Date.now()) {
  const buckets = new Map(); // `${sender}|${type or *}` -> { tokens, at }

  const prune = (t) => {
    for (const [key, b] of buckets) if (t - b.at > IDLE_MS) buckets.delete(key);
    // Still full: many senders at once. Start over rather than grow without bound.
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
  };

  const take = (key, { burst, perMinute }) => {
    const t = now();
    let b = buckets.get(key);
    if (!b) {
      if (buckets.size >= MAX_BUCKETS) prune(t);
      b = { tokens: burst, at: t };
      buckets.set(key, b);
    }
    b.tokens = Math.min(burst, b.tokens + ((t - b.at) / 60_000) * perMinute);
    b.at = t;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };

  return {
    /** True when `sender` (a verified DID) may have a packet of `type` handled now. */
    allow(sender, type) {
      if (!sender || String(type).startsWith('MESH_XFER_')) return true;
      const limit = TYPE_LIMITS[type];
      if (limit && !take(`${sender}|${type}`, limit)) return false;
      return take(`${sender}|*`, GENERAL_LIMIT);
    },
    size: () => buckets.size,
  };
}
