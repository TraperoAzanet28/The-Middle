import type { GoalOption, PanelInput, UrgencyOption } from "../types/panel";
import { Button } from "./Button";
import { Card } from "./Card";

type InputScreenProps = {
  value: PanelInput;
  onChange: (value: PanelInput) => void;
  onBack: () => void;
  onContinue: () => void;
};

const emotions: PanelInput["emotion"][] = [
  "angry",
  "hurt",
  "confused",
  "frustrated",
  "anxious",
  "disappointed",
  "sad",
  "other",
];

const goals: GoalOption[] = [
  "fix relationship",
  "set boundary",
  "get clarity",
  "respond calmly",
  "protect myself",
  "decide whether to act",
  "other",
];

const urgencyOptions: UrgencyOption[] = ["now", "soon", "can wait"];
const suggestionChips = [
  {
    label: "Ignored after reaching out",
    description: "Someone stopped replying and it feels personal.",
    value: "Someone stopped replying to my messages and I am not sure whether to reach out again or step back.",
    emotion: "hurt" as const,
    goal: "get clarity" as const,
  },
  {
    label: "Boundary issue",
    description: "A repeated behavior is wearing me down.",
    value: "A pattern keeps repeating, and I need to decide whether to set a clearer boundary without escalating things.",
    emotion: "frustrated" as const,
    goal: "set boundary" as const,
  },
  {
    label: "Repair after tension",
    description: "I want to fix the relationship without reacting badly.",
    value: "There was tension between us, and I want to address it in a way that protects the relationship instead of making it worse.",
    emotion: "anxious" as const,
    goal: "fix relationship" as const,
  },
] as const;

export function InputScreen({
  value,
  onChange,
  onBack,
  onContinue,
}: InputScreenProps) {
  const update = <K extends keyof PanelInput>(key: K, nextValue: PanelInput[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  const isReady =
    value.conflictDescription.trim().length > 0 &&
    value.emotion.length > 0 &&
    value.goal.length > 0;

  const isVague = value.conflictDescription.trim().split(/\s+/).filter(Boolean).length < 10;

  return (
    <Card className="screen-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Input</span>
          <h2>Describe the moment before you decide what it means</h2>
        </div>
        <p>
          Keep it simple. You only need enough detail to help the system slow,
          clarify, and guide your next move.
        </p>
      </div>

      <label className="field">
        <span>What happened?</span>
        <textarea
          rows={5}
          value={value.conflictDescription}
          onChange={(event) => update("conflictDescription", event.target.value)}
          placeholder="Describe the conflict, misunderstanding, or emotionally difficult moment."
        />
      </label>

      {isVague ? (
        <div className="inline-note inline-note--guide">
          <div>
            <strong>Need help getting started?</strong>
            <p>
              Short is okay. Use one of these starters, then adjust the wording
              so it feels like yours.
            </p>
          </div>
          <div className="suggestion-grid">
            {suggestionChips.map((chip) => (
              <button
                className="suggestion-chip"
                key={chip.label}
                onClick={() =>
                  onChange({
                    ...value,
                    conflictDescription: chip.value,
                    emotion: chip.emotion,
                    goal: chip.goal,
                  })
                }
                type="button"
              >
                <strong>{chip.label}</strong>
                <span>{chip.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="control-grid">
        <div className="cluster">
          <span className="cluster__label">Current emotion</span>
          <div className="segmented-grid">
            {emotions.map((emotion) => (
              <button
                className={`choice ${value.emotion === emotion ? "choice--selected" : ""}`}
                key={emotion}
                onClick={() => update("emotion", emotion)}
                type="button"
              >
                {emotion}
              </button>
            ))}
          </div>
        </div>

        <div className="cluster">
          <div className="cluster__header">
            <span className="cluster__label">Intensity</span>
            <strong>{value.intensity}/10</strong>
          </div>
          <input
            aria-label="Emotion intensity"
            className="range"
            min="1"
            max="10"
            step="1"
            type="range"
            value={value.intensity}
            onChange={(event) => update("intensity", Number(event.target.value))}
          />
        </div>
      </div>

      <div className="cluster">
        <span className="cluster__label">Your goal</span>
        <div className="segmented-grid segmented-grid--wide">
          {goals.map((goal) => (
            <button
              className={`choice ${value.goal === goal ? "choice--selected" : ""}`}
              key={goal}
              onClick={() => update("goal", goal)}
              type="button"
            >
              {goal}
            </button>
          ))}
        </div>
      </div>

      <div className="cluster">
        <span className="cluster__label">Urgency</span>
        <div className="urgency-row">
          {urgencyOptions.map((urgency) => (
            <button
              className={`choice choice--compact ${value.urgency === urgency ? "choice--selected" : ""}`}
              key={urgency}
              onClick={() => update("urgency", urgency)}
              type="button"
            >
              {urgency}
            </button>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <Button onClick={onBack} variant="ghost">
          Back
        </Button>
        <Button onClick={onContinue} disabled={!isReady}>
          Continue to Turtle
        </Button>
      </div>
    </Card>
  );
}
