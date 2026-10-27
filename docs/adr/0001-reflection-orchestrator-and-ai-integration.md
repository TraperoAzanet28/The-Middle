# ADR 0001: The Reflection Orchestrator and AI Integration Approach

- **Status:** Proposed (design-only; no wiring, no live API calls, no deployment)
- **Date:** 2026-10-26
- **Scope:** `api/*` (Vercel Serverless Functions) and the not-yet-wired `api/_lib/orchestrator.ts`
- **Explicitly out of scope:** `src/lib/panelEngine.ts`, any React component, any live/paid model call, any deployment

## Context

The Middle Panel is a Vite + React + TypeScript app, statically deployed to Vercel, that walks a user through three characters — Turtle (emotional regulation), Owl (clarity/perception), Fox (strategic action) — to help them reflect before reacting in a conflict. Today, `src/lib/panelEngine.ts` is a **deterministic template engine**: given a `PanelInput`, it synthesizes a complete `PanelAnalysis` object (all three characters' output plus a summary card) purely from prompt-guide data and string templates — no network call, no model.

A previous phase ("Phase 0") built backend scaffolding at `/api`:

- `api/turtle.ts`, `api/owl.ts`, `api/fox.ts` — thin exports of a shared handler, one per character.
- `api/_lib/handler.ts` — orchestrates CORS → method check → rate limit → body-size check → validation → response. Currently returns a static stub: `{ stub: true, message: "...", character, receivedAt, echo }`.
- `api/_lib/validate.ts` — validates the request body against a mirrored `PanelInput` shape (emotion/goal/urgency enums, intensity 0–10, conflictDescription ≤ 4000 chars).
- `api/_lib/rateLimit.ts` — in-memory sliding window, 20 req/min per `character:IP`, explicitly documented as not production-durable (single-instance memory; recommends Vercel KV/Upstash before real traffic).
- `api/_lib/security.ts` — CORS allow-list (same-origin + `ALLOWED_ORIGINS`) and baseline security headers.
- `api/_lib/types.ts` — a deliberately **duplicated** mirror of `src/types/panel.ts`'s types, because `/api` must stay deployable independently of the frontend build (Vercel bundles each function in isolation).
- `.env.example` — documents `ANTHROPIC_API_KEY` (unused by any code today) and future durable rate-limit store credentials.

Separately, another team is building `src/lib/integritySupervisor/`: a two-tier evaluation framework that will police real AI-generated character responses once a model is wired in.

- **Tier 1** (`tier1Checks.ts`) — implemented, synchronous, no model call. Structural/lexical heuristics: imperative-mood detection, certainty-vs-hedge calibration, cross-turn epistemic consistency (Owl), alternative-sufficiency (Fox), emotional-consideration (Fox).
- **Tier 2** (`tier2Interface.ts`) — a typed contract (`Tier2Request` / `Tier2Response`) and a versioned prompt template (`TIER2_REVIEW_PROMPT_TEMPLATE`) for a future model-based semantic review. `runTier2Review()` is an explicit stub that throws. It takes `Tier1Result` as an input (not discarding Tier 1's findings) and returns a `verdict: "pass" | "violation"` plus per-criterion judgments.
- Both tiers score against a shared `rubric.ts` (1–5 scale per criterion, ≤2 = violation).
- The README explicitly leaves open "the combination policy" (does Tier 2 override Tier 1? does a violation require both tiers to agree?) as a product decision for whoever wires Tier 2 live.

The frontend contract that must keep working: `PanelAnalysis` (in `src/types/panel.ts`) is consumed by `src/components/StageScreen.tsx` (renders `.turtle`, `.owl`, `.fox` sub-shapes stage-by-stage with a cinematic reveal animation) and `src/components/SummaryScreen.tsx` (renders `.summaryCard` and `.fox.options`/`recommendedId`). Any real model integration must eventually be able to populate shapes structurally identical to `PanelAnalysis.turtle` / `.owl` / `.fox` — not a different, incompatible contract.

We need two decisions now, **before** any model is wired in:

1. How requests get routed to a single user-selected character, how conversational context is carried forward, and how a character can transparently offer (never force) a handoff to another character — all while leaving an explicit slot for Integrity Supervisor review in the pipeline.
2. Which model/SDK to use, what the real (non-stub) request/response contract per character endpoint looks like, how context window and history are managed, what happens when the model call fails or times out, and the latency/cost profile to expect.

## Decision

### 1. The Reflection Orchestrator

**Placement:** A new module, `api/_lib/orchestrator.ts`, sitting between `api/_lib/handler.ts` and the (future) model call. `handler.ts`'s existing pipeline (CORS → method → rate limit → body-size → validation) is unchanged; the orchestrator only replaces the final step — the `stubResponse` construction — with `await routeToCharacter(...)`.

**Single-character routing, never forced through all three.** The orchestrator's entry point, `routeToCharacter(request: RouteToCharacterRequest)`, takes an explicit `character: CharacterName` chosen by the caller (ultimately the user, via whichever character tab/stage the frontend is on) and routes to that character only. There is no "run all three and merge" path and no implicit sequencing — the orchestrator has no opinion about product flow (turtle → owl → fox vs. direct-to-one-character); it just answers "given this character, this input, and this context, produce one response." This mirrors how `api/turtle.ts` / `api/owl.ts` / `api/fox.ts` are already three independent endpoints, not one multiplexed endpoint — the orchestrator formalizes that independence rather than collapsing it.

**Context/history management.** `ConversationContext` (session-scoped: `activeCharacter`, the original `PanelInput`, and an ordered `turns: ConversationTurn[]`) is assembled by the pure function `buildContext(fullHistory, panelInput, activeCharacter, options)`. It is a **pure, model-free, synchronous function** — no I/O — so it is unit-testable today and does not require any model credentials to exercise. Phase 0's implementation is the identity function (returns full history unmodified); Phase 1 adds sliding-window trimming (`maxTurns`) and a token-budget cap (`maxContextTokens`), with an explicit seam (`summarizeOverflow`) for summarizing dropped turns into a synthetic system turn rather than silently truncating situational context. Keeping this as a pure function (rather than baking windowing logic into the model-call function) means the trimming *policy* can change without touching the network-call code path, and can be tested without touching the network at all.

**Deliberate, transparent handoffs.** A character's response may include a `handoffOffer: HandoffOffer` (`fromCharacter`, `toCharacter`, a character-authored `reason`, `offeredAt`). This is surfaced to the user by the frontend as a visible, dismissible offer — never auto-applied. The **only** function that changes `activeCharacter` is `recordHandoffDecision(context, offer, decision)`, which requires an explicit, non-optional `HandoffDecision` ("accepted" | "declined") — there is no code path in the orchestrator that switches characters without that explicit call. This directly satisfies "Owl offering a transition to Fox, with the user deciding": Owl's model call can produce a `handoffOffer` as part of its structured output, but turning it into an actual routing change always requires a second, explicit user action translated into a second API call.

**Integrity Supervisor integration point.** `CharacterResponse.integrityReview: IntegrityReviewSlot[]` is where Tier 1/Tier 2 verdicts plug in. The contract is a deliberate *mirror* (not an import) of `tier2Interface.ts`'s `Tier2Response` shape (`verdict`, `violatedCriteria`, `summary`, `reviewerModel`) plus a `tier` discriminant, for the same cross-boundary reason `api/_lib/types.ts` already mirrors `src/types/panel.ts` — `/api` must stay independently deployable from `src/`. The documented plug-in point is step 5–6 of `routeToCharacter`'s TODO: Tier 1 (cheap, synchronous, no model call) runs inline, before the response is ever returned to the client, and populates `integrityReview[0]`; Tier 2 (model-based) is explicitly left as an open question (see below) as to whether it blocks the response or runs best-effort/async after the client already has it. The response envelope's `integrityReview` is an **array**, not a single required field, specifically so that a response can be returned with only a Tier 1 verdict present and a Tier 2 verdict appended/attached later without changing the type.

### 2. AI integration approach

**Model/SDK: Anthropic's Claude API via `@anthropic-ai/sdk`.** Justification:

- `.env.example` already documents `ANTHROPIC_API_KEY` and an `ANTHROPIC_MODEL` override (defaulting to `claude-sonnet-4-5`) — this is the path the Phase 0 scaffolding was already built against, and `api/README.md`'s own Phase 1 plan names `@anthropic-ai/sdk` explicitly. Adopting it avoids re-deciding something already load-bearing in the committed scaffolding.
- Claude's Messages API supports **forced tool use** (`tool_choice: { type: "tool", name: ... }`) with a JSON Schema `input_schema`. This lets us force the model to return a structurally valid `TurtlePayload` / `OwlPayload` / `FoxPayload` object directly — no free-text parsing, no regex extraction, no "hope the model emits valid JSON" risk. This is a better fit for this app than, say, OpenAI's function-calling (comparable capability, but would mean discarding the `.env.example`/`ANTHROPIC_*` groundwork already laid) or a non-structured completion API (would require a fragile parsing layer).
- Three short, independent per-character calls (not one large multi-character call) keep each request small, keep the per-character system prompt focused (one persona, one rubric, one job), and compose naturally with the existing one-endpoint-per-character structure and the Integrity Supervisor's per-character rubric design.

**Request/response contract per endpoint.** The validated `PanelInput` (already produced by `validate.ts`) plus the assembled `ConversationContext` (from `buildContext`) are passed to `routeToCharacter({ character, input, context })`. Internally (Phase 1, not yet implemented):

1. Build a character-specific system prompt (candidate source material: `src/prompts/*.ts`, read-only reference — mirrored into `api/_lib/prompts/` if reused, not imported, per the established cross-boundary rule).
2. Call `client.messages.create(...)` **non-streaming**, with `tool_choice` forcing the shape of `CharacterPayload<character>`.
3. Parse the forced tool-call input directly into the typed payload — no secondary validation-by-guessing needed beyond a schema check, since the tool call itself is schema-constrained.
4. Wrap the result in `CharacterResponse`: `{ character, payload, handoffOffer?, integrityReview, meta }`.

**Streaming vs. non-streaming — decision: non-streaming.** The cinematic UI (`StageScreen.tsx`) already reveals a character's output in discrete, pre-defined steps (e.g. Turtle: caution → acknowledgment → grounding → reflect) driven by array/field boundaries in `PanelAnalysis`, not by raw token-by-token text arriving. Token streaming would only be useful if the UI rendered a single long free-text block growing in place, which it does not. A single non-streaming call that returns the complete structured payload is simpler (no SSE/chunked-response handling inside a serverless function), fits comfortably inside Vercel's function timeout for the expected payload sizes, and avoids a whole class of partial-JSON/partial-tool-call edge cases. If future product work moves to a long-form free-text chat view, streaming can be revisited as a targeted, additive change to a specific endpoint — not a reason to streaming-ify the whole system now.

**Context-window / history management.** See `buildContext()` above. The hard rule going forward: the original `PanelInput` (the user's structured intake) is **always** sent in full, every call — it's small (≤ ~4 KB) and is the ground truth for the session. Only *conversation history beyond the intake* is subject to windowing/summarization. A fixed `maxTurns` sliding window is the Phase 1 starting point (simple, predictable cost); token-aware trimming and overflow summarization are called out as a documented TODO rather than built speculatively, because the real token economics depend on observed conversation lengths Phase 0 has no data for yet.

**Error handling and graceful fallback — never crash the cinematic UI.** On any model-call failure (timeout, 5xx, network error, malformed/missing tool-call output, rate-limit from the provider), `routeToCharacter` must **not** propagate an unhandled rejection to `handler.ts`. Instead (Phase 1 TODO, explicitly called out in `orchestrator.ts`): catch the failure and return a `CharacterResponse` built from `panelEngine.ts`-equivalent deterministic logic for that one character (read-only reference, not imported — `panelEngine.ts` itself is never modified and the fallback reuses its *approach*, not its code, to stay decoupled) with `meta.stub` left `true` and a `meta.model` value indicating fallback was used. This guarantees the frontend always receives a shape it already knows how to render, even during a provider outage — the user experiences "the deterministic version of this character's wisdom" rather than an error screen. A request-level timeout (shorter than Vercel's function timeout, so there's always headroom to construct and return the fallback) wraps the model call.

**Latency/cost considerations.** Each character call is a short, single-turn-plus-history request constrained to a small structured-output schema — expected to be a low-token request (system prompt + intake + windowed history) and a small structured response (a few hundred tokens at most, given `PanelAnalysis` sub-shapes are short arrays/strings, not essays). Running Tier 1 integrity checks inline costs no extra model call (pure heuristics). Running Tier 2 inline would roughly **double** per-request latency and cost (a second model call per character response) — this tradeoff is deliberately left as an Open Question below rather than pre-decided, since it depends on the Supervisor team's tolerance for async/eventually-consistent review versus the product's tolerance for added latency.

## Alternatives Considered

| Option | Why not chosen (for now) |
|---|---|
| **Single orchestrator endpoint** that always runs all three characters per request | Directly contradicts the requirement that a user who picked one character is never forced through all three; also triples cost/latency per request regardless of what the user asked for. |
| **OpenAI API / function calling** instead of Anthropic | Comparable structured-output capability, but ignores the `.env.example` / `api/README.md` groundwork already committed to Anthropic; would require re-documenting env vars and the Phase 1 plan for no clear benefit. |
| **Streaming (SSE) responses** from the character endpoints | The current UI reveals structured fields stage-by-stage, not a growing free-text block — streaming adds serverless complexity (chunked responses, partial-JSON handling) without a UI that benefits from it today. Revisit if a free-text chat view is added later. |
| **Baking Tier 1/Tier 2 calls directly into `handler.ts`** rather than routing through the orchestrator | Would couple request-lifecycle plumbing (CORS/rate-limit/validation) to model-call and integrity-review concerns in one file, making it harder to unit-test `buildContext`/`routeToCharacter` independent of the HTTP layer, and harder for the Supervisor team to iterate on their contract without touching request-handling code. |
| **Importing `src/lib/integritySupervisor/*` and `src/types/panel.ts` directly into `/api`** | Breaks the independent-deployability guarantee `api/_lib/types.ts` already establishes (Vercel bundles each function in isolation; cross-boundary imports couple the serverless bundle to frontend build tooling). Mirroring, with an explicit "keep in sync manually" comment, is the established pattern in this codebase and is followed here rather than invented. |
| **Durable rate limiting (Vercel KV / Upstash) as part of this ADR** | Already identified and documented in `api/_lib/rateLimit.ts` and `api/README.md` as a pre-Phase-1 prerequisite; restated here as a dependency, not re-litigated, since it's an orthogonal infra decision already made. |
| **Summarization-by-default for all history** | Adds an extra model call (or a second cheaper model call) purely for context compression before every character call, which is its own cost/latency/fidelity tradeoff. Starting with a simple sliding window and only summarizing on overflow is a smaller, more auditable first step. |

## Consequences

**Positive:**
- `handler.ts`'s eventual Phase 1 change is a one-call swap (`stubResponse` → `await routeToCharacter(...)`), exactly matching `api/README.md`'s existing documented plan — this ADR doesn't invalidate prior scaffolding decisions, it completes them.
- `CharacterPayload<C>` mirroring `PanelAnalysis.turtle`/`.owl`/`.fox` means `StageScreen.tsx`/`SummaryScreen.tsx` require **no changes** when a real model response eventually replaces deterministic/stub output — satisfying the hard constraint against touching components, by design rather than by restraint alone.
- The handoff mechanism makes character transitions auditable and user-controlled by construction (`recordHandoffDecision` requires an explicit decision), which should make the Integrity Supervisor's "genuine overlap vs. violation" judgment easier to reason about at the orchestration layer, not just within a single response.
- `buildContext` and `recordHandoffDecision` being pure functions means core orchestration logic is unit-testable without any model credentials or network access, consistent with how `tier1Checks.ts` and `validate.ts` are already tested in this codebase.

**Negative / costs:**
- Running three independent character endpoints (rather than one shared "panel" call) means three separate system prompts, three separate fallback paths, and three separate integrity-review passes to maintain — more moving parts than a monolithic call, in exchange for the single-character-only requirement.
- The fallback-to-deterministic-logic path means `panelEngine.ts`'s *approach* now has two independent implementations in spirit (the frontend's existing deterministic engine, and a server-side fallback) even though neither imports the other — a deliberate decoupling tradeoff, but one that creates a "keep these conceptually in sync" maintenance burden similar to the existing `types.ts` mirror.
- Deferring the Tier 1/Tier 2 combination policy (see Open Questions) means `routeToCharacter`'s integrity-blocking behavior is not yet fully specified — Phase 1 cannot be fully implemented until that product decision is made.

## Open Questions

1. **Tier 1/Tier 2 combination policy.** Does a Tier 1 violation alone trigger a regeneration attempt, or only return the response annotated? Does Tier 2 override Tier 1 on disagreement, or does a violation require both tiers to agree? (Explicitly left open by `tier2Interface.ts`'s own README — this ADR does not resolve it, only confirms where in the orchestrator it would be enforced.)
2. **Tier 2 synchronicity.** Does Tier 2 run inline (blocking the response, ~2x latency/cost) or asynchronously/best-effort after the response is already sent (requires a follow-up delivery mechanism — webhook, polling, or just server-side logging for audit without blocking UX)?
3. **Regeneration budget.** If a response is regenerated after a Tier 1/Tier 2 violation, how many attempts before falling back to the deterministic path, and does a regenerated response get re-reviewed?
4. **History persistence.** `ConversationContext.turns` is currently caller-supplied per request (stateless function signature) — is history persisted server-side (durable store, same KV/Redis candidate as rate limiting) or is the frontend the source of truth, replaying history on every call? This affects both `buildContext`'s token-budget math and basic session-resumption behavior.
5. **Handoff UX contract.** What exact frontend affordance renders a `handoffOffer` (a dismissible card? a suggested-next-step button?) — this ADR fixes the data contract but not the UI, which is explicitly out of scope here.
6. **Fallback transparency.** Should the frontend ever indicate to the user that a response came from the deterministic fallback rather than the model (even subtly), or should that distinction be invisible by design? `meta.stub`/`meta.model` carry the information either way; this is a product/UX decision, not an engineering one.
