import { useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import type { AppStep, PanelAnalysis, PanelInput } from "./types/panel";
import { buildPanelAnalysis } from "./lib/panelEngine";
import { HomeScreen }       from "./components/HomeScreen";
import { HowItWorksScreen } from "./components/HowItWorksScreen";
import { InputScreen }      from "./components/InputScreen";
import { StageScreen }      from "./components/StageScreen";
import { CaveScreen }       from "./components/CaveScreen";
import { SummaryScreen }    from "./components/SummaryScreen";
import { ProgressBar }      from "./components/ProgressBar";
import { AtmosphereCanvas, type EffectType } from "./components/AtmosphereCanvas";
import { AudioToggle }      from "./components/AudioToggle";
import { useAmbientAudio }  from "./hooks/useAmbientAudio";
import { BACKGROUNDS }      from "./prompts/backgrounds";
import { OWL_RIVER, SUMMARY_RIVER, type RiverGeometry } from "./lib/riverFlow";
import "./styles/global.css";

const defaultInput: PanelInput = {
  conflictDescription: "",
  emotion:   "other",
  intensity: 5,
  goal:      "get clarity",
  urgency:   "soon",
};

type ScreenConfig = {
  image: string;
  effects: EffectType[];
  bgPosition?: string;
  /**
   * Pixel-traced course of the river in this scene's plate.
   *
   * Set only where the trace has been rendered back over the art and checked
   * by eye. Scenes without one fall back to the generic band river — see the
   * `river` prop on AtmosphereCanvas. A geometry's `align` MUST match this
   * entry's `bgPosition`, or the current slides off the painted water.
   */
  river?: RiverGeometry;
};

const screenConfig: Record<AppStep, ScreenConfig> = {
  home:       { image: BACKGROUNDS.Home,       effects: ["fireflies", "clouds"]                                     },
  howItWorks: { image: BACKGROUNDS.HowItWorks, effects: ["fog", "fireflies", "clouds", "leaves"]                    },
  input:      { image: BACKGROUNDS.Input,      effects: ["fog", "leaves"]                                           },
  turtle:     { image: BACKGROUNDS.Turtle,     effects: ["fog", "river", "fireflies", "turtle-presence"]            },
  // bgPosition: "left center" — the owl sits on the far-left of the landscape image;
  // cover+center crops it entirely on portrait screens. Shift to expose the owl.
  owl:        { image: BACKGROUNDS.Owl,        effects: ["fog", "river", "fireflies", "leaves", "owl-presence"],
                bgPosition: "left center", river: OWL_RIVER                                                          },
  cave:       { image: BACKGROUNDS.CaveInside, effects: ["fog", "river"]                                            },
  // bgPosition: "right center" — same crop problem as the owl scene. The fox in
  // this plate stands on the right-hand rock shelf, which cover+center crops
  // away entirely on a portrait viewport.
  fox:        { image: BACKGROUNDS.Fox,        effects: ["clouds", "river", "fox-presence"],
                bgPosition: "right center"                                                                           },
  summary:    { image: BACKGROUNDS.Summary,    effects: ["fog", "river", "fireflies", "clouds", "leaves"],
                river: SUMMARY_RIVER                                                                                 },
};

// Steps where the cinematic progress bar is shown
const progressSteps: AppStep[] = ["input", "turtle", "owl", "cave", "fox", "summary"];

export default function App() {
  const [step, setStep]         = useState<AppStep>("home");
  const [input, setInput]       = useState<PanelInput>(defaultInput);
  const [analysis, setAnalysis] = useState<PanelAnalysis | null>(null);

  const { isMuted, toggle } = useAmbientAudio(step);
  const { image, effects, bgPosition = "center", river } = screenConfig[step];
  const showProgress        = progressSteps.includes(step);

  const handleStart      = () => setStep("input");
  const handleHowItWorks = () => setStep("howItWorks");

  const handleContinueFromInput = () => {
    setAnalysis(buildPanelAnalysis(input));
    setStep("turtle");
  };

  const handleRestart = () => {
    setInput(defaultInput);
    setAnalysis(null);
    setStep("home");
  };

  return (
    // reducedMotion="user" makes every motion component below drop transform
    // and layout animations when the OS requests reduced motion, while still
    // animating opacity. Screens therefore keep their cross-dissolve but stop
    // sliding. Set once here rather than per-component so future motion
    // components inherit the behavior automatically.
    <MotionConfig reducedMotion="user">
    <div className="app">

      {/* Layer 0 — background image with cinematic crossfade between scenes.
          AnimatePresence mode="sync" lets old and new backgrounds overlap,
          producing a true cross-dissolve. Camera drift is handled by CSS
          @keyframes cameraDrift on .screen-bg — FM only animates opacity,
          so CSS transform animations on the same element are uncontested. */}
      <AnimatePresence mode="sync">
        <motion.div
          key={image}
          className="screen-bg"
          style={{ backgroundImage: `url("${image}")`, backgroundPosition: bgPosition }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.90, ease: "easeInOut" as const }}
        />
      </AnimatePresence>

      {/* Layer 1 — atmospheric canvas (fixed, pointer-events: none) */}
      <AtmosphereCanvas effects={effects} river={river} />

      {/* Layer 2 — content */}
      <div className={`screen-content${showProgress ? " screen-content--with-bar" : ""}`}>

        {showProgress && (
          <div className="progress-wrapper">
            <ProgressBar step={step} />
          </div>
        )}

        {/* Cinematic scene transitions — each step fades and gently rises as a unit.
            mode="wait" ensures the old scene fully exits before the new one enters,
            preventing overlapping text during transitions. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="scene-layer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.48, ease: "easeInOut" as const }}
          >
            {step === "home" && (
              <HomeScreen onStart={handleStart} onHowItWorks={handleHowItWorks} />
            )}

            {step === "howItWorks" && (
              <HowItWorksScreen onBegin={handleStart} onBack={() => setStep("home")} />
            )}

            {step === "input" && (
              <InputScreen
                value={input}
                onChange={setInput}
                onBack={() => setStep("home")}
                onContinue={handleContinueFromInput}
              />
            )}

            {step === "turtle" && analysis && (
              <StageScreen
                theme="turtle"
                analysis={analysis}
                onBack={() => setStep("input")}
                onContinue={() => setStep("owl")}
                onRestart={handleRestart}
              />
            )}

            {step === "owl" && analysis && (
              <StageScreen
                theme="owl"
                analysis={analysis}
                onBack={() => setStep("turtle")}
                onContinue={() => setStep("cave")}
                onRestart={handleRestart}
              />
            )}

            {step === "cave" && (
              <CaveScreen
                onContinue={() => setStep("fox")}
                onBack={() => setStep("owl")}
              />
            )}

            {step === "fox" && analysis && (
              <StageScreen
                theme="fox"
                analysis={analysis}
                onBack={() => setStep("cave")}
                onContinue={() => setStep("summary")}
                onRestart={handleRestart}
              />
            )}

            {step === "summary" && analysis && (
              <SummaryScreen
                input={input}
                analysis={analysis}
                onBack={() => setStep("fox")}
                onRestart={handleRestart}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Layer 3 — audio toggle (fixed) */}
      <AudioToggle isMuted={isMuted} onToggle={toggle} />
    </div>
    </MotionConfig>
  );
}
