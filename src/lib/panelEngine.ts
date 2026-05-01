import type {
  EmotionOption,
  GoalOption,
  PanelAnalysis,
  PanelInput,
  StrategyOption,
} from "../types/panel";

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

const emotionToNeed: Record<EmotionOption, string> = {
  angry: "respect and a sense that your concerns matter",
  hurt: "care, reassurance, and repair",
  confused: "clarity and context",
  frustrated: "movement, acknowledgment, and reduced friction",
  anxious: "stability, predictability, and reassurance",
  disappointed: "honesty about what happened",
  sad: "comfort and understanding",
  other: "space to understand what matters most before reacting",
};

const vagueQuestionBank = [
  "What happened most recently that made this feel charged?",
  "What outcome are you most afraid of if nothing changes?",
];

const buildFacts = (description: string): string[] => {
  const facts = new Set<string>();

  if (contains(description, ["stopped replying", "didn't reply", "no reply", "ignored"])) {
    facts.add("Communication changed or stopped in a way that felt significant.");
  }

  if (contains(description, ["cancel", "cancelled", "backed out"])) {
    facts.add("A plan or expectation appears to have changed.");
  }

  if (contains(description, ["late", "hours", "days", "waiting"])) {
    facts.add("There was a delay that affected how the situation was experienced.");
  }

  if (contains(description, ["friend", "partner", "coworker", "roommate", "family"])) {
    facts.add("This situation involves a relationship that likely matters to you.");
  }

  if (facts.size === 0) {
    facts.add("Something happened that felt emotionally difficult and unresolved.");
  }

  facts.add("You are noticing a strong emotional response and want to act with more control.");
  return Array.from(facts);
};

const buildAssumptions = (description: string, emotion: EmotionOption): string[] => {
  const assumptions = new Set<string>();

  if (contains(description, ["ignored", "no reply", "stopped replying"])) {
    assumptions.add("They may not care about your feelings.");
    assumptions.add("The silence may be intentional disrespect.");
  }

  if (contains(description, ["cancel", "backed out"])) {
    assumptions.add("Their behavior may reflect low commitment or low respect.");
  }

  if (emotion === "angry" || emotion === "hurt") {
    assumptions.add("The impact may feel so clear that interpretation starts to feel like fact.");
  }

  if (assumptions.size === 0) {
    assumptions.add("Your first interpretation may be carrying more certainty than the evidence can hold yet.");
  }

  return Array.from(assumptions);
};

const buildAlternatives = (description: string): string[] => {
  const alternatives = new Set<string>();

  if (contains(description, ["stopped replying", "no reply", "ignored"])) {
    alternatives.add("They may be overwhelmed, distracted, or unsure how to respond well.");
    alternatives.add("They may not realize how strongly the silence landed for you.");
    alternatives.add("They may be avoiding the moment without trying to reject you as a person.");
  }

  if (contains(description, ["cancel", "late"])) {
    alternatives.add("There may be practical stress or competing obligations shaping their behavior.");
  }

  if (alternatives.size === 0) {
    alternatives.add("There may be context you do not yet have.");
    alternatives.add("Their intention and your experience may not match.");
    alternatives.add("This situation may look different from the other side.");
  }

  return Array.from(alternatives).slice(0, 3);
};

const buildReframes = (goal: GoalOption): string[] => {
  const common = [
    "What do I know for sure, and what am I filling in?",
    "If I had only the observable facts, how would I describe this more carefully?",
  ];

  if (goal === "fix relationship") {
    return [
      ...common,
      "What response would make repair more likely rather than less likely?",
    ];
  }

  if (goal === "set boundary" || goal === "protect myself") {
    return [
      ...common,
      "How can I protect myself without overstating what I can actually prove?",
    ];
  }

  return [
    ...common,
    "What interpretation leaves room for dignity, accuracy, and wise action?",
  ];
};

