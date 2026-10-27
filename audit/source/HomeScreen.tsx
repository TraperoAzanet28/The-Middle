import { Button } from "./Button";

type HomeScreenProps = {
  onStart: () => void;
  onHowItWorks: () => void;
};

export function HomeScreen({ onStart, onHowItWorks }: HomeScreenProps) {
  return (
    <section className="hero">
      <div className="hero__copy">
        <h1>The Middle Panel</h1>
        <p className="hero__tagline">From fast thinking to slow thinking.</p>
        <div className="hero__actions">
          <Button onClick={onStart} size="large">
            Begin
          </Button>
          <Button onClick={onHowItWorks} variant="secondary">
            How It Works
          </Button>
        </div>
      </div>
    </section>
  );
}
