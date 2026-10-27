/**
 * middle-panel-core
 *
 * Primary architecture and philosophical foundation for The Middle Panel.
 *
 * The Middle Panel exists in the space between impulse and action — the pause
 * where emotional intelligence, perceptual clarity, and strategic wisdom can
 * operate before a response becomes irreversible.
 *
 * Three characters guide every user journey. Each one represents a distinct
 * layer of human capacity that must be engaged in sequence:
 *
 *   TURTLE  → Stabilizes the nervous system. Grounds emotion in the body.
 *   OWL     → Creates perceptual clarity. Separates fact from assumption.
 *   FOX     → Transforms insight into intentional, strategic action.
 *
 * No layer can be skipped without cost. Acting before stabilizing produces
 * reactivity. Acting before clarity produces misdirection. Clarity without
 * action produces paralysis. The architecture enforces the sequence.
 */

import type { EmotionOption, GoalOption, StageTheme } from "../types/panel";

// ─── Character journey order ───────────────────────────────────────────────────

export const JOURNEY_ORDER: StageTheme[] = ["turtle", "owl", "fox"];

// ─── Emotional overwhelm threshold ────────────────────────────────────────────
//
// When a user's self-reported intensity meets or exceeds this value, the
// system must not rush them toward strategy. The Turtle stage deepens, the
// Fox stage is offered last and gently, and the caution flag activates.

export const OVERWHELM_THRESHOLD = 7;

// ─── High-overwhelm emotion set ───────────────────────────────────────────────
//
// These emotions reliably indicate that the user's regulatory system is
// under pressure. Turtle routing is required regardless of stated goal.

export const TURTLE_PRIORITY_EMOTIONS: EmotionOption[] = [
  "angry",
  "hurt",
  "anxious",
  "frustrated",
  "sad",
  "other",
];

// ─── Clarity-seeking goal set ─────────────────────────────────────────────────
//
// Goals that signal the user's primary need is perceptual, not strategic.
// Owl is the lead guide even if emotion is moderate.

export const OWL_PRIORITY_GOALS: GoalOption[] = [
  "get clarity",
  "decide whether to act",
];

// ─── Strategy-ready goal set ──────────────────────────────────────────────────
//
// Goals that signal the user is ready for behavioral planning — but only
// when intensity is below the overwhelm threshold.

export const FOX_PRIORITY_GOALS: GoalOption[] = [
  "set boundary",
  "respond calmly",
  "protect myself",
  "fix relationship",
];

// ─── Character routing rules ──────────────────────────────────────────────────

export type CharacterRoute = {
  character: StageTheme;
  triggers: {
    emotions: EmotionOption[];
    goals: GoalOption[];
    intensityRange: [min: number, max: number];
    keywords: string[];
  };
  depthLevel: "surface" | "standard" | "deep";
};

export const CHARACTER_ROUTING: Record<StageTheme, CharacterRoute> = {
  turtle: {
    character: "turtle",
    triggers: {
      emotions: ["angry", "hurt", "anxious", "frustrated", "sad", "other"],
      goals: ["fix relationship", "respond calmly", "protect myself", "get clarity", "decide whether to act", "set boundary", "other"],
      intensityRange: [OVERWHELM_THRESHOLD, 10],
      keywords: [
        "overwhelmed", "anxious", "reactive", "impulsive", "stressed",
        "flooded", "overthinking", "hurt", "angry", "ashamed",
        "confused", "grounding", "can't think", "spiraling",
        "triggered", "panicking", "frozen", "numb",
      ],
    },
    depthLevel: "deep",
  },

  owl: {
    character: "owl",
    triggers: {
      emotions: ["confused", "disappointed", "frustrated"],
      goals: ["get clarity", "decide whether to act"],
      intensityRange: [3, 7],
      keywords: [
        "clarity", "perspective", "truth", "pattern", "assumption",
        "reality", "philosophical", "understanding", "perception",
        "see clearly", "not sure", "confused", "what really happened",
        "making sense", "meaning", "story I'm telling",
      ],
    },
    depthLevel: "standard",
  },

  fox: {
    character: "fox",
    triggers: {
      emotions: ["frustrated", "disappointed", "other"],
      goals: ["set boundary", "respond calmly", "protect myself", "fix relationship"],
      intensityRange: [1, 6],
      keywords: [
        "strategy", "plan", "action", "next step", "practical",
        "adaptive", "decision", "incentive", "tradeoff", "move",
        "intentional", "what should I do", "options", "timing",
        "how to respond", "what to say",
      ],
    },
    depthLevel: "standard",
  },
};

// ─── Flow rules ───────────────────────────────────────────────────────────────

