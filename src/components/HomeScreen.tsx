import { Button } from "./Button";
import { Card } from "./Card";
import { StageMedallion } from "./StageMedallion";

type HomeScreenProps = {
  onStart: () => void;
  onDemo: () => void;
};

const guides = [
  {
    name: "Turtle",
    title: "Feel",
    body: "Slow down and name what you're feeling.",
    theme: "turtle",
  },
  {
    name: "Owl",
    title: "See",
    body: "Understand what's really happening.",
    theme: "owl",
  },
  {
    name: "Fox",
    title: "Act",
    body: "Choose your next move.",
    theme: "fox",
  },
] as const;

export function HomeScreen({ onStart, onDemo }: HomeScreenProps) {
  return (
    <section className="hero">
      <div className="hero__copy">
        <h1>The Middle Panel</h1>
        <p className="hero__tagline">From fast to clarity</p>
        <div className="hero__actions">
          <Button onClick={onStart} size="large">
            Start
          </Button>
          <Button onClick={onDemo} variant="secondary">
            Load Example
          </Button>
        </div>
      </div>

      <Card className="hero__panel">
        <div className="guide-preview">
          {guides.map((guide) => (
            <article className={`guide-preview__card guide-preview__card--${guide.theme}`} key={guide.name}>
              <div className="guide-preview__icon" aria-hidden="true">
                <StageMedallion
                  theme={guide.theme}
                  label={guide.name}
                />
              </div>
              <div>
                <h2>{guide.title}</h2>
                <h3>{guide.name}</h3>
                <p>{guide.body}</p>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}
