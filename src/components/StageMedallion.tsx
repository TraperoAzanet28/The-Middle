import type { StageTheme } from "../types/panel";

type StageMedallionProps = {
  theme: StageTheme;
  label: string;
  size?: "default" | "large";
};

function TurtleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="medallion-icon medallion-icon--turtle">
      <ellipse cx="24" cy="28" rx="18" ry="14" fill="rgba(106, 160, 130, 0.3)" />
      <ellipse cx="24" cy="26" rx="14" ry="10" fill="rgba(130, 180, 150, 0.5)" />
      <circle cx="24" cy="24" r="8" fill="rgba(80, 140, 110, 0.7)" />
      <circle cx="21" cy="22" r="1.5" fill="rgba(255,255,255,0.9)" />
      <circle cx="27" cy="22" r="1.5" fill="rgba(255,255,255,0.9)" />
      <ellipse cx="24" cy="26" rx="3" ry="2" fill="rgba(60, 100, 80, 0.8)" />
    </svg>
  );
}

function OwlIcon() {
  return (
    <svg viewBox="0 0 48 48" className="medallion-icon medallion-icon--owl">
      <ellipse cx="24" cy="28" rx="16" ry="14" fill="rgba(100, 130, 170, 0.4)" />
      <ellipse cx="24" cy="26" rx="12" ry="10" fill="rgba(120, 150, 190, 0.5)" />
      <circle cx="19" cy="24" r="5" fill="rgba(255, 240, 200, 0.9)" />
      <circle cx="29" cy="24" r="5" fill="rgba(255, 240, 200, 0.9)" />
      <circle cx="19" cy="24" r="2.5" fill="rgba(40, 50, 70, 0.9)" />
      <circle cx="29" cy="24" r="2.5" fill="rgba(40, 50, 70, 0.9)" />
      <polygon points="24,28 22,32 26,32" fill="rgba(200, 160, 100, 0.8)" />
    </svg>
  );
}

function FoxIcon() {
  return (
    <svg viewBox="0 0 48 48" className="medallion-icon medallion-icon--fox">
      <ellipse cx="24" cy="30" rx="16" ry="12" fill="rgba(180, 120, 70, 0.4)" />
      <ellipse cx="24" cy="26" rx="12" ry="9" fill="rgba(200, 140, 90, 0.5)" />
      <polygon points="14,20 18,28 22,22" fill="rgba(200, 120, 60, 0.7)" />
      <polygon points="34,20 30,28 26,22" fill="rgba(200, 120, 60, 0.7)" />
      <circle cx="19" cy="24" r="2" fill="rgba(255,255,255,0.95)" />
      <circle cx="29" cy="24" r="2" fill="rgba(255,255,255,0.95)" />
      <ellipse cx="24" cy="28" rx="2" ry="1.5" fill="rgba(30, 20, 10, 0.8)" />
    </svg>
  );
}

export function StageMedallion({
  theme,
  label,
  size = "default",
}: StageMedallionProps) {
  return (
    <div className={`stage-medallion stage-medallion--${theme} stage-medallion--${size}`}>
      <div className="stage-medallion__ring">
        <div className="stage-medallion__core">
          {theme === "turtle" && <TurtleIcon />}
          {theme === "owl" && <OwlIcon />}
          {theme === "fox" && <FoxIcon />}
        </div>
      </div>
      <span className="stage-medallion__label">{label}</span>
    </div>
  );
}
