/**
 * orchestrator.ts — "The Reflection Orchestrator"
 *
 * Phase 1 design surface. This module fixes the TypeScript contract that
 * will sit between the three character endpoints (api/turtle.ts, api/owl.ts,
 * api/fox.ts) and a real model call, plus the slot where the Character
 * Integrity Supervisor (src/lib/integritySupervisor/) plugs in.
 *
 * Full rationale: /docs/adr/0001-reflection-orchestrator-and-ai-integration.md
 *
 * STATUS — NOT WIRED:
 *   - Nothing in this file is imported by handler.ts, turtle.ts, owl.ts, or
 *     fox.ts. Wiring it in is a deliberate, separate, later step.
 *   - Nothing in this file makes a network call, reads ANTHROPIC_API_KEY, or
 *     touches process.env. `routeToCharacter()` throws by design.
 *   - This file has zero runtime dependencies beyond ./types.js, so it is
 *     safe to import/typecheck in isolation (see build verification in the
 *     ADR).
 *
 * Cross-boundary note: like api/_lib/types.ts, this file intentionally
 * DUPLICATES shapes that also live in src/ (PanelAnalysis sub-types in
 * src/types/panel.ts; the Supervisor's Tier1Result/Tier2Response shapes in
 * src/lib/integritySupervisor/) rather than importing them, so /api stays
 * deployable independently of the frontend build pipeline. Keep these
 * mirrors in sync by hand if the source shapes change.
 */

import type { CharacterName, PanelInput } from "./types.js";

// ─── Conversation context ──────────────────────────────────────────────────

export type ConversationRole = "user" | "character" | "system";

