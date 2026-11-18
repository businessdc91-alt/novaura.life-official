// Budgets for additions. These are backpressure limits, not small caps: large data
// moves in chunks, and the person can raise an addition's quota in Settings.

/** Default storage per addition; the person can raise it. */
export const DEFAULT_QUOTA_BYTES = 1024 ** 3;
/** The localStorage replacement's limit (browsers allow 5–10 MB). Larger data uses novaura.storage. */
export const LOCAL_STORAGE_LIMIT_BYTES = 64 * 1024 ** 2;
/** Values larger than this move between the frame and the OS in pieces of this size. */
export const CHUNK_BYTES = 16 * 1024 ** 2;
/** The largest single message the OS accepts from an addition. */
export const MAX_MESSAGE_BYTES = 16 * 1024 ** 2;
/** Requests per second per addition; past it the bridge waits and retries. */
export const REQUESTS_PER_SECOND = 50;
/** localStorage writes are combined into one message this often. */
export const LS_BATCH_MS = 50;
/** After a window closes, its port stays open this long so queued writes still land. */
export const DRAIN_MS = 1000;
