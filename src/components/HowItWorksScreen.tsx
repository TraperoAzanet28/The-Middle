import { Button } from "./Button";

type HowItWorksScreenProps = {
  onBegin: () => void;
  onBack: () => void;
};

const stages = [
  {
    number: "01",
    character: "Turtle",
    verb: "Pause",
    description:
      "Before anything else, your nervous system needs to slow down. The Turtle holds the moment — it does not rush you toward meaning. It gives you the space to feel what is actually here, not what the first reaction insists is true.",
    numberColor: "rgba(75, 215, 130, 0.32)",
    glowColor:   "rgba(55, 185, 110, 0.06)",
    labelColor:  "rgba(100, 220, 145, 0.72)",
  },
  {
    number: "02",
    character: "Owl",
    verb: "Reflect",
    description:
      "Emotion makes a story. The Owl examines that story carefully — separating what is known from what has been assumed, what happened from what it might mean. Clarity is not cold. It is precise care applied to the present moment.",
    numberColor: "rgba(100, 165, 255, 0.32)",
    glowColor:   "rgba(75, 140, 240, 0.06)",
    labelColor:  "rgba(120, 178, 255, 0.72)",
  },
  {
    number: "03",
    character: "Fox",
    verb: "Decide",
    description:
      "Once the nervous system is steady and perception is clear, the Fox maps the available paths. It names the tradeoffs. It honors timing. It does not tell you what to do — it helps you choose with full awareness of the terrain.",
    numberColor: "rgba(235, 148, 60, 0.32)",
    glowColor:   "rgba(210, 122, 42, 0.06)",
    labelColor:  "rgba(240, 155, 68, 0.72)",
  },
] as const;

export function HowItWorksScreen({ onBegin, onBack }: HowItWorksScreenProps) {
  return (
    <section className="hiw">
      <div className="hiw__intro">
        <p className="hiw__label">How It Works</p>
        <h1 className="hiw__title">Three guides. One sequence.</h1>
        <p className="hiw__subtitle">
          No layer can be skipped without cost. The architecture enforces the
          order — so you don&apos;t have to.
        </p>
      </div>

      <div className="hiw__stages">
        {stages.map((stage) => (
          <div
            className="hiw__stage"
            key={stage.number}
            style={{ "--stage-glow": stage.glowColor } as React.CSSProperties}
          >
            <span
              className="hiw__stage-number"
              style={{ color: stage.numberColor }}
            >
              {stage.number}
            </span>
            <div className="hiw__stage-body">
              <p
                className="hiw__stage-action"
                style={{ color: stage.labelColor }}
              >
                {stage.verb}
              </p>
              <p className="hiw__stage-character">{stage.character}</p>
              <p className="hiw__stage-desc">{stage.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hiw__actions">
        <Button onClick={onBegin} size="large">
          Begin
        </Button>
        <Button onClick={onBack} variant="ghost">
          Back
        </Button>
      </div>
    </section>
  );
}