export interface ConversationTurn {
  role: ConversationRole;
  /** Set when role === "character"; identifies which character spoke. */
  character?: CharacterName;
  content: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

export interface ConversationContext {
  /** The character currently driving the conversation. Never more than one. */
  activeCharacter: CharacterName;
  /** The original structured intake. Always retained verbatim, never trimmed. */
  panelInput: PanelInput;
  /** Prior turns, oldest first. May be windowed/summarized by buildContext(). */
  turns: ConversationTurn[];
  /** Set once a handoff has been offered AND accepted by the user; absent otherwise. */
  priorCharacter?: CharacterName;
}

export interface BuildContextOptions {
  /** Hard cap on turns retained verbatim (sliding window). */
  maxTurns?: number;
  /** Soft cap on estimated tokens across retained turns, before the model call. */
  maxContextTokens?: number;
  /**
   * TODO(Phase 1): when windowed history would exceed maxContextTokens,
   * summarize the DROPPED turns into a single synthetic "system" turn
   * instead of hard-truncating (e.g. "User earlier described feeling
   * betrayed by a friend who cancelled plans twice."), so a character
   * doesn't lose situational continuity across a long session. Phase 0 has
   * no summarizer; this flag only documents the intended seam.
   */
  summarizeOverflow?: boolean;
}

/**
 * buildContext
 *
 * Deterministic, model-free context assembly: takes the full turn history
 * for a session and returns the slice/shape that should actually be sent to
 * the model on the next call. Pure function — no I/O, no network call, safe
 * to unit test today without any model credentials.
 *
 * TODO(Phase 1): implement sliding-window trim by `maxTurns`, a token-count
 * estimate against `maxContextTokens`, and optional overflow summarization.
 * Phase 0 returns the full history unmodified (identity behavior) so the
 * function signature is fixed and callable without committing to a trimming
 * strategy yet.
 */
export function buildContext(
  fullHistory: ConversationTurn[],
  panelInput: PanelInput,
  activeCharacter: CharacterName,
  _options: BuildContextOptions = {},
): ConversationContext {
  // TODO(Phase 1): apply maxTurns / maxContextTokens windowing here, and
  // overflow summarization when summarizeOverflow is set. See ADR
  // "Context-window / history management strategy".
  return {
    activeCharacter,
    panelInput,
    turns: fullHistory,
  };
}

// ─── Integrity Supervisor slot ─────────────────────────────────────────────
//
// Mirrors (does NOT import) the contract in
// src/lib/integritySupervisor/tier2Interface.ts and rubric.ts.

export type IntegrityVerdict = "pass" | "violation" | "not_reviewed";

export interface IntegrityReviewSlot {
  /** Which tier produced this verdict. "tier2" entries may be absent pre-Phase-2. */
  tier: "tier1" | "tier2";
  verdict: IntegrityVerdict;
  /** Rubric criterion ids that scored a violation, if any — mirrors Tier2Response.violatedCriteria. */
  violatedCriteria?: string[];
  /** Human-scannable summary — mirrors Tier2Response.summary. */
  summary?: string;
  /** Model/version id for audit trails — mirrors Tier2Response.reviewerModel. */
  reviewerModel?: string;
}

// ─── Character response payloads ───────────────────────────────────────────
//
// Structurally mirror PanelAnalysis['turtle' | 'owl' | 'fox'] in
// src/types/panel.ts so that, once wired, a real response can be rendered by
// StageScreen.tsx / SummaryScreen.tsx with zero component changes.

export interface TurtlePayload {
  acknowledgment: string;
  grounding: string[];
  reflectivePrompt: string;
  caution?: string;
}

export interface OwlPayload {
  known: string[];
  assumed: string[];
  alternatives: string[];
  reframes: string[];
}

export interface StrategyOptionPayload {
  id: string;
  title: string;
  timing: "Act now" | "Act soon" | "Wait";
  description: string;
  likelyOutcome: string;
  strength: string;
}

export interface FoxPayload {
  options: StrategyOptionPayload[];
  recommendedId: string;
  reasoning: string;
}

export type CharacterPayload<C extends CharacterName> = C extends "turtle"
  ? TurtlePayload
  : C extends "owl"
    ? OwlPayload
    : FoxPayload;

// ─── Handoff ────────────────────────────────────────────────────────────────

export interface HandoffOffer {
  fromCharacter: CharacterName;
  toCharacter: CharacterName;
  /** Character-authored, user-facing reason. Never silently auto-triggered. */
  reason: string;
  offeredAt: string;
}

export type HandoffDecision = "accepted" | "declined";

/**
 * recordHandoffDecision
 *
 * Pure function: given a pending HandoffOffer and the user's explicit
 * choice, returns the resulting ConversationContext. This is the ONLY place
 * a character change takes effect — the orchestrator never switches
 * characters on its own. A HandoffOffer is always a suggestion surfaced to
 * the user via the frontend; the user's decision is the only valid input
 * here, which is why `decision` is a required, non-optional parameter.
 */
export function recordHandoffDecision(
  context: ConversationContext,
  offer: HandoffOffer,
  decision: HandoffDecision,
): ConversationContext {
  if (decision === "declined") {
    return context;
  }
  return {
    ...context,
    activeCharacter: offer.toCharacter,
    priorCharacter: offer.fromCharacter,
  };
}

// ─── Character response envelope ───────────────────────────────────────────

export interface ModelCallMeta {
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  /** True while Phase 1 has not replaced the stub. Always true today. */
  stub: boolean;
}

export interface CharacterResponse<C extends CharacterName = CharacterName> {
  character: C;
  payload: CharacterPayload<C>;
  /** Present only when the character is deliberately offering a transition. */
  handoffOffer?: HandoffOffer;
  /**
   * Integrity Supervisor verdict slot(s). Tier 1 (cheap, synchronous,
   * src/lib/integritySupervisor/tier1Checks.ts logic) SHOULD be populated
   * inline before a response ever reaches the client. Tier 2 (model-based,
   * tier2Interface.ts) is expected to run out-of-band per the ADR's Open
   * Questions, and may arrive later or not at all for a given response —
   * hence an array rather than a single required field.
   */
  integrityReview: IntegrityReviewSlot[];
  meta: ModelCallMeta;
}

// ─── Routing ────────────────────────────────────────────────────────────────

export interface RouteToCharacterRequest {
  character: CharacterName;
  input: PanelInput;
  context: ConversationContext;
}

/**
 * routeToCharacter
 *
 * The single entry point a future handler.ts would call once wiring is
 * explicitly approved. Phase 0 behavior: throws, unconditionally. Written
 * now so that:
 *   (a) handler.ts's eventual change is a one-call swap — replace the
 *       `stubResponse` construction with `await routeToCharacter(...)`,
 *       matching api/README.md's documented Phase 1 plan — and
 *   (b) the request/response shape is fixed, typed, and reviewable before
 *       any model credentials are read or any network call is made.
 *
 * TODO(Phase 1), in order:
 *   1. Read ANTHROPIC_API_KEY from process.env inside this function (not at
 *      module load time, so this file can still be imported/typechecked
 *      with no env configured). Fail fast with a generic, no-detail error
 *      if missing — never echo key/config state to the client.
 *   2. Select the character-specific system prompt. Candidate starting
 *      material: src/prompts/*.ts (read-only reference — do not import
 *      cross-boundary; copy/adapt into an api/_lib/prompts/ mirror if
 *      reused, same pattern as types.ts).
 *   3. Call @anthropic-ai/sdk's Messages API, non-streaming, with a forced
 *      tool-use call whose input_schema matches CharacterPayload<character>
 *      — the model is structurally forced to return a parseable payload,
 *      no free-text regex extraction required.
 *   4. Wrap the call in the timeout + retry policy from the ADR
 *      ("Error handling and graceful fallback"). On ANY failure
 *      (timeout, 5xx, malformed tool-call output), return a
 *      deterministically-derived fallback CharacterResponse instead of
 *      throwing, so the cinematic UI never sees an unhandled rejection.
 *      (panelEngine.ts is read-only reference for this fallback logic —
 *      do not import it; its output shape already matches CharacterPayload.)
 *   5. Run Tier 1 integrity checks against the generated payload before
 *      returning; populate `integrityReview[0]` with the result (mirror the
 *      tier1Checks.ts logic locally — do not import across the src//api
 *      boundary).
 *   6. Decide, per the ADR's Open Questions, whether a Tier 1 violation
 *      blocks the response (triggers a regeneration attempt) or is returned
 *      with an annotation; decide separately whether Tier 2 runs
 *      synchronously (adds latency, higher confidence) or async/best-effort
 *      after the response is already sent to the client.
 */
export async function routeToCharacter(
  _request: RouteToCharacterRequest,
): Promise<CharacterResponse> {
  throw new Error(
    "routeToCharacter is not yet wired to a live model (Phase 1). See " +
      "docs/adr/0001-reflection-orchestrator-and-ai-integration.md and the " +
      "TODO(Phase 1) comments above this function.",
  );
}
