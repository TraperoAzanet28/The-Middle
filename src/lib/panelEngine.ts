/**
 * panelEngine.ts
 *
 * The analytical core of The Middle Panel.
 *
 * This engine is architected on middle-panel-core and the three character
 * skill guides. All routing thresholds, response language, and stage logic
 * are derived from the prompt layer — never hardcoded here.
 *
 * Architecture: middle-panel-core
 * Characters: turtle → owl → fox (in that order, at the right depth)
 */

import type {
  GoalOption,
  PanelAnalysis,
  PanelInput,
  StrategyOption,
} from "../types/panel";

// ─── Prompt architecture imports ───────────────────────────────────────────────

import {
  FLOW_RULES,
  CORE_MISSION,
  routePrimaryCharacter,
  calculateStageDepth,
} from "../prompts/middle-panel-core";

import {
  TURTLE_ACKNOWLEDGMENT_TEMPLATES,
  TURTLE_GROUNDING_SEQUENCES,
  TURTLE_CAUTION,
} from "../prompts/turtle-emotional-regulation-depth-guide";

import {
  OWL_GOAL_REFRAMES,
  OWL_ALTERNATIVE_TEMPLATES,
  OWL_FRAMEWORK,
} from "../prompts/owl-clarity-perception-wisdom-guide";

import {
  FOX_RECOMMENDATION_LOGIC,
  FOX_STRATEGY_PATTERNS,
  FOX_MESSAGE_TEMPLATES,
  type StrategyPatternKey,
} from "../prompts/fox-strategic-action-practical-wisdom-guide";

// ─── Utilities ────────────────────────────────────────────────────────────────

const lower = (value: string) => value.toLowerCase();

const contains = (value: string, words: string[]) =>
  words.some((word) => lower(value).includes(word));

const sentenceCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const firstSentence = (value: string) => {
  const cleaned = value.trim();
  const match = cleaned.match(/^[^.!?]+/);
  return match?.[0] ?? cleaned;
};

// ─── Emotional need map ───────────────────────────────────────────────────────

const emotionToNeed = {
  angry:        "respect and a sense that your concerns matter",
  hurt:         "care, reassurance, and repair",
  confused:     "clarity and context",
  frustrated:   "movement, acknowledgment, and reduced friction",
  anxious:      "stability, predictability, and reassurance",
  disappointed: "honesty about what happened",
  sad:          "comfort and understanding",
  other:        "space to understand what matters most before reacting",
} as const;

// ─── Clarifying questions ─────────────────────────────────────────────────────

const vagueQuestionBank = [
  "What happened most recently that made this feel charged?",
  "What outcome are you most afraid of if nothing changes?",
];

// ─── TURTLE STAGE BUILDER ─────────────────────────────────────────────────────
//
// Routed through turtle-emotional-regulation-depth-guide.
// Depth level is determined by middle-panel-core.calculateStageDepth.

const buildTurtle = (input: PanelInput) => {
  const depth = calculateStageDepth("turtle", input);

  // Acknowledgment sourced from turtle guide's emotion-specific templates
  const acknowledgment = TURTLE_ACKNOWLEDGMENT_TEMPLATES[input.emotion];

  // Grounding sequence sourced from turtle guide, keyed by depth
  const grounding = [...TURTLE_GROUNDING_SEQUENCES[depth]];

  // Reflective prompt from the owl framework — used at the end of turtle to
  // signal readiness for perceptual work
  const reflectivePrompt = OWL_FRAMEWORK.layers.known.prompt;

  // Caution is activated when intensity meets or exceeds the overwhelm threshold
  // (defined in middle-panel-core, not hardcoded here)
  const caution =
    input.intensity >= FLOW_RULES.emotionalOverwhelmThreshold
      ? TURTLE_CAUTION.highIntensityWarning
      : undefined;

  return { acknowledgment, grounding, reflectivePrompt, caution };
};

// ─── OWL STAGE BUILDER ────────────────────────────────────────────────────────
//
// Routed through owl-clarity-perception-wisdom-guide.
// Applies the Known / Assumed / Possible framework.

