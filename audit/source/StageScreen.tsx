import { useState } from "react";
import { motion } from "motion/react";
import type { PanelAnalysis, StageTheme } from "../types/panel";
import { Button } from "./Button";

type StageScreenProps = {
  theme: StageTheme;
  analysis: PanelAnalysis;
  onBack: () => void;
  onContinue: () => void;
  onRestart: () => void;
};

// ─── Meta per character ───────────────────────────────────────────────────────

const meta: Record<StageTheme, { character: string; verb: string; continueLabel: string }> = {
  turtle: { character: "Turtle", verb: "Feel",    continueLabel: "Continue to Owl"  },
  owl:    { character: "Owl",    verb: "See",     continueLabel: "Continue to Cave"  },
  fox:    { character: "Fox",    verb: "Act",     continueLabel: "See Summary"       },
};

// Shared step-content animation — each time the key changes React unmounts the old
// motion.div and mounts a new one, triggering the enter animation without needing
// AnimatePresence (exit animation is instantaneous / not needed within a stage).
const stepTransition = {
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.38, ease: "easeOut" as const },
};

// ─── Turtle ───────────────────────────────────────────────────────────────────

function TurtleStage({ analysis, onBack, onContinue, onRestart }: Omit<StageScreenProps, "theme">) {
  // Compute step list dynamically — skip caution if not triggered
  const steps = [
    analysis.turtle.caution ? "caution" : null,
    "acknowledgment",
    "grounding",
    "reflect",
  ].filter(Boolean) as string[];

  const [idx, setIdx] = useState(0);
  const current = steps[idx];
  const isLast  = idx === steps.length - 1;

  const advance = () => isLast ? onContinue() : setIdx(i => Math.min(i + 1, steps.length - 1));
  const retreat = () => idx === 0 ? onBack() : setIdx(i => Math.max(i - 1, 0));

  return (
    <div className="q-screen">
      {/* key={current} triggers a fresh enter animation on each step change */}
      <motion.div key={current} className="q-step-content" {...stepTransition}>
        {current === "caution" && (
          <>
            <p className="q-screen__context">Turtle · Feel</p>
            <p className="q-screen__prompt">Before we begin — your intensity is high.</p>
            <p className="q-reflection-body">{analysis.turtle.caution}</p>
          </>
        )}

        {current === "acknowledgment" && (
          <>
            <p className="q-screen__context">Turtle · Feel</p>
            <p className="q-screen__prompt q-screen__prompt--serif">
              {analysis.turtle.acknowledgment}
            </p>
          </>
        )}

        {current === "grounding" && (
          <>
            <p className="q-screen__context">Grounding</p>
            <div className="q-moment-items">
              {analysis.turtle.grounding.slice(0, 3).map((item) => (
                <p key={item} className="q-moment-item">{item}</p>
              ))}
            </div>
          </>
        )}

        {current === "reflect" && (
          <>
            <p className="q-screen__context">A question to carry forward</p>
            <p className="q-screen__prompt q-screen__prompt--italic">
              {analysis.turtle.reflectivePrompt}
            </p>
          </>
        )}
      </motion.div>

      <div className="q-screen__nav">
        <Button variant="ghost" onClick={retreat}>Back</Button>
        {idx > 0 && (
          <Button variant="ghost" onClick={onRestart}>Start over</Button>
        )}
        <Button onClick={advance}>
          {isLast ? meta.turtle.continueLabel : "Continue"}
        </Button>
      </div>
    </div>
  );
}

// ─── Owl ──────────────────────────────────────────────────────────────────────

