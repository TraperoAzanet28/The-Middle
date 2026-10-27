import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "./Button";

type CaveScreenProps = {
  onContinue: () => void;
  onBack: () => void;
};

/**
 * CaveScreen — Plato's Cave
 *
 * The philosophical center of The Middle Panel journey.
 *
 * The cave represents the moment of transition from reactive
 * perception to chosen awareness. The user has slowed (Turtle),
 * and seen clearly (Owl). Now they descend into the deeper question:
 * which of their certainties are shadows on the wall?
 *
 * This screen requires no complex interaction.
 * It requires only reading. Sitting. Arriving.
 */
export function CaveScreen({ onContinue, onBack }: CaveScreenProps) {
  const [step, setStep] = useState<0 | 1>(0);

  return (
    <div className="q-screen">
      <motion.div
        key={step}
        className="q-step-content"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: "easeOut" as const }}
      >
        {step === 0 && (
          <>
            <p className="q-screen__context">Cave</p>
            <p className="q-screen__prompt">You have moved deeper into yourself.</p>
            <div className="q-cave-text">
              <p>
                The Owl helped you see the gap between what happened and
                what you told yourself it meant.
              </p>
              <p>
                Now comes the question beneath the question.
              </p>
              <p>
                Not what you should do. But what you are still carrying
                that may not belong to this moment.
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="q-screen__context">Plato's Cave</p>
            <p className="q-screen__prompt q-screen__prompt--italic">
              "What have you been treating as certain that may only be a story?"
            </p>
            <div className="q-cave-text">
              <p>
                Plato described people chained in a cave, watching shadows
                on a wall and mistaking them for reality.
              </p>
              <p>
                Emotional intensity does the same thing. It makes
                interpretation feel like fact. Story feel like truth.
                Reaction feel like the only option.
              </p>
              <p>
                The cave is not a trap. It is an invitation to look again.
              </p>
            </div>
          </>
        )}
      </motion.div>

      <div className="q-screen__nav">
        {step === 0 && (
          <>
            <Button variant="ghost" onClick={onBack}>Back</Button>
            <Button onClick={() => setStep(1)}>Go deeper</Button>
          </>
        )}
        {step === 1 && (
          <>
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={onContinue}>I am ready to act</Button>
          </>
        )}
      </div>
    </div>
  );
}
