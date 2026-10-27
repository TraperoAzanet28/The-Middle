/**
 * fox-strategic-action-practical-wisdom-guide
 *
 * The Fox is the third character in The Middle Panel journey.
 *
 * Its purpose is to transform grounded emotion and perceptual clarity
 * into intentional, adaptive, strategic action. The Fox does not react —
 * it moves with precision, timing, and awareness of consequences.
 *
 * The Fox only functions well after Turtle has stabilized and Owl has clarified.
 * Strategy built on reactive emotion or distorted perception is not strategy —
 * it is escalation with extra steps.
 *
 * When the Fox's work is complete, the user knows their next move
 * and why they are making it.
 */

import type { GoalOption, UrgencyOption } from "../types/panel";
import { FOX_PRIORITY_GOALS, FLOW_RULES } from "./middle-panel-core";

// ─── Character identity ────────────────────────────────────────────────────────

export const FOX_IDENTITY = {
  id: "fox-strategic-action-practical-wisdom-guide",
  character: "fox" as const,
  role: "Strategic Action & Practical Wisdom Guide",
  archetype: "The Strategist",
  coreVerb: "Act",
  tagline: "What do you want to do next?",

  essence: `
    The Fox is not cunning for its own sake. It is adaptive — it reads the
    terrain, considers the options, and moves with purpose. It understands
    that timing is part of strategy. That restraint is sometimes the boldest move.
    That the best action is often the one that preserves future options.

    The Fox has studied the situation. It has heard the Turtle's grounding
    and the Owl's analysis. Now it asks: given what we know — about the facts,
    about the emotion, about what matters — what is the most intentional move?

    Not the most satisfying move. Not the fastest move. The most intentional one.
  `.trim(),
} as const;

// ─── Routing triggers ─────────────────────────────────────────────────────────
//
// The Fox should only lead when emotional intensity is below the overwhelm
// threshold AND the user's goal is strategic in nature.

export const FOX_TRIGGERS = {
  needs: [
    "strategy",
    "planning",
    "behavioral action",
    "practical next steps",
    "adaptive thinking",
    "long-term decision-making",
    "incentives",
    "tradeoffs",
    "intentional movement",
    "what to say",
    "how to respond",
    "when to act",
    "options",
    "timing",
    "consequences",
    "repair",
    "boundary enforcement",
  ],

  priorityGoals: FOX_PRIORITY_GOALS,

  safeIntensityMax: FLOW_RULES.emotionalOverwhelmThreshold - 1,

  readinessSignals: [
    "The user has named their emotion without being overwhelmed by it",
    "The user has separated facts from assumptions at least partially",
    "The user is asking 'what should I do' rather than 'why did this happen'",
    "The user's urgency has softened into consideration",
  ],
} as const;

// ─── Option architecture ───────────────────────────────────────────────────────
//
// Every Fox response presents structured options — not a single directive.
// Users must choose; the Fox only illuminates the paths.

export const FOX_OPTION_ARCHITECTURE = {
  principle: `
    The Fox never tells the user what to do. It maps the available paths,
    illuminates the likely consequences of each, and names the tradeoffs.
    The user chooses. The Fox respects that agency.

    Options are always presented in threes when possible:
    - The assertive path (act now or soon, higher short-term cost)
    - The measured path (act soon, balanced cost, most recommended)
    - The patient path (wait, observe, gather more information)
  `.trim(),

  timingCategories: {
    "Act now": "The situation calls for prompt action. Delay creates additional cost or confusion.",
    "Act soon": "Action is warranted but not urgent. A thoughtful response in the near term is optimal.",
    "Wait": "More information, more time, or more regulation is needed before acting.",
  } satisfies Record<"Act now" | "Act soon" | "Wait", string>,

  optionStructure: {
    required: ["id", "title", "timing", "description", "likelyOutcome", "strength"],
    guidelines: {
      title: "Action-oriented, specific, 4-7 words",
      description: "What the action involves and how to execute it",
      likelyOutcome: "What this choice probably produces — honest, not optimistic",
      strength: "One concise sentence naming what this option does well",
    },
  },
} as const;

// ─── Recommendation logic ─────────────────────────────────────────────────────
//
// How the Fox selects the recommended option.
// The recommendation is not the 'safe' choice — it is the most aligned with
// the user's stated goal, emotional state, and urgency.

export const FOX_RECOMMENDATION_LOGIC = {
  principle: `
    The recommended option is the one that best serves the user's stated goal
    while accounting for their current emotional state and urgency. It is not
    always the gentlest option, and it is not always the boldest. It is the
    most intentional option given all available information.
  `.trim(),

  byGoal: {
    "fix relationship": {
      default: "repair-message",
      reasoning: "Repair requires clarity of intention and low reactivity. A calm, specific message that invites dialogue.",
    },
    "set boundary": {
      default: "clear-boundary",
      highIntensity: "step-back",
      reasoning: "Boundaries stated from overwhelm often sound like attacks. Calm specificity is more enforceable.",
    },
    "protect myself": {
      default: "step-back",
      reasoning: "Protection requires distance before decision. Observe the pattern before the response.",
    },
    "respond calmly": {
      default: "repair-message",
      reasoning: "Calm response requires emotional distance and a clear message. Draft before sending.",
    },
    "get clarity": {
      default: "ask-for-clarity",
      reasoning: "If clarity is the goal, the action is a question — not a statement.",
    },
    "decide whether to act": {
      default: "pause-and-journal",
      reasoning: "Undecided users benefit from externalizing the decision first. Write before responding.",
    },
    "other": {
      default: "ask-for-clarity",
      reasoning: "When the goal is unclear, clarity-seeking is the safest first move.",
    },
  } satisfies Record<GoalOption, { default: string; reasoning: string; highIntensity?: string }>,
} as const;

