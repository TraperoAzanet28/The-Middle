/**
 * Phase 0 rate limiting — in-memory sliding window, keyed by client IP.
 *
 * ⚠️ PRODUCTION NOTE:
 * This Map lives in the memory of a single serverless function instance.
 * Vercel may spin up multiple concurrent instances (and recycles/cold-starts
 * them), so this limiter only protects a single warm instance — it is NOT a
 * durable, globally-consistent rate limit. Treat it as a cheap first line of
 * defense against accidental abuse (e.g. a runaway client retry loop), not a
 * real abuse-prevention system.
 *
 * Before Phase 1 goes live with a real (paid) model behind these endpoints,
 * replace this with a durable, shared store such as:
 *   - Vercel KV (Redis-compatible) — https://vercel.com/docs/storage/vercel-kv
 *   - Upstash Redis (works great with serverless, has a free tier)
 * Both support atomic increment + TTL, which is what a correct distributed
 * sliding/fixed window limiter needs.
 */

const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20; // generous for Phase 0 stub traffic
const MAX_TRACKED_IPS = 5_000; // naive memory cap to avoid unbounded growth

const requestLog = new Map<string, number[]>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
};

/**
 * Checks and records a request for the given key (typically client IP).
 * Uses a sliding window: keeps only timestamps within the last WINDOW_MS.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();

  // Naive cap: if the map is getting large (e.g. under broad scanning/abuse),
  // drop the oldest-looking entries rather than growing unbounded. This is a
  // crude safeguard only — a durable store (see note above) handles this
  // properly via TTL-based eviction.
  if (requestLog.size > MAX_TRACKED_IPS) {
    const oldestKey = requestLog.keys().next().value;
    if (oldestKey !== undefined) {
      requestLog.delete(oldestKey);
    }
  }

  const existing = requestLog.get(key) ?? [];
  const withinWindow = existing.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (withinWindow.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = withinWindow[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    requestLog.set(key, withinWindow);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  withinWindow.push(now);
  requestLog.set(key, withinWindow);

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - withinWindow.length,
  };
}

/**
 * Best-effort client IP extraction behind Vercel's proxy layer.
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>, fallback?: string): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return fallback ?? "unknown";
}
