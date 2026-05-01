export type EmotionOption =
  | "angry"
  | "hurt"
  | "confused"
  | "frustrated"
  | "anxious"
  | "disappointed"
  | "sad"
  | "other";

export type GoalOption =
  | "fix relationship"
  | "set boundary"
  | "get clarity"
  | "respond calmly"
  | "protect myself"
  | "decide whether to act"
  | "other";

export type UrgencyOption = "now" | "soon" | "can wait";

export type AppStep = "home" | "input" | "turtle" | "owl" | "fox" | "summary";

export type PanelInput = {
  conflictDescription: string;
  emotion: EmotionOption;
  intensity: number;
  goal: GoalOption;
  urgency: UrgencyOption;
};

export type StageTheme = "turtle" | "owl" | "fox";

export type StrategyOption = {
  id: string;
  title: string;
  timing: "Act now" | "Act soon" | "Wait";
  description: string;
  likelyOutcome: string;
  strength: string;
};

export type PanelAnalysis = {
  summary: string;
  emotionalNeed: string;
  clarifyingQuestions: string[];
  exampleMessage: string;
  turtle: {
    acknowledgment: string;
    grounding: string[];
    reflectivePrompt: string;
    caution?: string;
  };
  owl: {
    known: string[];
    assumed: string[];
    alternatives: string[];
    reframes: string[];
  };
  fox: {
    options: StrategyOption[];
    recommendedId: string;
    reasoning: string;
  };
  summaryCard: {
    emotionalState: string;
    clarityInsight: string;
    strategicRecommendation: string;
  };
};
