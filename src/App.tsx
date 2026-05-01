import { useState } from "react";
import { ForestBackground } from "./components/ForestBackground";
import { HomeScreen } from "./components/HomeScreen";
import { InputScreen } from "./components/InputScreen";
import { StageScreen } from "./components/StageScreen";
import { SummaryScreen } from "./components/SummaryScreen";
import { demoScenario } from "./data/demoScenario";
import { buildPanelAnalysis } from "./lib/panelEngine";
import type { AppStep, PanelInput } from "./types/panel";

const emptyInput: PanelInput = {
  conflictDescription: "",
  emotion: "confused",
  intensity: 5,
  goal: "get clarity",
  urgency: "soon",
};

function App() {
  const [step, setStep] = useState<AppStep>("home");
  const [input, setInput] = useState<PanelInput>(emptyInput);

  const analysis = buildPanelAnalysis(input);

  const handleStart = () => {
    setInput(emptyInput);
    goToStep("input");
  };
  const goToStep = (nextStep: AppStep) => {
  setStep(nextStep);

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};









  const handleDemo = () => {
    setInput(demoScenario);
    goToStep("turtle");
  };

  return (
    <div className="app-shell">
      <ForestBackground />
      <div className="ambient ambient--turtle" aria-hidden="true" />
      <div className="ambient ambient--owl" aria-hidden="true" />
      <div className="ambient ambient--fox" aria-hidden="true" />
      <main className="app-frame">
        <div className="view-shell" key={step}>
          {step === "home" ? (
            <HomeScreen onStart={handleStart} onDemo={handleDemo} />
          ) : null}

          {step === "input" ? (
            <InputScreen
              value={input}
              onChange={setInput}
              onBack={() => goToStep("home")}
              onContinue={() => goToStep("turtle")}
            />
          ) : null}

          {step === "turtle" ? (
            <StageScreen
              theme="turtle"
              analysis={analysis}
              onBack={() => goToStep("input")}
              onContinue={() => goToStep("owl")}
              onRestart={() => {
                setInput(emptyInput);
                goToStep("home");
              }}
            />
          ) : null}

          {step === "owl" ? (
            <StageScreen
              theme="owl"
              analysis={analysis}
              onBack={() => goToStep("turtle")}
              onContinue={() => goToStep("fox")}
              onRestart={() => {
                setInput(emptyInput);
                goToStep("home");
              }}
            />
          ) : null}

          {step === "fox" ? (
            <StageScreen
              theme="fox"
              analysis={analysis}
              onBack={() => goToStep("owl")}
              onContinue={() => goToStep("summary")}
              onRestart={() => {
                setInput(emptyInput);
                goToStep("home");
              }}
            />
          ) : null}

          {step === "summary" ? (
            <SummaryScreen
              input={input}
              analysis={analysis}
              onBack={() => goToStep("fox")}
              onRestart={() => {
                setInput(emptyInput);
                goToStep("home");
              }}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default App;