const buildTurtle = (input: PanelInput) => {
  const need = emotionToNeed[input.emotion];
  const highIntensity = input.intensity >= 8;
  const elevatedIntensity = input.intensity >= 6;

  return {
    acknowledgment: `${sentenceCase(input.emotion)} makes sense here. Something in this situation seems to have touched ${need}, and your reaction deserves attention even if it does not need to become immediate action.`,
    grounding: highIntensity
      ? [
          "Take one slower breath before you decide what this means.",
          "Name the feeling first, then wait long enough for the first surge to soften.",
          "Delay any irreversible message until your body feels less urgent.",
        ]
      : elevatedIntensity
        ? [
            "Pause long enough to notice what is feeling threatened or unmet.",
            "Keep your next step small and reversible.",
            "Let the feeling inform you without letting it take over.",
          ]
        : [
            "Stay with the feeling long enough to understand it clearly.",
            "Ask what you need before you ask what the other person owes.",
            "Use calm as a tool, not as denial.",
          ],
    reflectivePrompt: `Before responding, ask yourself: what do I most need right now, and what action would support that need without creating extra damage later?`,
    caution: highIntensity
      ? "High emotional intensity can distort judgment. A short pause now may protect you from a response that feels satisfying for one minute and costly for one week."
      : undefined,
  };
};

const buildFoxOptions = (input: PanelInput): StrategyOption[] => {
  const options: StrategyOption[] = [];

  if (input.goal === "fix relationship") {
    options.push(
      {
        id: "repair-message",
        title: "Send a calm clarification message",
        timing: input.urgency === "now" ? "Act soon" : "Act soon",
        description:
          "Acknowledge the impact, describe the specific behavior, and invite context without accusation.",
        likelyOutcome:
          "This gives the relationship the best chance of repair while lowering the odds of escalation.",
        strength: "Supports connection and keeps your dignity intact.",
      },
      {
        id: "wait-observe",
        title: "Wait briefly and observe",
        timing: "Wait",
        description:
          "Give the situation a little space, then re-evaluate with cooler judgment.",
        likelyOutcome:
          "This may reduce reactivity, but it could also leave you in uncertainty if no follow-up happens.",
        strength: "Useful when you need emotional distance before acting.",
      },
      {
        id: "reactive-text",
        title: "Send the message you want to send right now",
        timing: "Act now",
        description:
          "Express the anger directly without much filtering.",
        likelyOutcome:
          "This may create immediate release, but it usually weakens the chance of being understood well.",
        strength: "Fast emotional release, low long-term precision.",
      },
    );
    return options;
  }

  if (input.goal === "set boundary" || input.goal === "protect myself") {
    options.push(
      {
        id: "clear-boundary",
        title: "State a clear boundary calmly",
        timing: "Act soon",
        description:
          "Name the behavior, the impact, and what you will do if it continues.",
        likelyOutcome:
          "This protects your dignity while keeping the message specific and enforceable.",
        strength: "High clarity with lower emotional leakage.",
      },
      {
        id: "step-back",
        title: "Create distance before deciding",
        timing: "Wait",
        description:
          "Reduce access, slow communication, and watch for patterns rather than one moment.",
        likelyOutcome:
          "This may help you see whether the issue is recurring before you escalate it.",
        strength: "Good when you need evidence and steadiness first.",
      },
      {
        id: "confront-hard",
        title: "Confront forcefully",
        timing: "Act now",
        description:
          "Push for an immediate answer or apology.",
        likelyOutcome:
          "You may get a fast reaction, but not necessarily the most useful one.",
        strength: "Direct but often costly when emotion is still hot.",
      },
    );
    return options;
  }

  options.push(
    {
      id: "ask-for-clarity",
      title: "Ask one calm question for clarity",
      timing: "Act soon",
      description:
        "Use a short message that focuses on information rather than blame.",
      likelyOutcome:
        "This can reduce guessing and produce a cleaner basis for any later decision.",
      strength: "Best for accuracy and lower escalation.",
    },
    {
      id: "pause-and-journal",
      title: "Pause and capture your thoughts privately",
      timing: "Wait",
      description:
        "Write what happened, what you know, and what you are afraid it means.",
      likelyOutcome:
        "This lowers heat and may reveal whether action is actually needed.",
      strength: "Strong for emotional regulation and perceptual clarity.",
    },
    {
      id: "light-touch",
      title: "Send a brief low-pressure check-in",
      timing: "Act soon",
      description:
        "Reach out without overexplaining, then see how the situation develops.",
      likelyOutcome:
        "This keeps the door open while protecting against overreaction.",
      strength: "Balanced when you want movement without intensity.",
    },
  );

  return options;
};

