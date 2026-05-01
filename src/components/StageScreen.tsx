import { useState } from "react";
import type { PanelAnalysis, StageTheme } from "../types/panel";
import { Button } from "./Button";
import { Card } from "./Card";
import { StageMedallion } from "./StageMedallion";

type StageScreenProps = {
  theme: StageTheme;
  analysis: PanelAnalysis;
  onBack: () => void;
  onContinue: () => void;
  onRestart: () => void;
};

const themeMeta = {
  turtle: {
    label: "Turtle",
    title: "Feel",
    subtitle: "Let's slow this down.",
    question1: "What are you feeling right now?",
    question2: "What feels strongest?",
  },
  owl: {
    label: "Owl",
    title: "See",
    subtitle: "Let's look at this clearly.",
    question1: "What's actually happening?",
    question2: "What might also be true?",
  },
  fox: {
    label: "Fox",
    title: "Act",
    subtitle: "What do you want to do next?",
    question1: "Choose your next move",
  },
} as const;

const turtleEmotions = [
  { id: "confused", label: "Confused" },
  { id: "hurt", label: "Hurt" },
  { id: "angry", label: "Angry" },
  { id: "anxious", label: "Anxious" },
  { id: "stuck", label: "Stuck" },
];

const turtleStrongest = [
  { id: "reaction", label: "My reaction" },
  { id: "what_they_did", label: "What they did" },
  { id: "what_it_means", label: "What this means" },
  { id: "what_happens", label: "What might happen next" },
];

const owlFirst = [
  { id: "assuming", label: "I might be assuming" },
  { id: "no_facts", label: "I don't have all the facts" },
  { id: "interpreting", label: "I'm interpreting their behavior" },
  { id: "reacting", label: "I'm reacting emotionally" },
];

const owlAlso = [
  { id: "no_harm", label: "They may not have meant harm" },
  { id: "distracted", label: "They may be distracted or stressed" },
  { id: "more_info", label: "I may need more information" },
  { id: "ask", label: "I may need to ask instead of assume" },
];

const foxActions = [
  { id: "respond_calmly", label: "Respond calmly" },
  { id: "ask_clarity", label: "Ask for clarity" },
  { id: "set_boundary", label: "Set a boundary" },
  { id: "wait", label: "Wait and observe" },
  { id: "let_go", label: "Let it go" },
];

const foxExamples = [
  "I might be misunderstanding, but can you clarify?",
  "I want to respond clearly, not react quickly.",
  "I felt confused earlier — can we talk about it?",
];

