import type { PanelAnalysis, PanelInput } from "../types/panel";
import { Button } from "./Button";
import { Card } from "./Card";

type SummaryScreenProps = {
  input: PanelInput;
  analysis: PanelAnalysis;
  onBack: () => void;
  onRestart: () => void;
};

export function SummaryScreen({
  input,
  analysis,
  onBack,
  onRestart,
}: SummaryScreenProps) {
  const recommended =
    analysis.fox.options.find((option) => option.id === analysis.fox.recommendedId) ??
    analysis.fox.options[0];

  return (
    <section className="stack">
      <Card className="summary-hero">
        <span className="eyebrow">Summary</span>
        <h2>A calmer and clearer next step</h2>
        <p>{analysis.summary}</p>
      </Card>

      <div className="summary-grid">
        <Card>
          <h3>Emotional state</h3>
          <p>{analysis.summaryCard.emotionalState}</p>
        </Card>
        <Card>
          <h3>Clarity insight</h3>
          <p>{analysis.summaryCard.clarityInsight}</p>
        </Card>
        <Card>
          <h3>Strategic recommendation</h3>
          <p>{analysis.summaryCard.strategicRecommendation}</p>
        </Card>
        <Card>
          <h3>Current goal</h3>
          <p>
            You selected <strong>{input.goal}</strong> with urgency set to{" "}
            <strong>{input.urgency}</strong>.
          </p>
        </Card>
      </div>

      <Card>
        <h3>Recommended next step</h3>
        <p className="summary-callout">{recommended.title}</p>
        <p>{recommended.description}</p>
        <p>{recommended.likelyOutcome}</p>
        <div className="message-example">
          <span className="pill">If you want, say it like this</span>
          <p>{analysis.exampleMessage}</p>
        </div>
      </Card>

      <div className="form-actions">
        <Button onClick={onBack} variant="ghost">
          Back to Fox
        </Button>
        <Button onClick={onRestart}>Start Over</Button>
      </div>
    </section>
  );
}