const selectRecommendation = (input: PanelInput) => {
  if (input.goal === "fix relationship") {
    return "repair-message";
  }
  if (input.goal === "set boundary" || input.goal === "protect myself") {
    return input.intensity >= 8 ? "step-back" : "clear-boundary";
  }
  if (input.goal === "decide whether to act") {
    return "pause-and-journal";
  }
  return "ask-for-clarity";
};

const buildExampleMessage = (input: PanelInput, recommendedId: string) => {
  const scene = firstSentence(input.conflictDescription).toLowerCase();

  switch (recommendedId) {
    case "repair-message":
      return `I wanted to check in about ${scene}. I felt ${input.emotion}, and I do not want to assume the worst. If you have a moment, I would like to understand what was going on.`;
    case "wait-observe":
    case "pause-and-journal":
      return `I am going to pause before I respond. What I know is what happened; what I am still sorting out is what it means and what I want my next move to accomplish.`;
    case "clear-boundary":
      return `I want to be clear about what is not working for me. When this happens, the impact is significant, and I need a different pattern if we are going to keep engaging well.`;
    case "step-back":
      return `I am going to take a little space before I decide what to say next. I want my response to be accurate and steady, not just immediate.`;
    case "ask-for-clarity":
      return `I want to make sure I am reading this accurately. From my side, ${scene} felt significant, and I would appreciate a little more context before I decide how to respond.`;
    case "light-touch":
      return `Checking in briefly because this has been on my mind. No pressure to answer immediately, but I wanted to leave the door open for a clearer conversation when the timing is better.`;
    default:
      return `I want to respond in a way that matches my goal, not just my first reaction. I am taking a beat so I can say this clearly.`;
  }
};

export const buildPanelAnalysis = (input: PanelInput): PanelAnalysis => {
  const description = input.conflictDescription.trim();
  const words = description.split(/\s+/).filter(Boolean);
  const clarifyingQuestions = words.length < 10 ? vagueQuestionBank : [];
  const known = buildFacts(description);
  const assumed = buildAssumptions(description, input.emotion);
  const alternatives = buildAlternatives(description);
  const options = buildFoxOptions(input);
  const recommendedId = selectRecommendation(input);
  const recommended = options.find((option) => option.id === recommendedId) ?? options[0];
  const need = emotionToNeed[input.emotion];

  return {
    summary: `This situation feels significant, but the strongest move is not to let feeling, interpretation, and action collapse into a single instant reaction. The Middle Panel separates those layers so you can respond with more steadiness and precision.`,
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
      reasoning: `The recommended move is "${recommended.title}" because it best supports your goal to ${input.goal} while reducing the chance that short-term emotion drives a long-term regret.`,
    },
    summaryCard: {
      emotionalState: `${sentenceCase(input.emotion)} at ${input.intensity}/10 suggests a strong internal signal. The goal now is to keep that signal informative without letting it become your whole decision.`,
      clarityInsight: `The key distinction is between what happened and what it seems to mean. That gap is where conflict often grows.`,
      strategicRecommendation: `${recommended.title}: ${recommended.strength}`,
    },
  };
};
