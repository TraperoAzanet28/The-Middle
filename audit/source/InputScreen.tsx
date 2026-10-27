import { useState } from "react";
import type { GoalOption, PanelInput } from "../types/panel";
import { Button } from "./Button";

type InputScreenProps = {
  value: PanelInput;
  onChange: (value: PanelInput) => void;
  onBack: () => void;
  onContinue: () => void;
};

const emotions: { id: PanelInput["emotion"]; label: string }[] = [
  { id: "angry",        label: "Angry"          },
  { id: "hurt",         label: "Hurt"            },
  { id: "anxious",      label: "Anxious"         },
  { id: "frustrated",   label: "Frustrated"      },
  { id: "confused",     label: "Confused"        },
  { id: "disappointed", label: "Disappointed"    },
  { id: "sad",          label: "Sad"             },
  { id: "other",        label: "Something else"  },
];

const goals: { id: GoalOption; label: string }[] = [
  { id: "fix relationship",      label: "Repair the relationship"       },
  { id: "set boundary",          label: "Set a clear boundary"          },
  { id: "get clarity",           label: "Understand what happened"      },
  { id: "respond calmly",        label: "Respond without reacting"      },
  { id: "protect myself",        label: "Protect myself"                },
  { id: "decide whether to act", label: "Decide whether to act at all"  },
  { id: "other",                 label: "Something else"                },
];

const starters = [
  {
    label: "Someone went silent",
    value: "Someone I care about stopped replying and I'm not sure whether to reach out or give them space.",
    emotion: "hurt" as const,
    goal: "get clarity" as const,
  },
  {
    label: "A boundary was crossed",
    value: "A pattern keeps repeating, and I need to decide whether to say something clearly or step back.",
    emotion: "frustrated" as const,
    goal: "set boundary" as const,
  },
  {
    label: "There was tension",
    value: "There was friction between us, and I want to address it without making things worse.",
    emotion: "anxious" as const,
    goal: "fix relationship" as const,
  },
] as const;

export function InputScreen({ value, onChange, onBack, onContinue }: InputScreenProps) {
  const [step, setStep] = useState(0);

  const update = <K extends keyof PanelInput>(key: K, next: PanelInput[K]) =>
    onChange({ ...value, [key]: next });

  const hasDescription = value.conflictDescription.trim().length > 8;
  const isEmpty        = value.conflictDescription.trim().length === 0;

  // ── Step 0: What happened? ────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="q-screen q-screen--input">
        <p className="q-screen__context">Begin here</p>
        <p className="q-screen__prompt">
          What is the situation you are trying to navigate?
        </p>
        <div className="q-screen__body">
          <textarea
            className="q-textarea"
            rows={5}
            value={value.conflictDescription}
            onChange={(e) => update("conflictDescription", e.target.value)}
            placeholder="Describe what happened, as simply as you can."
            autoFocus
          />
          {isEmpty && (
            <div className="q-starters">
              <p className="q-starters__label">Start with one of these, then make it yours</p>
              {starters.map((s) => (
                <button
                  key={s.label}
                  className="q-starter"
                  onClick={() =>
                    onChange({ ...value, conflictDescription: s.value, emotion: s.emotion, goal: s.goal })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="q-screen__nav">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          {hasDescription && (
            <Button onClick={() => setStep(1)}>Continue</Button>
          )}
        </div>
      </div>
    );
  }

  // ── Step 1: What emotion? ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="q-screen">
        <p className="q-screen__context">Your feeling</p>
        <p className="q-screen__prompt">
          What is the closest emotion to what you are experiencing right now?
        </p>
        <div className="q-pills">
          {emotions.map((e) => (
            <button
              key={e.id}
              className={`q-pill ${value.emotion === e.id ? "q-pill--selected" : ""}`}
              onClick={() => { update("emotion", e.id); setStep(2); }}
            >
              {e.label}
            </button>
          ))}
        </div>
        <div className="q-screen__nav">
          <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
        </div>
      </div>
    );
  }

  // ── Step 2: How intense? ──────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="q-screen">
        <p className="q-screen__context">Intensity</p>
        <p className="q-screen__prompt">How strong is this feeling right now?</p>
        <div className="q-intensity">
          <div className="q-intensity__number">{value.intensity}</div>
          <input
            type="range"
            min="1"
            max="10"
            value={value.intensity}
            onChange={(e) => update("intensity", Number(e.target.value))}
            className="q-range"
          />
          <div className="q-intensity__labels">
            <span>Barely there</span>
            <span>Overwhelming</span>
          </div>
        </div>
        <div className="q-screen__nav">
          <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
          <Button onClick={() => setStep(3)}>Continue</Button>
        </div>
      </div>
    );
  }

  // ── Step 3: What do you want? ─────────────────────────────────────────────
  return (
    <div className="q-screen">
      <p className="q-screen__context">Your intention</p>
      <p className="q-screen__prompt">
        What do you most want from this moment?
      </p>
      <div className="q-pills">
        {goals.map((g) => (
          <button
            key={g.id}
            className={`q-pill ${value.goal === g.id ? "q-pill--selected" : ""}`}
            onClick={() => { update("goal", g.id); onContinue(); }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="q-screen__nav">
        <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
      </div>
    </div>
  );
}