function OwlStage({ analysis, onBack, onContinue, onRestart }: Omit<StageScreenProps, "theme">) {
  const [idx, setIdx] = useState(0);

  const steps = [
    { context: "What you know for certain",    items: analysis.owl.known.slice(0, 3)        },
    { context: "What you may be assuming",     items: analysis.owl.assumed.slice(0, 3)      },
    { context: "What else might be true",      items: analysis.owl.alternatives.slice(0, 3)  },
    { context: "A question to hold",           items: [analysis.owl.reframes[0]]             },
  ];

  const step   = steps[idx];
  const isLast = idx === steps.length - 1;
  const advance = () => isLast ? onContinue() : setIdx(i => Math.min(i + 1, steps.length - 1));
  const retreat = () => idx === 0 ? onBack() : setIdx(i => Math.max(i - 1, 0));

  return (
    <div className="q-screen">
      <motion.div key={idx} className="q-step-content" {...stepTransition}>
        <p className="q-screen__context">Owl · See — {step.context}</p>

        {isLast ? (
          // Final step: single reframe shown as a large serif prompt
          <p className="q-screen__prompt q-screen__prompt--italic">
            {step.items[0]}
          </p>
        ) : (
          <div className="q-moment-items">
            {step.items.map((item) => (
              <p key={item} className="q-moment-item">{item}</p>
            ))}
          </div>
        )}
      </motion.div>

      <div className="q-screen__nav">
        <Button variant="ghost" onClick={retreat}>Back</Button>
        {idx > 0 && (
          <Button variant="ghost" onClick={onRestart}>Start over</Button>
        )}
        <Button onClick={advance}>
          {isLast ? meta.owl.continueLabel : "Continue"}
        </Button>
      </div>
    </div>
  );
}

// ─── Fox ──────────────────────────────────────────────────────────────────────

function FoxStage({ analysis, onBack, onContinue, onRestart }: Omit<StageScreenProps, "theme">) {
  const [idx, setIdx] = useState(0);

  const isLast  = idx === 2;
  const advance = () => isLast ? onContinue() : setIdx(i => Math.min(i + 1, 2));
  const retreat = () => idx === 0 ? onBack() : setIdx(i => Math.max(i - 1, 0));

  return (
    <div className="q-screen">
      <motion.div key={idx} className="q-step-content" {...stepTransition}>
        {idx === 0 && (
          <>
            <p className="q-screen__context">Fox · Act — The most intentional next move</p>
            <p className="q-screen__prompt">{analysis.fox.reasoning}</p>
          </>
        )}

        {idx === 1 && (
          <>
            <p className="q-screen__context">Fox · Act — Your available paths</p>
            <div className="q-fox-options">
              {analysis.fox.options.slice(0, 3).map((option) => (
                <div
                  key={option.id}
                  className={`q-fox-option ${option.id === analysis.fox.recommendedId ? "q-fox-option--recommended" : ""}`}
                >
                  <div className="q-fox-option__header">
                    <span className="q-fox-option__timing">{option.timing}</span>
                    {option.id === analysis.fox.recommendedId && (
                      <span className="q-fox-option__rec">Recommended</span>
                    )}
                  </div>
                  <p className="q-fox-option__title">{option.title}</p>
                  <p className="q-fox-option__desc">{option.description}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {idx === 2 && (
          <>
            <p className="q-screen__context">Fox · Act — A place to start</p>
            <p className="q-screen__prompt q-screen__prompt--italic q-screen__prompt--small">
              &ldquo;{analysis.exampleMessage}&rdquo;
            </p>
          </>
        )}
      </motion.div>

      <div className="q-screen__nav">
        <Button variant="ghost" onClick={retreat}>Back</Button>
        {idx > 0 && (
          <Button variant="ghost" onClick={onRestart}>Start over</Button>
        )}
        <Button onClick={advance}>
          {isLast ? meta.fox.continueLabel : "Continue"}
        </Button>
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function StageScreen({ theme, analysis, onBack, onContinue, onRestart }: StageScreenProps) {
  if (theme === "turtle") return <TurtleStage analysis={analysis} onBack={onBack} onContinue={onContinue} onRestart={onRestart} />;
  if (theme === "owl")    return <OwlStage    analysis={analysis} onBack={onBack} onContinue={onContinue} onRestart={onRestart} />;
  return                         <FoxStage    analysis={analysis} onBack={onBack} onContinue={onContinue} onRestart={onRestart} />;
}