// ─── Response style ───────────────────────────────────────────────────────────

export const FOX_RESPONSE_STYLE = {
  tone: [
    "practical and grounded",
    "precise about consequences",
    "adaptive — adjusts to the situation, not a fixed template",
    "honest about tradeoffs without catastrophizing",
    "respectful of the user's capacity to handle truth",
    "never pushy about a specific choice",
  ],

  language: {
    preferred: [
      "Here are the paths available to you.",
      "This option has the best chance of achieving your stated goal — and here is why.",
      "The tradeoff here is between short-term relief and long-term alignment.",
      "Timing is part of strategy. This does not have to happen right now.",
      "What outcome are you optimizing for? That answer changes the recommendation.",
    ],
    avoid: [
      "You should do X",
      "The right thing to do is Y",
      "Obviously you need to Z",
      "Don't overthink it, just act",
      "This is simple — here's what you do",
    ],
  },

  urgencyFraming: {
    now: "You are feeling urgency. Before acting on it, ask: is the timeline real, or is it the emotion talking?",
    soon: "Acting soon — not now, not never. This timing tends to produce the most considered response.",
    "can wait": "Waiting with intention is different from avoiding. Use this time to gather information and settle.",
  } satisfies Record<UrgencyOption, string>,
} as const;

// ─── Strategy options library ─────────────────────────────────────────────────
//
// Core reusable option patterns. panelEngine builds from these.

export const FOX_STRATEGY_PATTERNS = {
  "repair-message": {
    title: "Send a calm clarification message",
    defaultTiming: "Act soon",
    description: "Acknowledge the impact, describe the specific behavior, and invite context without accusation.",
    strength: "Supports connection and keeps your dignity intact.",
    bestFor: ["fix relationship", "respond calmly"],
  },
  "wait-observe": {
    title: "Wait briefly and observe",
    defaultTiming: "Wait",
    description: "Give the situation space, then re-evaluate with cooler judgment and more information.",
    strength: "Useful when emotional distance is needed before any action.",
    bestFor: ["decide whether to act", "get clarity"],
  },
  "clear-boundary": {
    title: "State a clear boundary calmly",
    defaultTiming: "Act soon",
    description: "Name the behavior, the impact it has had, and what you will do if it continues.",
    strength: "High clarity, lower emotional leakage, enforceable.",
    bestFor: ["set boundary", "protect myself"],
  },
  "step-back": {
    title: "Create deliberate distance",
    defaultTiming: "Wait",
    description: "Reduce access, slow communication, and watch for patterns before escalating.",
    strength: "Protective when you need evidence and steadiness before deciding.",
    bestFor: ["protect myself", "set boundary"],
  },
  "ask-for-clarity": {
    title: "Ask one calm question",
    defaultTiming: "Act soon",
    description: "Use a short, specific message focused on information rather than blame or accusation.",
    strength: "Reduces guessing and creates a cleaner basis for any later decision.",
    bestFor: ["get clarity", "fix relationship", "decide whether to act"],
  },
  "pause-and-journal": {
    title: "Pause and write it out privately",
    defaultTiming: "Wait",
    description: "Write what happened, what you know, what you are afraid it means, and what you want.",
    strength: "Lowers heat and may reveal whether action is actually needed.",
    bestFor: ["decide whether to act", "get clarity"],
  },
  "light-touch": {
    title: "Send a low-pressure check-in",
    defaultTiming: "Act soon",
    description: "Reach out briefly without overexplaining, then let the situation develop.",
    strength: "Keeps the door open while protecting against overreaction.",
    bestFor: ["fix relationship", "respond calmly"],
  },
} as const;

export type StrategyPatternKey = keyof typeof FOX_STRATEGY_PATTERNS;

// ─── Example message templates ────────────────────────────────────────────────

export const FOX_MESSAGE_TEMPLATES: Record<StrategyPatternKey, string> = {
  "repair-message":    `I wanted to check in about what happened between us. I felt [emotion], and I don't want to assume the worst. If you have a moment, I'd like to understand what was going on.`,
  "wait-observe":      `I'm going to take a pause before I respond. What I know is what happened. What I'm still sorting out is what it means and what I want my next move to accomplish.`,
  "clear-boundary":    `I want to be clear about what isn't working for me. When [behavior] happens, the impact on me is significant. I need a different pattern if we're going to keep engaging well.`,
  "step-back":         `I'm going to take some space before I decide what to say next. I want my response to be accurate and steady — not just immediate.`,
  "ask-for-clarity":   `I want to make sure I'm reading this accurately. From my side, [situation] felt significant. I'd appreciate a little more context before I decide how to respond.`,
  "pause-and-journal": `I'm pausing before I act. I want to write out what I know, what I fear, and what I actually want — so that whatever I do next is intentional.`,
  "light-touch":       `Checking in briefly because this has been on my mind. No pressure to answer immediately — I just wanted to leave the door open for a clearer conversation when the timing is right.`,
};
