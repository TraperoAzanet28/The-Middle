# /api — Character Endpoints

Vercel Serverless Functions for The Middle Panel's three character endpoints:
`turtle`, `owl`, and `fox`.

These endpoints return **real character content**. They do **not** call a paid
model. Content is produced by the deterministic engine
(`api/_lib/deterministic.ts`) behind the `ModelProvider` seam, and every
response is checked by Tier 1 of the Character Integrity Supervisor before it
is returned. Enabling a live model is a separate, explicitly-approved step —
see **Cost safety** below.

## Endpoints

| Route         | Method | Character                      |
| ------------- | ------ | ------------------------------ |
| `/api/turtle` | POST   | Emotional regulation           |
| `/api/owl`    | POST   | Perception / clarity           |
| `/api/fox`    | POST   | Strategic action               |

All three share one implementation via `api/_lib/handler.ts`'s
`createCharacterHandler(character)` factory; only the character differs.
`OPTIONS` is supported for CORS preflight.

## Request body

```json
{
  "conflictDescription": "string, 1–4000 chars",
  "emotion": "angry | hurt | confused | frustrated | anxious | disappointed | sad | other",
  "intensity": "number, 0–10",
  "goal": "fix relationship | set boundary | get clarity | respond calmly | protect myself | decide whether to act | other",
  "urgency": "now | soon | can wait",

  "turns": [
    {
      "role": "user | character | system",
      "character": "turtle | owl | fox  (required when role is \"character\")",
      "content": "string, max 4000 chars",
      "timestamp": "ISO 8601 (repaired if missing or unparseable)"
    }
  ]
}
```

`turns` is **optional** and holds prior conversation history, oldest first.
These endpoints are stateless by design — there is no session store, so
nothing a user says about their conflict is retained server-side between
requests. The cost of that privacy property is that history is
caller-supplied and therefore untrusted, so it is validated as strictly as
the intake. At most 40 turns are accepted; `buildContext()` windows the
history further and summarises whatever it drops.

The `PanelInput` shape mirrors `src/types/panel.ts` but is **duplicated** in
`api/_lib/types.ts` rather than imported — `/api` must stay deployable
independently of the frontend build pipeline. If the frontend shape changes,
update the mirror by hand.

## Response (200)

```json
{
  "character": "turtle",
  "payload": {
    "acknowledgment": "…",
    "grounding": ["…"],
    "reflectivePrompt": "…?",
    "caution": "…"
  },
  "integrityReview": [
    {
      "tier": "tier1",
      "verdict": "pass",
      "violatedCriteria": [],
      "summary": "Tier 1 structural and lexical checks passed.",
      "reviewerModel": "tier1-heuristics/api"
    }
  ],
  "meta": {
    "model": "mock-deterministic",
    "latencyMs": 1,
    "stub": true,
    "fallback": false
  },
  "receivedAt": "2026-10-27T12:00:00.000Z"
}
```

`payload` is character-specific and mirrors
`PanelAnalysis['turtle' | 'owl' | 'fox']` in `src/types/panel.ts`, so the
existing `StageScreen` / `SummaryScreen` components can render it unchanged:

| Character | Payload fields                                      |
| --------- | --------------------------------------------------- |
| turtle    | `acknowledgment`, `grounding[]`, `reflectivePrompt`, `caution?` |
| owl       | `known[]`, `assumed[]`, `alternatives[]`, `reframes[]` |
| fox       | `options[]`, `recommendedId`, `reasoning`           |

### `meta` fields

| Field       | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `model`     | What produced the content, for audit trails                        |
| `latencyMs` | Wall-clock time for the generation step                            |
| `stub`      | `true` when no live model was involved. `true` for all traffic today |
| `fallback`  | `true` when the provider failed and the deterministic engine answered |

`meta.fallbackReason` exists internally but is **stripped before
serialisation** — it is diagnostic text that can name an upstream provider or
quote an internal error, so it is logged server-side only. `meta.fallback` is
the field to alert on: it means something broke.

## This endpoint does not return 5xx for model failure

`routeToCharacter()` does not throw. A provider timeout, outage, or malformed
response produces a deterministic payload instead of an error. The user
reaches this endpoint immediately after describing something painful, and an
error screen at that moment is the one outcome the app cannot afford. The
degradation is recorded in `meta.fallback` and logged; the user simply gets
an answer.

A 500 from these routes therefore indicates a programming error in the
request-handling path, not a model problem.

## Character Integrity Supervisor

Tier 1 (`api/_lib/tier1.ts`) runs **inline and synchronously** on every
payload before it is returned. It is deterministic, makes no model call, and
adds no measurable latency. It catches structural and lexical-pattern role
violations: the Turtle advising, the Owl asserting unhedged certainty, the
Fox using coercive framing, and clinical/diagnostic claims from any
character.

Two decisions the ADR left open are resolved here:

- **A Tier 1 violation annotates; it does not block.** Blocking would mean
  either a retry the user waits through or an error screen. A
  slightly-off response delivered warmly beats both. The verdict rides on the
  response so this can be revisited without restructuring anything.
- **Tier 2 does not run on the critical path.** It needs a second model call,
  roughly doubling latency and cost to catch a rare and mild failure.
  `integrityReview` is an array so a Tier 2 verdict can be appended
  out of band.

## Cost safety

Provider selection (`api/_lib/modelProvider.ts`) is **fail-closed**. A live
provider is used only when an operator sets **both**:

- `MODEL_PROVIDER=anthropic`, **and**
- `ANTHROPIC_API_KEY`

