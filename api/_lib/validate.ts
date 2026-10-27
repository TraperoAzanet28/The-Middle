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

import type { EmotionOption, GoalOption, PanelInput, UrgencyOption } from "./types.js";

export const MAX_CONFLICT_DESCRIPTION_LENGTH = 4000;

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
