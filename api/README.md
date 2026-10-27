# /api — Backend Scaffold (Phase 0)

This directory contains Vercel Serverless Functions for The Middle Panel's
three character endpoints: `turtle`, `owl`, and `fox`. **As of Phase 0, none
of these call a real AI model.** Every endpoint returns a clearly-labeled
stub response. This is infrastructure/scaffolding only.

## Endpoints

| Route          | Method | Purpose                                  |
| -------------- | ------ | ----------------------------------------- |
| `/api/turtle`  | POST   | Emotional regulation character (stub)     |
| `/api/owl`     | POST   | Clarity / perception character (stub)     |
| `/api/fox`     | POST   | Strategic action character (stub)         |

All three share identical behavior via `api/_lib/handler.ts`'s
`createCharacterHandler(character)` factory — only the `character` label in
the response differs. `OPTIONS` is supported for CORS preflight.

### Request body (`PanelInput`-shaped JSON)

```json
{
  "conflictDescription": "string, 1–4000 chars",
  "emotion": "angry | hurt | confused | frustrated | anxious | disappointed | sad | other",
  "intensity": "number, 0–10",
  "goal": "fix relationship | set boundary | get clarity | respond calmly | protect myself | decide whether to act | other",
  "urgency": "now | soon | can wait"
}
```

This mirrors `src/types/panel.ts`'s `PanelInput`, but the type is
**duplicated** in `api/_lib/types.ts` rather than imported — `/api` must stay
deployable independently of the frontend's build pipeline. If the frontend
shape changes, update the mirror manually.

### Example response (200)

```json
{
  "stub": true,
  "message": "Backend scaffold — real model integration pending Phase 1",
  "character": "turtle",
  "receivedAt": "2026-10-26T12:00:00.000Z",
  "echo": { "emotion": "anxious", "goal": "get clarity", "urgency": "soon", "intensity": 6 }
}
```

### Error responses

All errors return `{ "error": string, "code": string }` with no stack
traces or internal detail leaked to the client. Unexpected exceptions are
logged server-side (`console.error`) and surfaced to the client only as a
generic 500.

| Status | Code                 | When                                            |
| ------ | -------------------- | ------------------------------------------------ |
| 400    | `INVALID_INPUT`      | Body fails validation (see below)                |
| 405    | `METHOD_NOT_ALLOWED` | Method other than `POST`/`OPTIONS`               |
| 413    | `PAYLOAD_TOO_LARGE`  | `Content-Length` exceeds 10 KB                   |
| 429    | `RATE_LIMITED`       | Client IP exceeded the rate limit (`Retry-After` header set) |
| 500    | `INTERNAL_ERROR`     | Unexpected server-side error                     |

## Validation rules (`api/_lib/validate.ts`)

- Body must be a JSON object (not array/primitive/null).
- `conflictDescription`: non-empty string, trimmed, max 4000 chars.
- `emotion`: must be one of the fixed enum values.
- `intensity`: finite number in range `[0, 10]`.
- `goal`: must be one of the fixed enum values.
- `urgency`: must be one of `now | soon | can wait`.

Validation is shared across all three endpoints via one module, so the rules
stay consistent as new characters are added.

## Rate limiting (`api/_lib/rateLimit.ts`)

Phase 0 uses a simple **in-memory sliding window**, keyed by
`${character}:${clientIp}`: max **20 requests per 60-second window** per
character per IP, tracked in a `Map` with a naive cap on total tracked IPs to
bound memory growth.

**This is explicitly NOT production-grade.** It lives in a single function
instance's memory, so it resets on cold start and doesn't coordinate across
concurrent instances/regions. It's a cheap guard against accidental abuse
(e.g. a retry loop), not a real abuse-prevention system.

**Before Phase 1 ships with a real (paid) model behind these routes**,
replace this with a durable, shared store:
- **Vercel KV** (Redis-compatible), or
- **Upstash Redis** (serverless-friendly, has a free tier)

Both support atomic `INCR` + `EXPIRE`, which is what a correct distributed
rate limiter needs. Env vars for this are pre-documented (commented out) in
`.env.example`.

## CORS / security headers (`api/_lib/security.ts`)

- Same-origin requests (the normal case — frontend calls `/api/turtle` with a
  relative path) don't need CORS at all.
- In production (`VERCEL_ENV === "production"`), `Access-Control-Allow-Origin`
  is restricted to the deployment's own origin (derived from the `Host`
  header) plus any origins listed in `ALLOWED_ORIGINS` (comma-separated env
  var, e.g. for preview-deployment-to-preview-deployment calls).
- Outside production (local `vite dev`/`vite preview`), common localhost
  origins (`:5173`, `:4173`) are allowed so local dev isn't blocked.
- Additional headers set on every response: `X-Content-Type-Options: nosniff`,
  `Cache-Control: no-store`, `Referrer-Policy: no-referrer`.
- `OPTIONS` preflight requests are answered with `204` and the CORS headers
  above, without reaching validation/rate-limit/stub logic.

## Environment variables

See `/.env.example` at the project root. **No real credentials exist in this
repo.** `.gitignore` excludes `.env` and `.env.*` (but not `.env.example`).
None of the documented variables (`ANTHROPIC_API_KEY`, etc.) are read by any
code yet — Phase 0 never calls `process.env` for secrets.

## What's stubbed vs. real

| Piece                          | Status in Phase 0                          |
| ------------------------------- | ------------------------------------------- |
| Request routing (3 endpoints)   | Real                                        |
| Input validation                | Real                                        |
| Rate limiting                   | Real, but in-memory only (see caveats above) |
| CORS / security headers         | Real                                        |
| Error handling (no leaked info) | Real                                        |
| Model / character response      | **Stubbed** — static JSON, no LLM call      |

## Phase 1: wiring in a real model

When ready to connect a real model, the only file that needs a behavioral
change is **`api/_lib/handler.ts`** — specifically the block that currently
builds `stubResponse`. Suggested steps:

1. Add `@anthropic-ai/sdk` (or equivalent) to `package.json` dependencies.
2. Read `ANTHROPIC_API_KEY` from `process.env` (already documented in
   `.env.example`); fail fast with a 500 + server-side log if it's missing,
   never echo the key or error detail to the client.
3. Replace the `stubResponse` construction in `createCharacterHandler` with a
   call to the model, passing `validation.data` (the validated `PanelInput`)
   and a character-specific system prompt (there may be useful starting
   material in `src/prompts/middle-panel-core.ts` and the deterministic logic
   in `src/lib/panelEngine.ts` — read-only reference, not to be imported).
4. Keep the same response envelope shape for the frontend's sake, but set
   `stub: false` (or remove the field) once real output replaces it.
5. Swap the in-memory rate limiter for Vercel KV or Upstash Redis (env vars
   pre-documented in `.env.example`) before taking real traffic, since a real
   model call costs money per request.
6. Add request/response logging + basic metrics/alerting if budget-sensitive
   abuse is a concern.
