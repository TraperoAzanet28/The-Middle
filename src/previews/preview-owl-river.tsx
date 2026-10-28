import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { OwlValleyRiverPreview } from "../components/previews/OwlValleyRiverPreview";

/**
 * Standalone mount for OwlValleyRiverPreview.
 *
 * Loaded only by preview-owl-river.html, a separate Vite HTML entry, and not
 * referenced by src/main.tsx or App.tsx. The screen is isolated; the river it
 * draws is not — it renders from src/lib/riverFlow.ts, the same geometry and
 * motion the shipping AtmosphereCanvas uses, so what is previewed here is
 * what the app actually does.
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
          Spline River — Canvas Preview
        </h1>
        <p style={{ margin: 0, color: "#aebdd4", fontSize: 13.5, lineHeight: 1.6 }}>
          Renders the pixel-traced river geometry from <code>src/lib/riverFlow.ts</code> over the
          real background plate, through the same cover-crop the app uses. Switch scene and
          viewport to check the current stays on the painted water.
        </p>
      </header>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input
          type="checkbox"
          checked={isReducedMotion}
          onChange={(e) => setIsReducedMotion(e.target.checked)}
        />
        Reduced motion (freezes the river, as the app does)
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
