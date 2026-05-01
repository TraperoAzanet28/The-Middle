import type { AppStep } from "../types/panel";

const orderedSteps: { id: AppStep; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "•" },
  { id: "input", label: "Input", icon: "1" },
  { id: "turtle", label: "Turtle", icon: "🐢" },
  { id: "owl", label: "Owl", icon: "🦉" },
  { id: "fox", label: "Fox", icon: "🦊" },
  { id: "summary", label: "Summary", icon: "✓" },
];

type ProgressBarProps = {
  step: AppStep;
};

export function ProgressBar({ step }: ProgressBarProps) {
  const activeIndex = orderedSteps.findIndex((item) => item.id === step);

  return (
    <div className="progress-shell" aria-label="Mediation progress">
      {orderedSteps.map((item, index) => {
        const state =
          index < activeIndex ? "done" : index === activeIndex ? "active" : "todo";

        return (
          <div className="progress-item" key={item.id}>
            <div className={`progress-dot progress-dot--${state}`}>{item.icon}</div>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
