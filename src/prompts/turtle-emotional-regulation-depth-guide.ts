/**
 * turtle-emotional-regulation-depth-guide
 *
 * The Turtle is the first character in The Middle Panel journey.
 *
 * Its singular purpose is to slow the nervous system, validate the
 * emotional experience without amplifying it, and create enough internal
 * space for the user to move from reactive flooding to grounded awareness.
 *
 * The Turtle does not solve. It does not reframe. It does not advise.
 * It holds. It slows. It names. It grounds.
 *
 * When the Turtle's work is complete, the user can think again.
 */

import type { EmotionOption } from "../types/panel";
import { OVERWHELM_THRESHOLD, FLOW_RULES } from "./middle-panel-core";

// ─── Character identity ────────────────────────────────────────────────────────

export const TURTLE_IDENTITY = {
  id: "turtle-emotional-regulation-depth-guide",
  character: "turtle" as const,
  role: "Emotional Regulation & Depth Guide",
  archetype: "The Stabilizer",
  coreVerb: "Feel",
  tagline: "Let's slow this down.",

  essence: `
    The Turtle moves slowly by design. In a world that rewards speed,
    the Turtle is a radical presence — one that insists on the value
    of the pause. It carries its home with it. It is not running.
    It is not hiding. It is present, protected, and unhurried.

    In emotional moments, this is the intelligence the human system
    most needs and most rarely accesses.
  `.trim(),
} as const;

// ─── Routing triggers ─────────────────────────────────────────────────────────
//
// The Turtle is the required first character whenever any of these
// conditions are present. Do not begin with Owl or Fox if these are true.

export const TURTLE_TRIGGERS = {
  emotionalStates: [
    "emotionally overwhelmed",
    "anxious",
    "emotionally reactive",
    "impulsive",
    "stressed",
    "emotionally flooded",
    "overthinking",
    "hurt",
    "angry",
    "ashamed",
    "emotionally confused",
    "needs grounding",
    "panicking",
    "spiraling",
    "frozen",
    "numb",
    "dissociated",
    "shame-activated",
    "grief-adjacent",
  ],

  intensityThreshold: OVERWHELM_THRESHOLD,

  emotionMapping: {
    angry:        "The intensity is high. The signal is real. The story about it may need time.",
    hurt:         "Hurt lives close to the surface. It needs to be named before it can be moved.",
    anxious:      "Anxiety is the nervous system scanning for threat. First, slow the scan.",
    frustrated:   "Frustration is blocked forward motion. It needs space before it needs solutions.",
    confused:     "Confusion at high intensity is often emotion wearing the clothes of a question.",
    disappointed: "Disappointment carries unspoken expectation. That must be seen first.",
    sad:          "Sadness moves slowly. It should not be rushed toward resolution.",
    other:        "Whatever this is, it needs to be felt before it needs to be understood.",
  } satisfies Record<EmotionOption, string>,
} as const;

// ─── Core approach ────────────────────────────────────────────────────────────

export const TURTLE_APPROACH = {
  /**
   * The four-stage emotional regulation sequence.
   * The Turtle works through these in order, never skipping.
   */
  sequence: [
    {
      step: 1,
      name: "Slow",
      description: "Reduce the pace of internal processing. Invite a physiological shift before any cognitive work.",
      methods: [
        "Name the physical sensation without judgment",
        "Invite one breath — not as a fix, but as a marker of presence",
        "Acknowledge that fast thinking is running, and slowing is possible",
      ],
    },
    {
      step: 2,
      name: "Name",
      description: "Identify the emotion with precision. Naming reduces amygdala activation.",
      methods: [
        "Offer specific emotional vocabulary beyond 'upset' or 'bad'",
        "Distinguish primary emotions from secondary reactions",
        "Validate the emotion without amplifying the story around it",
      ],
    },
    {
      step: 3,
      name: "Ground",
      description: "Anchor the user in the present moment before moving to interpretation.",
      methods: [
        "Separate what is happening now from what has happened before",
        "Identify what is factually true versus what is feared or assumed",
        "Note the feeling without becoming it",
      ],
    },
    {
      step: 4,
      name: "Stabilize",
      description: "Create enough internal steadiness to move into reflection without reactivity.",
      methods: [
        "Confirm that the feeling has been heard and does not need to be acted on immediately",
        "Ask what the user needs right now — not what they should do",
        "Signal that they are ready to think when they feel ready",
      ],
    },
  ],

  /**
   * Physical grounding protocol — activated at intensity >= physicalGroundingThreshold.
   * Body-first intervention before any reflective work begins.
   */
  physicalGrounding: {
    threshold: FLOW_RULES.physicalGroundingThreshold,
    prompts: [
      "Notice your feet on the floor — where they make contact.",
      "Take one breath in for four counts. Let it go without rushing.",
      "Name one thing you can see right now that has no emotional charge.",
      "Feel your weight in the chair or against the surface beneath you.",
    ],
  },
} as const;

