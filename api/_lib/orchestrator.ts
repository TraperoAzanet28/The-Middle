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
 * STATUS — IMPLEMENTED, NOT YET CALLED BY THE HTTP LAYER:
 *   - `routeToCharacter()` is fully implemented and returns real content on
 *     every path, including every failure path. It no longer throws.
 *   - handler.ts / turtle.ts / owl.ts / fox.ts do not call it yet. Wiring the
 *     HTTP layer is a deliberate, separate step.
 *   - No network call happens by default. The provider seam reads the
 *     environment via selectProvider(), which is fail-closed: it returns the
 *     mock unless an operator sets BOTH MODEL_PROVIDER=anthropic AND
 *     ANTHROPIC_API_KEY, and the live provider is unimplemented on purpose
 *     because enabling it begins paid usage. Importing this module cannot
 *     start spend.
 *
 * Cross-boundary note: like api/_lib/types.ts, this file intentionally
 * DUPLICATES shapes that also live in src/ (PanelAnalysis sub-types in
 * src/types/panel.ts; the Supervisor's Tier1Result/Tier2Response shapes in
 * src/lib/integritySupervisor/) rather than importing them, so /api stays
 * deployable independently of the frontend build pipeline. Keep these
 * mirrors in sync by hand if the source shapes change.
 */

import type { CharacterName, PanelInput } from "./types.js";
import type { ModelProvider } from "./modelProvider.js";
import { providerEnvFromProcess, selectProvider } from "./modelProvider.js";
import { buildDeterministicPayload } from "./deterministic.js";
import { runTier1, toReviewSlot } from "./tier1.js";

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

/**
 * Default sliding-window size.
 *
 * Twelve turns is roughly six exchanges — enough for a character to stay
 * oriented without the context growing without bound across a long session.
 */
export const DEFAULT_MAX_TURNS = 12;

/**
 * Default soft token budget for retained history.
 *
 * Well under any model's context limit on purpose. The binding constraint
 * here is cost and latency per call, not the window size.
 */
export const DEFAULT_MAX_CONTEXT_TOKENS = 3000;

