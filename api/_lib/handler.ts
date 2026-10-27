/**
 * Shared handler factory for the three character stub endpoints.
 *
 * Request lifecycle:
 *   1. Apply CORS/security headers (short-circuits on OPTIONS preflight).
 *   2. Reject non-POST methods (405).
 *   3. Rate limit by client IP (429 + Retry-After on breach).
 *   4. Reject oversized bodies via Content-Length (413).
 *   5. Validate the body shape against PanelInput rules (400 on failure).
 *   6. Return a clearly-labeled stub response (200).
 *
 * All steps are wrapped in try/catch; unexpected errors are logged
 * server-side only and the client receives a generic 500 with no stack
 * trace or internal detail.
 */

import { getClientIp, checkRateLimit } from "./rateLimit.js";
import { applySecurityHeaders } from "./security.js";
import { validatePanelInput } from "./validate.js";
import type { ApiHandler, ApiRequest, ApiResponse, CharacterName, StubResponse } from "./types.js";

// Hard cap on request body size (bytes), checked via Content-Length before
// any JSON parsing happens. 10 KB is generous for this payload shape
// (PanelInput is a short form, not file uploads) and protects both the
// in-memory rate limiter and any future paid model call from abuse.
const MAX_BODY_BYTES = 10_000;

function sendError(res: ApiResponse, statusCode: number, code: string, error: string): void {
  res.status(statusCode).json({ error, code });
}

export function createCharacterHandler(character: CharacterName): ApiHandler {
  return async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    try {
      const isPreflight = applySecurityHeaders(req, res);
      if (isPreflight) return;

      if (req.method !== "POST") {
        res.setHeader("Allow", "POST, OPTIONS");
        sendError(res, 405, "METHOD_NOT_ALLOWED", "Only POST is supported on this endpoint.");
        return;
      }

      const ip = getClientIp(req.headers, req.socket?.remoteAddress);
      const rateLimit = checkRateLimit(`${character}:${ip}`);
      if (!rateLimit.allowed) {
        res.setHeader("Retry-After", String(Math.ceil((rateLimit.retryAfterMs ?? 60_000) / 1000)));
        sendError(res, 429, "RATE_LIMITED", "Too many requests. Please slow down and try again shortly.");
        return;
      }

      const contentLengthHeader = req.headers["content-length"];
      const contentLength = Array.isArray(contentLengthHeader)
        ? Number(contentLengthHeader[0])
        : Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body exceeds the maximum allowed size.");
        return;
      }

      const validation = validatePanelInput(req.body);
      if (!validation.valid) {
        sendError(res, 400, "INVALID_INPUT", validation.reason);
        return;
      }

      const { emotion, goal, urgency, intensity } = validation.data;

      const stubResponse: StubResponse = {
        stub: true,
        message: "Backend scaffold — real model integration pending Phase 1",
        character,
        receivedAt: new Date().toISOString(),
        echo: { emotion, goal, urgency, intensity },
      };

      res.status(200).json(stubResponse);
    } catch (err) {
      // Never leak stack traces or internal error detail to the client.
      // eslint-disable-next-line no-console
      console.error(`[api/${character}] unhandled error:`, err);
      if (!res.getHeader?.("Content-Type")) {
        sendError(res, 500, "INTERNAL_ERROR", "Something went wrong processing your request.");
      }
    }
  };
}