export function StageScreen({ theme, analysis, onBack, onContinue, onRestart }: StageScreenProps) {
  const meta = themeMeta[theme];
  const [step, setStep] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [selectedStrongest, setSelectedStrongest] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [selectedOwls, setSelectedOwls] = useState<string[]>([]);
  const [selectedFox, setSelectedFox] = useState<string | null>(null);

  const handleRestart = () => {
    setStep(0);
    setSelectedEmotion(null);
    setSelectedStrongest(null);
    setIntensity(5);
    setSelectedOwls([]);
    setSelectedFox(null);
    onRestart();
  };

  const renderTurtle = () => {
    if (step === 0) {
      return (
        <div className="guided-step">
          <h3>{meta.question1}</h3>
          <div className="button-grid">
            {turtleEmotions.map((emotion) => (
              <button
                key={emotion.id}
                className={`guide-button ${selectedEmotion === emotion.id ? "guide-button--selected" : ""}`}
                onClick={() => {
                  setSelectedEmotion(emotion.id);
                  setStep(1);
                }}
              >
                {emotion.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="guided-step">
          <h3>{meta.question2}</h3>
          <div className="button-grid">
            {turtleStrongest.map((item) => (
              <button
                key={item.id}
                className={`guide-button ${selectedStrongest === item.id ? "guide-button--selected" : ""}`}
                onClick={() => {
                  setSelectedStrongest(item.id);
                  setStep(2);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="guided-step">
          <h3>How strong is this feeling?</h3>
          <div className="intensity-slider">
            <div className="intensity-labels">
              <span>Low</span>
              <span>High</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="range range--large"
            />
          </div>
          <Button onClick={() => setStep(3)}>Continue</Button>
        </div>
      );
    }

    return (
      <div className="guided-step">
        <Card className="insight-card">
          <h3>Key insight</h3>
          <p>{analysis.turtle.acknowledgment}</p>
        </Card>
        <Card>
          <h3>Guidance</h3>
          <ul className="stack-list">
            {analysis.turtle.grounding.slice(0, 2).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    );
  };

  const renderOwl = () => {
    if (step === 0) {
      return (
        <div className="guided-step">
          <h3>{meta.question1}</h3>
          <div className="button-grid">
            {owlFirst.map((q) => (
              <button
                key={q.id}
                className={`guide-button ${selectedOwls.includes(q.id) ? "guide-button--selected" : ""}`}
                onClick={() => {
                  if (!selectedOwls.includes(q.id)) {
                    setSelectedOwls([...selectedOwls, q.id]);
                  }
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
          {selectedOwls.length > 0 && (
            <Button onClick={() => setStep(1)}>Continue</Button>
          )}
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="guided-step">
          <h3>{meta.question2}</h3>
          <div className="button-grid">
            {owlAlso.map((alt, i) => (
              <button
                key={i}
                className="guide-button"
                onClick={() => setStep(2)}
              >
                {alt.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="guided-step">
        <Card className="insight-card">
          <h3>What you know</h3>
          <ul className="stack-list">
            {analysis.owl.known.slice(0, 2).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3>What you assumed</h3>
          <ul className="stack-list">
            {analysis.owl.assumed.slice(0, 2).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3>Other possibilities</h3>
          <ul className="stack-list">
            {analysis.owl.alternatives.slice(0, 2).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    );
  };

  const renderFox = () => {
    if (step === 0) {
      return (
        <div className="guided-step">
          <h3>{meta.question1}</h3>
          <div className="action-grid">
            {foxActions.map((action) => (
              <button
                key={action.id}
                className={`action-card ${selectedFox === action.id ? "action-card--selected" : ""}`}
                onClick={() => {
                  setSelectedFox(action.id);
                  setStep(1);
                }}
              >
                <span className="action-label">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="guided-step">
        <Card className="insight-card">
          <h3>Recommended approach</h3>
          <p>{analysis.fox.reasoning}</p>
        </Card>
        <Card>
          <h3>Example responses</h3>
          <ul className="example-list">
            {foxExamples.map((example, i) => (
              <li key={i} className="example-item">{example}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3>Your options</h3>
          <div className="option-list">
            {analysis.fox.options.slice(0, 3).map((option) => (
              <div key={option.id} className="option-item">
                <strong>{option.title}</strong>
                <p>{option.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  return (
    <section className={`stage stage--${theme}`}>
      <Card className={`stage-hero stage-hero--${theme}`}>
        <div className="stage-hero__icon" aria-hidden="true">
          <StageMedallion
            theme={theme}
            label={meta.label}
            size="large"
          />
        </div>
        <div>
          <span className="eyebrow">{meta.label}</span>
          <h2>{meta.title}</h2>
          <p>{meta.subtitle}</p>
        </div>
      </Card>

      {theme === "turtle" && renderTurtle()}
      {theme === "owl" && renderOwl()}
      {theme === "fox" && renderFox()}

      <div className="form-actions">
        <Button onClick={onBack} variant="ghost">
          Back
        </Button>
        {step > 0 && (
          <Button onClick={handleRestart} variant="ghost">
            Restart
          </Button>
        )}
        {step >= 3 && theme === "turtle" && (
          <Button onClick={onContinue}>Continue</Button>
        )}
        {step >= 2 && theme === "owl" && (
          <Button onClick={onContinue}>Continue</Button>
        )}
        {step >= 1 && theme === "fox" && (
          <Button onClick={onContinue}>See Summary</Button>
        )}
      </div>
    </section>
  );
}