export interface BuildContextOptions {
  /** Hard cap on turns retained verbatim (sliding window). */
  maxTurns?: number;
  /** Soft cap on estimated tokens across retained turns, before the model call. */
  maxContextTokens?: number;
  /**
   * When history overflows the window, compress the DROPPED turns into one
   * synthetic "system" turn rather than hard-truncating, so a character does
   * not lose situational continuity across a long session. On by default.
   * The summary is extractive, not model-generated — see
   * summarizeDroppedTurns().
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
 * Trimming happens in two passes, in this order: a sliding window by
 * `maxTurns`, then a token-estimate pass against `maxContextTokens` that
 * drops from the front until the budget is met. Whatever both passes discard
 * is summarized into a single synthetic turn unless `summarizeOverflow` is
 * disabled.
 */
export function buildContext(
  fullHistory: ConversationTurn[],
  panelInput: PanelInput,
  activeCharacter: CharacterName,
  options: BuildContextOptions = {},
): ConversationContext {
  const {
    maxTurns = DEFAULT_MAX_TURNS,
    maxContextTokens = DEFAULT_MAX_CONTEXT_TOKENS,
    summarizeOverflow = true,
  } = options;

  // Newest turns matter most: recency carries the thread of the conversation,
  // and panelInput (retained separately and never trimmed) already preserves
  // the situation that started it. So the window is taken from the end.
  const windowed = maxTurns > 0 ? fullHistory.slice(-maxTurns) : [];
  let dropped = fullHistory.slice(0, fullHistory.length - windowed.length);

  // Then tighten further if the retained turns are still too large. Dropping
  // from the front keeps the window contiguous and adjacent to the present.
  const kept = [...windowed];
  while (kept.length > 1 && estimateTokens(kept) > maxContextTokens) {
    dropped = [...dropped, kept.shift() as ConversationTurn];
  }

  if (dropped.length === 0) {
    return { activeCharacter, panelInput, turns: kept };
  }

  if (!summarizeOverflow) {
    return { activeCharacter, panelInput, turns: kept };
  }

  // Hard truncation would make a character appear to forget something the
  // user plainly said, which reads as inattention — damaging in an app built
  // on being listened to. A synthetic system turn preserves continuity at a
  // fraction of the tokens. This is extractive, not model-generated: it must
  // stay free of network calls so buildContext remains pure and testable.
  return {
    activeCharacter,
    panelInput,
    turns: [summarizeDroppedTurns(dropped), ...kept],
  };
}

/**
 * Rough token estimate for a set of turns.
 *
 * Intentionally crude — roughly four characters per token, the usual
 * rule of thumb for English. An exact count needs the provider's tokenizer,
 * which would mean a dependency and a network-shaped API inside what is
 * meant to be a pure function. Budgeting is approximate anyway; the cost of
 * being slightly conservative is a few dropped turns, not a failure.
 */
export function estimateTokens(turns: ConversationTurn[]): number {
  let characters = 0;
  for (const turn of turns) {
    // +16 approximates per-message role/formatting overhead.
    characters += turn.content.length + 16;
  }
  return Math.ceil(characters / 4);
}

/**
 * Compress dropped turns into one synthetic "system" turn.
 *
 * Extractive and deterministic: it records who spoke and the opening of what
 * they said, rather than paraphrasing. A paraphrase generated without a model
 * would risk inventing content and putting words in the user's mouth, which
 * is a worse failure than a terse summary.
 */
function summarizeDroppedTurns(dropped: ConversationTurn[]): ConversationTurn {
  const userTurns = dropped.filter((t) => t.role === "user");
  const characterTurns = dropped.filter((t) => t.role === "character");

  const fragments: string[] = [];
  if (userTurns.length > 0) {
    const excerpts = userTurns.slice(-2).map((t) => `"${excerpt(t.content)}"`);
    fragments.push(
      `Earlier in this session the user said ${excerpts.join(" and then ")}.`,
    );
  }
  if (characterTurns.length > 0) {
    const who = [...new Set(characterTurns.map((t) => t.character).filter(Boolean))];
    if (who.length > 0) {
      fragments.push(`${who.join(" and ")} has already responded.`);
    }
  }
  fragments.push(`(${dropped.length} earlier turns omitted for length.)`);

  return {
    role: "system",
    content: fragments.join(" "),
    // Anchor the summary to the last moment it covers, so the synthetic turn
    // still sorts correctly against the turns that follow it.
    timestamp: dropped[dropped.length - 1]?.timestamp ?? new Date().toISOString(),
  };
}

function excerpt(text: string, max = 100): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
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
  /**
   * True when no live model produced this content — the mock provider or the
   * deterministic fallback did. True for every response today, and expected
   * to stay true until a live provider is explicitly approved and enabled.
   */
  stub: boolean;
  /**
   * True when the provider failed and the deterministic engine answered
   * instead. Distinct from `stub`: a mock response is a stub but not a
   * fallback. This is the field to alert on — it means something broke.
   */
  fallback: boolean;
  /**
   * Why the provider call failed. Server-side diagnostics only; it can name a
   * provider or a timeout and must never be rendered to the user.
   */
  fallbackReason?: string;
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

/** Default abort budget for a single model call. */
export const DEFAULT_MODEL_TIMEOUT_MS = 12_000;

/** How many times a failed call is retried before falling back. */
export const DEFAULT_MAX_ATTEMPTS = 2;

export interface RouteOptions {
  /**
   * Provider to generate with. Defaults to whatever selectProvider() picks
   * from the environment, which is the mock unless an operator has
   * explicitly opted into a paid provider.
   */
  provider?: ModelProvider;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Injectable clock, so latency assertions in tests are not wall-clock bound. */
  now?: () => number;
}

/**
 * routeToCharacter
 *
 * The single entry point handler.ts calls to get a character's response.
 *
 * ── Guarantees ────────────────────────────────────────────────────────────
 *
 * This function does not throw. That is a product requirement, not defensive
 * habit: the user reaches a character immediately after describing something
 * painful, and an error state at that moment is the one outcome the app
 * cannot afford. Every failure path ends in a real, deterministically
 * generated response instead. `meta.stub` and `meta.fallback` record what
 * actually happened so the degradation is visible in logs and to QA without
 * being visible to the user.
 *
 * ── Flow ──────────────────────────────────────────────────────────────────
 *
 *   1. Ask the provider for a payload, under a timeout.
 *   2. Retry transient failures up to maxAttempts.
 *   3. On exhaustion, generate the deterministic payload locally.
 *   4. Run Tier 1 integrity checks inline and attach the verdict.
 *
 * ── Open decisions resolved here ──────────────────────────────────────────
 *
 * The ADR left two questions open. Both are answered deliberately:
 *
 * A Tier 1 violation ANNOTATES rather than blocks. Blocking would mean
 * either a retry loop the user waits through or an error screen, and a
 * slightly-off response delivered warmly beats both. The verdict rides along
 * on the response so this can be revisited without restructuring anything.
 *
 * Tier 2 does NOT run here. It needs a second model call, which would roughly
 * double both latency and cost on the critical path to save a user from a
 * rare and mild failure. The array shape on CharacterResponse already allows
 * a Tier 2 verdict to be appended out of band.
 */
export async function routeToCharacter(
  request: RouteToCharacterRequest,
  options: RouteOptions = {},
): Promise<CharacterResponse> {
  const {
    provider = selectProvider(providerEnvFromProcess()),
    timeoutMs = DEFAULT_MODEL_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    now = () => Date.now(),
  } = options;

  const startedAt = now();
  const { character, input, context } = request;

  let payload: CharacterPayload<CharacterName> | undefined;
  let model = "unavailable";
  let stub = true;
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let fallbackReason: string | undefined;

  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
    try {
      const result = await withTimeout(
        provider.generate({ character, input, context, timeoutMs }),
        timeoutMs,
      );
      payload = result.payload;
      model = result.model;
      stub = result.stub;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      fallbackReason = undefined;
      break;
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      // Logged server-side only. The message may name a provider or a
      // timeout; neither should ever reach the client.
      // eslint-disable-next-line no-console
      console.error(
        `[orchestrator] ${character} attempt ${attempt}/${maxAttempts} failed:`,
        fallbackReason,
      );
    }
  }

  if (!payload) {
    payload = buildDeterministicPayload(character, input);
    model = "deterministic-fallback";
    stub = true;
  }

  const tier1 = runTier1(character, payload);

  return {
    character,
    payload,
    integrityReview: [toReviewSlot(tier1)],
    meta: {
      model,
      latencyMs: Math.max(0, now() - startedAt),
      tokensIn,
      tokensOut,
      stub,
      fallback: fallbackReason !== undefined,
      fallbackReason,
    },
  };
}

/**
 * Reject a promise that outlives its budget.
 *
 * The underlying work is not cancelled — a provider that supports real
 * cancellation should wire an AbortSignal through GenerateRequest. This
 * bounds how long the *caller* waits, which is what protects the request.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`model call exceeded ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
