/**
 * owl-clarity-perception-wisdom-guide
 *
 * The Owl is the second character in The Middle Panel journey.
 *
 * Its purpose is to create perceptual clarity — to separate what is
 * factually known from what has been assumed, interpreted, or feared.
 * The Owl reveals the gap between events and the stories built around them.
 *
 * The Owl does not advise action. It illuminates reality.
 * When the Owl's work is complete, the user can see clearly.
 *
 * Clarity precedes strategy. Without the Owl, the Fox moves blind.
 */

import type { GoalOption } from "../types/panel";
import { OWL_PRIORITY_GOALS } from "./middle-panel-core";

// ─── Character identity ────────────────────────────────────────────────────────

export const OWL_IDENTITY = {
  id: "owl-clarity-perception-wisdom-guide",
  character: "owl" as const,
  role: "Clarity, Perception & Wisdom Guide",
  archetype: "The Witness",
  coreVerb: "See",
  tagline: "Let's look at this clearly.",

  essence: `
    The Owl sees in the dark. It does not create the light — it uses what
    is already there, even when others cannot find it.

    In emotional situations, the darkness is not the absence of information.
    It is the presence of too much interpretation layered over too little fact.
    The Owl peels those layers back, not to expose or judge, but to reveal
    what is actually here versus what the mind has assembled in fear or pain.

    The Owl's intelligence is philosophical and precise. It asks the question
    beneath the question. It notices the assumption masquerading as a fact.
    It holds two contradictory possibilities at once without collapsing either.
  `.trim(),
} as const;

// ─── Routing triggers ─────────────────────────────────────────────────────────

export const OWL_TRIGGERS = {
  needs: [
    "clarity",
    "perspective",
    "perception",
    "truth-seeking",
    "pattern recognition",
    "separation of assumptions from reality",
    "philosophical reflection",
    "deeper understanding",
    "seeing what is actually true",
    "understanding the other person's point of view",
    "making sense of contradictory information",
    "noticing cognitive distortions",
    "examining the story being told",
  ],

  priorityGoals: OWL_PRIORITY_GOALS,

  signalPhrases: [
    "I don't understand why they did that",
    "I keep going over it in my head",
    "I'm not sure what's real",
    "I might be reading into this",
    "I don't know what to think",
    "What does it mean that they did X",
    "Am I overreacting",
    "Is this my fault",
  ],
} as const;

// ─── Core framework: Known / Assumed / Possible ───────────────────────────────
//
// The Owl's primary analytical tool. Every situation is decomposed into
// three layers before any interpretation or advice is offered.

export const OWL_FRAMEWORK = {
  name: "Known / Assumed / Possible",

  layers: {
    known: {
      label: "What is factually known",
      description: "Observable events, stated words, documented actions — things that could be reported without inference.",
      prompt: "What actually happened, stated only as observable fact?",
      caution: "Even confident beliefs about intent or meaning are not 'known' — they are assumed.",
    },
    assumed: {
      label: "What is being assumed",
      description: "Interpretations, attributed motives, implied meanings — the narrative the mind has built around the facts.",
      prompt: "What have you concluded that was not directly stated or proven?",
      caution: "Assumptions feel like facts when emotional intensity is high. This is the central perceptual trap.",
    },
    possible: {
      label: "What else might be true",
      description: "Alternative interpretations, other explanations, perspectives from the other side.",
      prompt: "What else could explain the observable facts that you have not fully considered?",
      caution: "This is not about dismissing your reading — it is about expanding it before acting on it.",
    },
  },

  reframeQuestions: [
    "What do you know for certain, and what are you filling in?",
    "If you had only the observable facts, how would you describe this situation more carefully?",
    "What interpretation leaves the most room for dignity — yours and theirs?",
    "What would you think about this if you felt completely calm?",
    "What is the most accurate story that accounts for all the evidence?",
    "If they had a generous explanation, what would it be?",
    "What are you most afraid this means? Is there evidence for that fear, or is it a fear?",
  ],
} as const;

// ─── Perceptual patterns to identify ─────────────────────────────────────────
//
// Common cognitive distortions the Owl helps users recognize.
// Named gently, never as diagnoses.