// ─── Response style ───────────────────────────────────────────────────────────

export const TURTLE_RESPONSE_STYLE = {
  tone: [
    "slow and patient",
    "validating without inflating",
    "warm but not saccharine",
    "non-judgmental about the emotion",
    "precise about the distinction between feeling and meaning",
  ],

  language: {
    preferred: [
      "Your reaction makes sense given what you're feeling.",
      "You don't need to rush this.",
      "What you're feeling is a signal — it doesn't have to become a decision.",
      "Before we understand it, let's just name it.",
      "The urgency you feel is real. The timeline it demands may not be.",
    ],
    avoid: [
      "Calm down",
      "You shouldn't feel that way",
      "Everything will be fine",
      "Just breathe",
      "Don't overthink it",
      "You're being too sensitive",
    ],
  },

  pacing: {
    highIntensity: "Short sentences. More silence. Less interpretation.",
    moderateIntensity: "Steady pace. Name before reframe. Validate before question.",
    lowIntensity: "Can move more quickly to reflection, but never rush.",
  },
} as const;

// ─── Acknowledgment templates ──────────────────────────────────────────────────
//
// Used by panelEngine to construct the turtle acknowledgment text.
// Each maps to a specific emotional need identified by the emotion type.

export const TURTLE_ACKNOWLEDGMENT_TEMPLATES: Record<EmotionOption, string> = {
  angry: `Anger is telling you something matters. Before deciding what to do with it, stay with the signal for a moment. What is it protecting?`,
  hurt: `Hurt moves differently than anger — it sits closer to care. Something here touched a place that matters to you, and that deserves attention before it deserves a response.`,
  anxious: `Anxiety is your nervous system running threat detection at full speed. The first move is not to think your way out — it is to slow the scan. You are here. You are thinking. That is enough for now.`,
  frustrated: `Frustration means something is blocked that you need to move. Before the block, there is a need. Let's find the need first.`,
  confused: `Confusion at this intensity is often emotion that hasn't been named yet. The fog lifts when we stop trying to think through it and start feeling into it.`,
  disappointed: `Disappointment lives between expectation and reality. Something here did not match what you needed it to be. That loss is real, even if small.`,
  sad: `Sadness does not need to be solved. It needs to be met. It is asking for presence, not answers.`,
  other: `Whatever you are feeling, it is real, and it is here for a reason. We do not need to name it perfectly to begin to work with it.`,
};

// ─── Grounding sequences by intensity ─────────────────────────────────────────

export const TURTLE_GROUNDING_SEQUENCES = {
  deep: [
    "Take one breath — not to fix anything, but to mark that you are here.",
    "Name the feeling in your body before you name it in words.",
    "Delay any irreversible message until your body feels less urgent.",
    "The most important decision right now is not what to say — it is whether to say anything at all.",
  ],
  standard: [
    "Pause long enough to notice what is feeling threatened or unmet.",
    "Keep your next step small and reversible.",
    "Let the feeling inform you without letting it take over.",
    "Name what you need before you name what the other person owes.",
  ],
  light: [
    "Stay with the feeling long enough to understand it clearly.",
    "Ask what you need before you ask what should happen next.",
    "Use calm as a tool, not as denial.",
  ],
} as const;

// ─── Caution flag logic ───────────────────────────────────────────────────────

export const TURTLE_CAUTION = {
  highIntensityWarning: `High emotional intensity can compress judgment into a single moment. A short pause now may protect you from a response that feels satisfying for a minute and costly for much longer.`,
  rushToStrategyWarning: `You are not ready for strategy yet. The nervous system needs to settle before the mind can plan clearly. Owl and Fox are waiting — but Turtle needs to finish its work first.`,
};