Having a key in the environment is not sufficient — keys often land in a
shared env for unrelated reasons, and "the deploy quietly started costing
money" is not an acceptable failure mode. Two independent signals are
required to spend.

`AnthropicModelProvider` is **deliberately unimplemented** and throws from its
constructor. Enabling paid API usage requires explicit owner approval, so a
misconfiguration is loud at startup rather than invisible in production. An
unrecognised `MODEL_PROVIDER` value degrades to the mock rather than to an
outage — a typo should cost nothing.

## Error responses

All errors return `{ "error": string, "code": string }` with no stack traces
or internal detail. Unexpected exceptions are logged server-side
(`console.error`) and surfaced only as a generic 500.

| Status | Code                 | When                                            |
| ------ | -------------------- | ----------------------------------------------- |
| 400    | `INVALID_INPUT`      | Body or `turns` fails validation                |
| 405    | `METHOD_NOT_ALLOWED` | Method other than `POST`/`OPTIONS`              |
| 413    | `PAYLOAD_TOO_LARGE`  | `Content-Length` exceeds 10 KB                  |
| 429    | `RATE_LIMITED`       | Client IP exceeded the rate limit (`Retry-After` set) |
| 500    | `INTERNAL_ERROR`     | Unexpected server-side error                    |

## Validation rules (`api/_lib/validate.ts`)

- Body must be a JSON object (not array/primitive/null).
- `conflictDescription`: non-empty string, trimmed, max 4000 chars.
- `emotion`, `goal`, `urgency`: must each be one of the fixed enum values.
- `intensity`: finite number in `[0, 10]`.
- `turns`: optional array, max 40 entries; each needs a valid `role` and a
  string `content` of at most 4000 chars; `role: "character"` additionally
  requires a valid `character`. An unparseable `timestamp` is repaired rather
  than rejected — it only orders a summary, so refusing a whole request over
  a clock formatting difference would be a poor trade.

## Rate limiting (`api/_lib/rateLimit.ts`)

An **in-memory sliding window** keyed by `${character}:${clientIp}`: max
**20 requests per 60-second window**, tracked in a `Map` with a naive cap on
tracked IPs to bound memory growth.

**This is not production-grade.** It lives in one function instance's memory,
resets on cold start, and does not coordinate across concurrent
instances/regions. It is a cheap guard against accidental abuse (a retry
loop), not an abuse-prevention system.

**Replace it with a durable shared store before enabling a paid model**, since
at that point every request costs money:

- **Vercel KV** (Redis-compatible), or
- **Upstash Redis** (serverless-friendly, free tier)

Both support atomic `INCR` + `EXPIRE`. Env vars are pre-documented (commented
out) in `.env.example`.

## CORS / security headers (`api/_lib/security.ts`)

- Same-origin requests (the normal case — the frontend calls `/api/turtle`
  with a relative path) need no CORS at all.
- In production (`VERCEL_ENV === "production"`),
  `Access-Control-Allow-Origin` is restricted to the deployment's own origin
  (derived from `Host`) plus anything in `ALLOWED_ORIGINS` (comma-separated).
- Outside production, common localhost origins (`:5173`, `:4173`) are allowed
  so local dev is not blocked.
- Every response also carries `X-Content-Type-Options: nosniff`,
  `Cache-Control: no-store`, `Referrer-Policy: no-referrer`.
- `OPTIONS` is answered with `204` and the CORS headers above, without
  reaching validation, the rate limiter, or the orchestrator.

## Environment variables

See `/.env.example` at the project root. **No real credentials exist in this
repo**; `.gitignore` excludes `.env` and `.env.*` but not `.env.example`.
`MODEL_PROVIDER` and `ANTHROPIC_API_KEY` are read only at call time via
`providerEnvFromProcess()`, never at module load.

## Tests

`npm test` compiles `api/` plus the test tree to CommonJS and runs Node's
built-in `node:test` runner — no test framework dependency (see the header of
`tsconfig.test.json` for why). Relevant suites:

| File                              | Covers                                                  |
| --------------------------------- | ------------------------------------------------------- |
| `test/characterEndpoint.test.ts`  | Full HTTP lifecycle in-process: headers, guards, validation, rate limiting, response shape |
| `test/reflectionOrchestrator.test.ts` | Context windowing, handoff, fail-closed provider selection, fallback and timeout behaviour |
| `test/characterIntegrity.test.ts` | Tier 1 checks, and that the deterministic engine passes them across the entire input space |

## Enabling a live model (requires approval)

Preconditions, in order:

1. **Owner approval** for recurring paid API usage.
2. Swap the in-memory rate limiter for a durable store — every request now
   costs money.
3. **Reject or namespace client-supplied `role: "system"` turns.** They are
   accepted today because no turn text reaches a model prompt; the moment one
   does, that field is a prompt-injection seam. See the note on
   `validateConversationTurns()`.
4. Implement `AnthropicModelProvider.generate()`: read `ANTHROPIC_API_KEY` at
   call time, make a non-streaming Messages call with forced tool use
   (`tool_choice: {type: "tool"}`) whose `input_schema` is
   `CharacterPayload<character>`, so the model is structurally unable to
   return unparseable prose.
5. Add character system prompts under `api/_lib/prompts/` — a **mirror** of
   `src/prompts/`, not an import (same boundary rule as `types.ts`).
6. Add budget metrics/alerting on `meta.fallback` and on spend.

Nothing else needs to change. The orchestrator, the handler, the integrity
checks, and the fallback path are already in place and tested against the
mock provider.