const buildFacts = (description: string): string[] => {
  const facts = new Set<string>();

  if (contains(description, ["stopped replying", "didn't reply", "no reply", "ignored", "left on read"])) {
    facts.add("Communication changed or stopped in a way that felt significant.");
  }
  if (contains(description, ["cancel", "cancelled", "backed out", "bailed"])) {
    facts.add("A plan or expectation appears to have changed without clear explanation.");
  }
  if (contains(description, ["late", "hours", "days", "weeks", "waiting", "no response"])) {
    facts.add("There was a delay that affected how the situation was experienced.");
  }
  if (contains(description, ["friend", "partner", "coworker", "roommate", "family", "colleague", "boss"])) {
    facts.add("This situation involves a relationship that likely matters to you.");
  }
  if (facts.size === 0) {
    facts.add("Something happened that felt emotionally difficult and unresolved.");
  }

  // Always include this — grounded in turtle-emotional-regulation-depth-guide
  facts.add("You are noticing a strong emotional response and choosing to act with more awareness.");
  return Array.from(facts);
};

const buildAssumptions = (description: string, emotion: PanelInput["emotion"]): string[] => {
  const assumptions = new Set<string>();

  if (contains(description, ["ignored", "no reply", "stopped replying", "left on read"])) {
    assumptions.add("They may not care about your feelings.");
    assumptions.add("The silence may be intentional disrespect.");
  }
  if (contains(description, ["cancel", "backed out", "bailed"])) {
    assumptions.add("Their behavior may reflect low commitment or low respect.");
  }
  if (emotion === "angry" || emotion === "hurt") {
    // From owl-clarity guide: emotional reasoning pattern
    assumptions.add("The impact may feel so clear that interpretation has started to feel like fact.");
  }
  if (assumptions.size === 0) {
    assumptions.add(OWL_FRAMEWORK.layers.assumed.caution);
  }

  return Array.from(assumptions);
};

const buildAlternatives = (description: string): string[] => {
  // Select the appropriate alternative template set from owl guide
  if (contains(description, ["stopped replying", "no reply", "ignored", "left on read"])) {
    return OWL_ALTERNATIVE_TEMPLATES.silence.slice(0, 3);
  }
  if (contains(description, ["cancel", "late", "bailed"])) {
    return OWL_ALTERNATIVE_TEMPLATES.cancellation.slice(0, 3);
  }
  if (contains(description, ["argument", "fight", "conflict", "confrontation", "tension"])) {
    return OWL_ALTERNATIVE_TEMPLATES.conflict.slice(0, 3);
  }
  return OWL_ALTERNATIVE_TEMPLATES.default.slice(0, 3);
};

const buildReframes = (goal: GoalOption): string[] => {
  // Sourced directly from owl-clarity-perception-wisdom-guide
  return OWL_GOAL_REFRAMES[goal];
};

// ─── FOX STAGE BUILDER ────────────────────────────────────────────────────────
//
// Routed through fox-strategic-action-practical-wisdom-guide.
// Applies the option architecture and recommendation logic.

const buildFoxOptions = (input: PanelInput): StrategyOption[] => {
  const options: StrategyOption[] = [];

  // Build options from FOX_STRATEGY_PATTERNS — the canonical source
  if (input.goal === "fix relationship") {
    options.push(
      patternToOption("repair-message", "Act soon"),
      patternToOption("wait-observe", "Wait"),
      {
        id: "reactive-text",
        title: "Send the message you want to send right now",
        timing: "Act now",
        description: "Express the feeling directly without filtering for impact or timing.",
        likelyOutcome: "This may create immediate release, but it typically weakens the chance of being understood well and can escalate the situation.",
        strength: "Fast emotional release — low long-term precision.",
      },
    );
    return options;
  }

  if (input.goal === "set boundary" || input.goal === "protect myself") {
    options.push(
      patternToOption("clear-boundary", "Act soon"),
      patternToOption("step-back", "Wait"),
      {
        id: "confront-hard",
        title: "Confront directly and immediately",
        timing: "Act now",
        description: "Push for an immediate answer or acknowledgment.",
        likelyOutcome: "You may get a fast reaction, but not necessarily the most useful or honest one — especially if emotion is still high.",
        strength: "Direct — but costly when the nervous system is still activated.",
      },
    );
    return options;
  }

  // Default: clarity / decide-whether-to-act / other
  options.push(
    patternToOption("ask-for-clarity", "Act soon"),
    patternToOption("pause-and-journal", "Wait"),
    patternToOption("light-touch", "Act soon"),
  );

  return options;
};