export const FLOW_RULES = {
  /**
   * Default character journey order. Always honored unless a specific
   * routing rule overrides depth or emphasis.
   */
  defaultOrder: JOURNEY_ORDER,

  /**
   * Do not advance a user into Fox strategy if their intensity is at or
   * above this threshold AND the Turtle stage has not been completed.
   * Fox can be offered, but it should be framed gently and with caution.
   */
  emotionalOverwhelmThreshold: OVERWHELM_THRESHOLD,

  /**
   * When intensity is this high, the Turtle stage should expand to include
   * a physical grounding prompt before any reflective or analytical work.
   */
  physicalGroundingThreshold: 8,

  /**
   * When intensity is below this value, Turtle can be lighter and the Owl
   * stage can open with broader philosophical reframing rather than
   * strict fact/assumption separation.
   */
  lightIntensityThreshold: 4,
} as const;

// ─── Tone and style principles ────────────────────────────────────────────────
//
// All responses across all characters must honor these principles.
// They define the experiential quality of The Middle Panel.

export const CORE_TONE = {
  qualities: [
    "psychologically grounded",
    "emotionally intelligent",
    "reflective",
    "cinematic",
    "contemplative",
    "precise without being clinical",
    "warm without being sentimental",
    "honest without being harsh",
  ],

  prohibitions: [
    "Do not minimize emotion",
    "Do not rush to strategy before the nervous system is settled",
    "Do not moralize or lecture",
    "Do not offer false reassurance",
    "Do not use hollow therapeutic clichés",
    "Do not collapse feeling, interpretation, and action into one reaction",
  ],

  writingStyle: {
    sentenceLength: "varied — short when grounding, longer when reflecting",
    vocabulary: "precise, sensory, image-adjacent",
    perspective: "always in service of the user's clarity and agency",
    pace: "slow enough to invite pause, never rushed",
  },
} as const;

// ─── Core mission ─────────────────────────────────────────────────────────────

export const CORE_MISSION = `
The Middle Panel is the space between impulse and response.

It exists because the most consequential moments in human relationships
are not the ones where we acted — they are the ones where we paused.

This system helps users find that pause, inhabit it fully, and emerge from
it with greater steadiness, clarity, and intentional direction than they
had before they entered.

The architecture is not therapy. It is structured self-reflection, guided
by three distinct intelligences — emotional, perceptual, strategic — that
human beings already carry, but rarely activate in sequence.

The Middle Panel activates them in sequence.
`.trim();

// ─── Routing function ─────────────────────────────────────────────────────────
//
// Determines the primary character emphasis for a given session.
// The journey still follows JOURNEY_ORDER, but this function identifies
// which character should receive deepest engagement.

import type { PanelInput } from "../types/panel";

export function routePrimaryCharacter(input: PanelInput): StageTheme {
  const { emotion, intensity, goal } = input;

  // High overwhelm always anchors in Turtle first, regardless of stated goal
  if (intensity >= OVERWHELM_THRESHOLD || TURTLE_PRIORITY_EMOTIONS.includes(emotion)) {
    return "turtle";
  }

  // Clarity-seeking goals with moderate emotion → Owl leads
  if (OWL_PRIORITY_GOALS.includes(goal) && intensity < OVERWHELM_THRESHOLD) {
    return "owl";
  }

  // Strategy-ready goals with low-to-moderate intensity → Fox is reachable
  if (FOX_PRIORITY_GOALS.includes(goal) && intensity <= FLOW_RULES.lightIntensityThreshold) {
    return "fox";
  }

  // Default: Turtle stabilizes first
  return "turtle";
}

// ─── Depth calculator ─────────────────────────────────────────────────────────
//
// Determines how much depth each stage should receive given the input.

export type StageDepth = "light" | "standard" | "deep";

export function calculateStageDepth(
  stage: StageTheme,
  input: PanelInput,
): StageDepth {
  const { intensity } = input;
  const primary = routePrimaryCharacter(input);

  if (stage === "turtle") {
    if (intensity >= FLOW_RULES.physicalGroundingThreshold) return "deep";
    if (intensity >= OVERWHELM_THRESHOLD) return "standard";
    return "light";
  }

  if (stage === "owl") {
    if (primary === "owl") return "deep";
    if (intensity < FLOW_RULES.lightIntensityThreshold) return "standard";
    return "standard";
  }

  if (stage === "fox") {
    // Fox depth is reduced when overwhelm was high — strategy comes last and gently
    if (intensity >= OVERWHELM_THRESHOLD) return "light";
    if (primary === "fox") return "deep";
    return "standard";
  }

  return "standard";
}
