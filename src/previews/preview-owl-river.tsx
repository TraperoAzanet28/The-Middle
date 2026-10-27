import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { OwlValleyRiverPreview } from "../components/previews/OwlValleyRiverPreview";

/**
 * Standalone mount for OwlValleyRiverPreview — isolated from the live app.
 * Loaded only by preview-owl-river.html (a separate Vite HTML entry).
 * Not referenced by src/main.tsx, App.tsx, or any existing screen.
 */
function PreviewHarness() {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060a12",
        color: "#eef3fb",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        padding: "28px 16px 60px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      <header style={{ maxWidth: 900, textAlign: "center" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 24, margin: "0 0 6px" }}>
          Owl Valley River — React/Canvas Preview
        </h1>
        <p style={{ margin: 0, color: "#aebdd4", fontSize: 13.5, lineHeight: 1.6 }}>
          Isolated preview of <code>OwlValleyRiverPreview.tsx</code>. Not wired into the live app.
        </p>
      </header>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input
          type="checkbox"
          checked={isReducedMotion}
          onChange={(e) => setIsReducedMotion(e.target.checked)}
        />
        Reduced motion (models prefers-reduced-motion support)
      </label>

      <OwlValleyRiverPreview isReducedMotion={isReducedMotion} />
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <PreviewHarness />
    </React.StrictMode>,
  );
}
