/**
 * CORS + baseline security headers for the /api/* endpoints.
 *
 * Origin policy:
 *  - In production (VERCEL_ENV === "production"), only the deployment's own
 *    origin (derived from the request's Host header) plus any origins listed
 *    in the optional ALLOWED_ORIGINS env var (comma-separated) are allowed.
 *    Since the frontend calls these endpoints with relative paths
 *    (e.g. `fetch("/api/turtle")`), same-origin requests don't even need
 *    CORS headers — this mainly guards against being embedded/called from
 *    other sites.
 *  - In any non-production environment (local dev, preview deployments),
 *    common local dev origins are allowed to keep `vite dev` / `vite preview`
 *    workable without extra config.
 */

import type { ApiRequest, ApiResponse } from "./types.js";

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function getAllowedOrigin(req: ApiRequest): string | null {
  const origin = req.headers.origin;
  const originStr = Array.isArray(origin) ? origin[0] : origin;
  if (!originStr) return null;

  const isProduction = process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    if (DEV_ORIGINS.includes(originStr)) return originStr;
    // Also allow same-origin preview/dev requests whose Origin matches Host.
  }

  const host = req.headers.host;
  const hostStr = Array.isArray(host) ? host[0] : host;
  const selfOrigins = hostStr ? [`https://${hostStr}`, `http://${hostStr}`] : [];

  const extraAllowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowList = [...selfOrigins, ...extraAllowed, ...(isProduction ? [] : DEV_ORIGINS)];

  return allowList.includes(originStr) ? originStr : null;
}

/**
 * Applies CORS + security headers. Returns true if the request was an OPTIONS
 * preflight that this function has already fully handled (caller should
 * return immediately without further processing).
 */
export function applySecurityHeaders(req: ApiRequest, res: ApiResponse): boolean {
  const allowedOrigin = getAllowedOrigin(req);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  // Defense-in-depth: this API is JSON-only, same-origin by design.
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}