/** Convert a FOX_STRATEGY_PATTERNS entry into a StrategyOption */
function patternToOption(
  key: StrategyPatternKey,
  timingOverride?: StrategyOption["timing"],
): StrategyOption {
  const p = FOX_STRATEGY_PATTERNS[key];
  return {
    id: key,
    title: p.title,
    timing: timingOverride ?? p.defaultTiming,
    description: p.description,
    likelyOutcome: p.strength, // strength doubles as outcome framing at this detail level
    strength: p.strength,
  };
}

// ─── Recommendation selection ─────────────────────────────────────────────────
//
// Sourced from FOX_RECOMMENDATION_LOGIC — the fox guide's decision rules.

const selectRecommendation = (input: PanelInput): string => {
  const rule = FOX_RECOMMENDATION_LOGIC.byGoal[input.goal];

  // Use high-intensity alternative if available and overwhelm threshold is met
  if (
    "highIntensity" in rule &&
    rule.highIntensity &&
    input.intensity >= FLOW_RULES.emotionalOverwhelmThreshold
  ) {
    return rule.highIntensity;
  }

  return rule.default;
};

// ─── Example message builder ──────────────────────────────────────────────────
//
// Templates sourced from fox-strategic-action-practical-wisdom-guide.
// Substitutes [emotion] and [situation] placeholders.

const buildExampleMessage = (input: PanelInput, recommendedId: string): string => {
  const scene = firstSentence(input.conflictDescription).toLowerCase();
  const template = FOX_MESSAGE_TEMPLATES[recommendedId as StrategyPatternKey];

  if (!template) {
    return `I want to respond in a way that matches my goal, not just my first reaction. I am taking a beat so I can say this clearly.`;
  }

  return template
    .replace("[emotion]", input.emotion)
    .replace("[situation]", scene)
    .replace("[behavior]", scene);
};

// ─── Fox reasoning string ─────────────────────────────────────────────────────

const buildFoxReasoning = (input: PanelInput, recommended: StrategyOption): string => {
  const rule = FOX_RECOMMENDATION_LOGIC.byGoal[input.goal];
  return `The recommended move is "${recommended.title}." ${rule.reasoning}`;
};

// ─── Primary export ───────────────────────────────────────────────────────────

export const buildPanelAnalysis = (input: PanelInput): PanelAnalysis => {
  const description = input.conflictDescription.trim();
  const words = description.split(/\s+/).filter(Boolean);

  // Route and depth — from middle-panel-core
  const primaryCharacter = routePrimaryCharacter(input);
  const foxDepth = calculateStageDepth("fox", input);

  const clarifyingQuestions = words.length < 10 ? vagueQuestionBank : [];
  const known        = buildFacts(description);
  const assumed      = buildAssumptions(description, input.emotion);
  const alternatives = buildAlternatives(description);
  const options      = buildFoxOptions(input);
  const recommendedId = selectRecommendation(input);
  const recommended   = options.find((o) => o.id === recommendedId) ?? options[0];
  const need          = emotionToNeed[input.emotion];

  // Summary references CORE_MISSION so the engine stays philosophically aligned
  const summary = foxDepth === "light"
    ? `${CORE_MISSION.split("\n")[0]} Before moving to strategy, the most important work is emotional steadiness and perceptual clarity. Both come before the next move.`
    : `${CORE_MISSION.split("\n")[0]} This system separates feeling, interpretation, and action so you can respond from the clearest, steadiest version of yourself.`;

  return {
    summary,
    emotionalNeed: need,
    clarifyingQuestions,
    exampleMessage: buildExampleMessage(input, recommendedId),
    turtle: buildTurtle(input),
    owl: {
      known,
      assumed,
      alternatives,
      reframes: buildReframes(input.goal),
    },
    fox: {
      options,
      recommendedId,
      reasoning: buildFoxReasoning(input, recommended),
    },
    summaryCard: {
      emotionalState: `${sentenceCase(input.emotion)} at ${input.intensity}/10 — ${
        input.intensity >= FLOW_RULES.emotionalOverwhelmThreshold
          ? "a strong signal that needed to stabilize before strategy could serve you well."
          : "a signal worth attending to before it becomes a decision."
      }`,
      clarityInsight: OWL_FRAMEWORK.layers.assumed.caution,
      strategicRecommendation: `${recommended.title}: ${recommended.strength}`,
    },
  };

  // Suppress unused-variable warning — primaryCharacter is available for
  // future AI-routing layer that will use it to emphasize a specific stage.
  void primaryCharacter;
};
