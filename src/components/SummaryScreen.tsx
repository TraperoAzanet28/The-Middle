import type { PanelAnalysis, PanelInput } from "../types/panel";
import { Button } from "./Button";

type SummaryScreenProps = {
  input: PanelInput;
  analysis: PanelAnalysis;
  onBack: () => void;
  onRestart: () => void;
};

export function SummaryScreen({ input: _input, analysis, onBack, onRestart }: SummaryScreenProps) {
  const recommended =
    analysis.fox.options.find((o) => o.id === analysis.fox.recommendedId) ??
    analysis.fox.options[0];

  return (
    <div className="q-screen q-screen--summary">
      <p className="q-screen__context">Summary</p>

      <h2 className="summary-title">
        You paused.<br />You saw clearly.<br />You chose.
      </h2>

      <p className="summary-journey-bridge">
        You moved through the forest, the river, and the dark — and arrived here.
      </p>

      <div className="summary-sections">
        <div className="summary-section">
          <p className="summary-section__label">What you felt</p>
          <p className="summary-section__text">{analysis.summaryCard.emotionalState}</p>
        </div>

        <div className="summary-section">
          <p className="summary-section__label">What you saw</p>
          <p className="summary-section__text">{analysis.summaryCard.clarityInsight}</p>
        </div>

        <div className="summary-section">
          <p className="summary-section__label">What you chose</p>
          <p className="summary-section__text summary-section__text--featured">
            {recommended.title}
          </p>
          <p className="summary-section__text">{recommended.description}</p>
        </div>
      </div>

      <div className="summary-message">
        <p className="summary-message__label">A place to start, if you need one</p>
        <p className="summary-message__text">
          &ldquo;{analysis.exampleMessage}&rdquo;
        </p>
      </div>

      <div className="q-screen__nav">
        <Button variant="ghost" onClick={onBack}>Back to Fox</Button>
        <Button onClick={onRestart}>Begin again</Button>
      </div>
    </div>
  );
}