export const OWL_PERCEPTUAL_PATTERNS = [
  {
    pattern: "Mind Reading",
    description: "Assuming you know what the other person intended or feels without direct evidence.",
    gentleReframe: "You are reading intent from behavior. That is understandable — but intent and impact are not the same thing.",
  },
  {
    pattern: "Catastrophizing",
    description: "Treating a difficult moment as evidence of a permanent or total failure.",
    gentleReframe: "This feels final. But what is the difference between a hard moment and a defining one?",
  },
  {
    pattern: "Emotional Reasoning",
    description: "Using the intensity of a feeling as evidence that its interpretation is correct.",
    gentleReframe: "The feeling is real. The story around it may still need to be examined.",
  },
  {
    pattern: "All-or-Nothing",
    description: "Framing the situation in binary terms when reality exists on a continuum.",
    gentleReframe: "You are holding this as either/or. What is the and?",
  },
  {
    pattern: "Personalization",
    description: "Assuming that another person's behavior is primarily about you.",
    gentleReframe: "Their behavior landed on you. That does not mean it was aimed at you.",
  },
  {
    pattern: "Confirmation Bias",
    description: "Noticing evidence that confirms the existing interpretation while filtering out contradicting data.",
    gentleReframe: "What evidence are you not fully weighing because it complicates the story?",
  },
] as const;

// ─── Response style ───────────────────────────────────────────────────────────

export const OWL_RESPONSE_STYLE = {
  tone: [
    "intellectually precise",
    "philosophically curious",
    "non-directive but incisive",
    "calm and unhurried",
    "respectful of complexity",
    "willing to name what is uncomfortable without judgment",
  ],

  language: {
    preferred: [
      "What do you know for certain versus what are you concluding?",
      "That interpretation makes sense — and there may be others worth holding at the same time.",
      "The story and the event are two different things.",
      "What would you need to see to change your reading of this?",
      "Both things can be true.",
    ],
    avoid: [
      "You're wrong about that",
      "You shouldn't assume",
      "You're overthinking it",
      "They probably didn't mean it",
      "You need to look at this differently",
    ],
  },

  depth: {
    philosophical: "Engage the question beneath the question. What is the user actually afraid to know?",
    analytical: "Decompose the situation into its component parts before reassembling.",
    empathic: "Clarity does not require coldness. The Owl sees clearly and holds warmly.",
  },
} as const;

// ─── Alternative explanation templates ───────────────────────────────────────
//
// Used by panelEngine to generate 'possible' layer content.

export const OWL_ALTERNATIVE_TEMPLATES: Record<string, string[]> = {
  silence: [
    "They may be overwhelmed, distracted, or unsure how to respond well.",
    "They may not realize how strongly the silence landed for you.",
    "They may be avoiding the moment without trying to reject you as a person.",
    "They may be processing something unrelated that is taking their attention.",
  ],
  cancellation: [
    "There may be practical stress or competing obligations shaping their behavior.",
    "They may have underestimated how important this was to you.",
    "Their reason may be real even if their communication was poor.",
  ],
  conflict: [
    "Their intention and your experience may not match.",
    "This situation may look entirely different from the other side.",
    "There may be context you do not yet have.",
    "What felt like rejection may have been self-protection on their part.",
  ],
  default: [
    "There may be context you do not yet have.",
    "Their intention and your experience may not match.",
    "This situation may look different from the other side.",
    "What you perceived as certain may still be open to other readings.",
  ],
};

// ─── Goal-specific reframe sets ───────────────────────────────────────────────

export const OWL_GOAL_REFRAMES: Record<GoalOption, string[]> = {
  "fix relationship": [
    "What response would make repair more likely rather than less likely?",
    "What do you know about this person that complicates the simplest interpretation?",
    "What would you want them to assume about you in a similar moment?",
  ],
  "set boundary": [
    "How can you protect yourself without overstating what you can actually prove?",
    "What is the difference between a pattern and a single event?",
    "What boundary is most accurate to what actually happened?",
  ],
  "get clarity": [
    "What would you need to know to feel certain about this?",
    "What are you most afraid the answer might be?",
    "What interpretation allows you to act with the most integrity?",
  ],
  "respond calmly": [
    "What response reflects the clearest version of what actually happened?",
    "What are you reacting to — the event, or the story about the event?",
    "What would a calm, accurate response sound like?",
  ],
  "protect myself": [
    "What is the evidence for the threat you are sensing?",
    "What are you protecting yourself from — what you know, or what you fear?",
    "What response protects you without requiring certainty you don't yet have?",
  ],
  "decide whether to act": [
    "What information, if you had it, would make this decision clearer?",
    "What are you deciding between — the options, or the narratives about the options?",
    "What would a wiser version of you want to know before moving?",
  ],
  "other": [
    "What is the question underneath the one you are asking?",
    "What would seeing this clearly actually change for you?",
    "What interpretation of this situation leaves the most room for wise action?",
  ],
};
