/**
 * Shared request-body validation for /api/turtle, /api/owl, /api/fox.
 *
 * Validation strategy (Phase 0):
 *  - Reject non-object bodies.
 *  - Reject oversized payloads (checked both via Content-Length header in the
 *    handler, and here via a hard cap on string field lengths).
 *  - Require every field of PanelInput to be present with the correct
 *    primitive type and, where applicable, to be one of a fixed enum.
 *  - Reject out-of-range `intensity` values.
 *  - Trim and length-cap free text (`conflictDescription`) to guard against
 *    abuse (e.g. someone sending megabytes of text to burn compute/tokens
 *    once a real model is wired in during Phase 1).
 *
 * This module has no dependency on Vercel types or Node built-ins so it can
 * be unit-tested in isolation if/when tests are added.
 */

import type {
  CharacterName,
  EmotionOption,
  GoalOption,
  PanelInput,
  UrgencyOption,
} from "./types.js";
import type { ConversationTurn } from "./orchestrator.js";

export const MAX_CONFLICT_DESCRIPTION_LENGTH = 4000;

/**
 * Hard cap on how many prior turns a client may submit.
 *
 * buildContext() windows history down anyway, so a larger array buys the user
 * nothing while still costing the server the parse. Rejecting past the cap
 * keeps the cost of a request bounded by the protocol rather than by the
 * caller's goodwill.
 */
export const MAX_TURNS = 40;

/** Per-turn content cap, matching the free-text cap on the intake. */
export const MAX_TURN_CONTENT_LENGTH = 4000;

const EMOTION_OPTIONS: readonly EmotionOption[] = [
  "angry",
  "hurt",
  "confused",
  "frustrated",
  "anxious",
  "disappointed",
  "sad",
  "other",
];

const GOAL_OPTIONS: readonly GoalOption[] = [
  "fix relationship",
  "set boundary",
  "get clarity",
  "respond calmly",
  "protect myself",
  "decide whether to act",
  "other",
];

const URGENCY_OPTIONS: readonly UrgencyOption[] = ["now", "soon", "can wait"];

export type ValidationResult =
  | { valid: true; data: PanelInput }
  | { valid: false; reason: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePanelInput(body: unknown): ValidationResult {
  if (!isPlainObject(body)) {
    return { valid: false, reason: "Request body must be a JSON object." };
  }

  const { conflictDescription, emotion, intensity, goal, urgency } = body as Record<
    string,
    unknown
  >;

  if (typeof conflictDescription !== "string" || conflictDescription.trim().length === 0) {
    return {
      valid: false,
      reason: "`conflictDescription` is required and must be a non-empty string.",
    };
  }

  if (conflictDescription.length > MAX_CONFLICT_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      reason: `\`conflictDescription\` must be ${MAX_CONFLICT_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }

  if (typeof emotion !== "string" || !EMOTION_OPTIONS.includes(emotion as EmotionOption)) {
    return {
      valid: false,
      reason: `\`emotion\` must be one of: ${EMOTION_OPTIONS.join(", ")}.`,
    };
  }

  if (
    typeof intensity !== "number" ||
    !Number.isFinite(intensity) ||
    intensity < 0 ||
    intensity > 10
  ) {
    return { valid: false, reason: "`intensity` must be a number between 0 and 10." };
  }

  if (typeof goal !== "string" || !GOAL_OPTIONS.includes(goal as GoalOption)) {
    return { valid: false, reason: `\`goal\` must be one of: ${GOAL_OPTIONS.join(", ")}.` };
  }

  if (typeof urgency !== "string" || !URGENCY_OPTIONS.includes(urgency as UrgencyOption)) {
    return {
      valid: false,
      reason: `\`urgency\` must be one of: ${URGENCY_OPTIONS.join(", ")}.`,
    };
  }

  return {
    valid: true,
    data: {
      conflictDescription: conflictDescription.trim(),
      emotion: emotion as EmotionOption,
      intensity,
      goal: goal as GoalOption,
      urgency: urgency as UrgencyOption,
    },
  };
}

// ─── Conversation turns ────────────────────────────────────────────────────

const CHARACTER_NAMES: readonly CharacterName[] = ["turtle", "owl", "fox"];

export type TurnsValidationResult =
  | { valid: true; data: ConversationTurn[] }
  | { valid: false; reason: string };

/**
 * Validate the OPTIONAL `turns` array on a request body.
 *
 * Optional on purpose: the first request of a session legitimately has no
 * history, and requiring an empty array would make the simplest possible
 * call the most fiddly one to construct.
 *
 * The client supplies history because these endpoints are stateless — there
 * is no session store, which is a deliberate privacy property: nothing a user
 * says about their conflict is retained server-side between requests. The
 * cost of that is that history is caller-controlled and therefore untrusted,
 * so it is validated as strictly as the intake itself.
 *
 * Note that a client-supplied `role: "system"` turn is accepted. These
 * endpoints do not build a model prompt from raw turn text today — the
 * deterministic engine reads only PanelInput — but before a live provider is
 * enabled, "system" must be rejected here or namespaced, or it becomes a
 * prompt-injection seam. Recorded as a precondition on enabling live calls.
 */
export function validateConversationTurns(body: unknown): TurnsValidationResult {
  if (!isPlainObject(body)) {
    return { valid: false, reason: "Request body must be a JSON object." };
  }

  const { turns } = body;
  if (turns === undefined || turns === null) {
    return { valid: true, data: [] };
  }

  if (!Array.isArray(turns)) {
    return { valid: false, reason: "`turns`, if present, must be an array." };
  }

  if (turns.length > MAX_TURNS) {
    return { valid: false, reason: `\`turns\` must contain ${MAX_TURNS} entries or fewer.` };
  }

  const validated: ConversationTurn[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (!isPlainObject(turn)) {
      return { valid: false, reason: `\`turns[${i}]\` must be an object.` };
    }

    const { role, content, character, timestamp } = turn;

    if (role !== "user" && role !== "character" && role !== "system") {
      return {
        valid: false,
        reason: `\`turns[${i}].role\` must be "user", "character", or "system".`,
      };
    }

    if (typeof content !== "string") {
      return { valid: false, reason: `\`turns[${i}].content\` must be a string.` };
    }

    if (content.length > MAX_TURN_CONTENT_LENGTH) {
      return {
        valid: false,
        reason: `\`turns[${i}].content\` must be ${MAX_TURN_CONTENT_LENGTH} characters or fewer.`,
      };
    }

    if (role === "character" && !CHARACTER_NAMES.includes(character as CharacterName)) {
      return {
        valid: false,
        reason: `\`turns[${i}].character\` must be one of: ${CHARACTER_NAMES.join(", ")}.`,
      };
    }

    // A malformed timestamp is repaired rather than rejected. It is used only
    // for ordering a summary, so refusing the whole request over a clock
    // formatting difference would be a poor trade.
    const stamp =
      typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp))
        ? timestamp
        : new Date().toISOString();

    validated.push({
      role,
      content: content.trim(),
      timestamp: stamp,
      ...(role === "character" ? { character: character as CharacterName } : {}),
    });
  }

  return { valid: true, data: validated };
}
