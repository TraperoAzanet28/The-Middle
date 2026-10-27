import type { AppStep } from "../types/panel";

const journeySteps: { id: AppStep; label: string; verb: string }[] = [
  { id: "input",   label: "Ground",  verb: "INPUT"   },
  { id: "turtle",  label: "Feel",    verb: "TURTLE"  },
  { id: "owl",     label: "See",     verb: "OWL"     },
  { id: "cave",    label: "Descend", verb: "CAVE"    },
  { id: "fox",     label: "Act",     verb: "FOX"     },
  { id: "summary", label: "Carry",   verb: "SUMMARY" },
];

const stepAccent: Partial<Record<AppStep, { fill: string; glow: string; node: string }>> = {
  input: {
    fill: "linear-gradient(90deg, rgba(100, 170, 240, 0.50), rgba(140, 205, 255, 0.78))",
    glow: "rgba(100, 185, 255, 0.42)",
    node: "rgba(155, 215, 255, 0.95)",
  },
  turtle: {
    fill: "linear-gradient(90deg, rgba(40, 160, 95, 0.55), rgba(75, 210, 130, 0.82))",
    glow: "rgba(55, 185, 110, 0.48)",
    node: "rgba(85, 220, 138, 0.95)",
  },
  owl: {
    fill: "linear-gradient(90deg, rgba(65, 120, 225, 0.55), rgba(100, 165, 255, 0.82))",
    glow: "rgba(80, 145, 240, 0.48)",
    node: "rgba(112, 178, 255, 0.95)",
  },
  cave: {
    fill: "linear-gradient(90deg, rgba(68, 72, 145, 0.55), rgba(98, 105, 195, 0.82))",
    glow: "rgba(78, 82, 172, 0.48)",
    node: "rgba(112, 118, 215, 0.95)",
  },
  fox: {
    fill: "linear-gradient(90deg, rgba(175, 98, 28, 0.55), rgba(228, 142, 55, 0.82))",
    glow: "rgba(210, 120, 42, 0.48)",
    node: "rgba(240, 155, 65, 0.95)",
  },
  summary: {
    fill: "linear-gradient(90deg, rgba(200, 175, 120, 0.50), rgba(235, 218, 165, 0.78))",
    glow: "rgba(218, 198, 140, 0.42)",
    node: "rgba(240, 225, 175, 0.95)",
  },
};

type ProgressBarProps = {
  step: AppStep;
};

export function ProgressBar({ step }: ProgressBarProps) {
  const activeIndex = journeySteps.findIndex((s) => s.id === step);
  if (activeIndex === -1) return null;

  const progress    = activeIndex / (journeySteps.length - 1);
  const currentStep = journeySteps[activeIndex];
  const accent      = stepAccent[step] ?? stepAccent.input!;

  // Clamp label so it never overflows track edges
  const rawPct   = progress * 100;
  const labelPct = Math.max(6, Math.min(94, rawPct));

  return (
    <div className="cinematic-progress" aria-label="Journey progress" data-step={step}>
      <div className="cinematic-progress__track">
        <div
          className="cinematic-progress__fill"
          style={{
            width:     `${rawPct}%`,
            background: accent.fill,
            boxShadow: `0 0 8px ${accent.glow}`,
          }}
        />
        <div
          className="cinematic-progress__node"
          style={{
            left:       `${rawPct}%`,
            background:  accent.node,
            boxShadow: `0 0 0 3px ${accent.glow}, 0 0 14px ${accent.glow}`,
          }}
        />
      </div>
      <div
        className="cinematic-progress__label"
        style={{ left: `${labelPct}%` }}
      >
        {currentStep.label}&ensp;·&ensp;{currentStep.verb}
      </div>
    </div>
  );
}
