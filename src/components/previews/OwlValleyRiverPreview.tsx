/**
 * OwlValleyRiverPreview.tsx
 *
 * Interactive harness for the spline river, used to check the water against
 * the painting it is supposed to be flowing through.
 *
 * ── Why this is no longer its own implementation ─────────────────────────
 *
 * It used to be. This component carried its own spline, its own sampler and
 * its own control points, ported from a standalone HTML prototype, and all
 * three drifted from the app. Its river was hand-drawn starting at x = 0.80,
 * which on this plate is the cave mouth on the right-hand hillside — the
 * river never goes near it, so the prototype was animating water across a
 * forested slope. A preview that disagrees with the thing it previews is
 * worse than no preview, because it gets trusted.
 *
 * The geometry and the motion rule now come from src/lib/riverFlow.ts, the
 * same module AtmosphereCanvas renders from, where they are pixel-traced off
 * the plates and unit tested. What remains here is only the harness: scene
 * selection, a viewport simulator, and a trace overlay.
 *
 * Mounted only by preview-owl-river.html → src/previews/preview-owl-river.tsx.
 * Not imported by App.tsx or any shipping screen.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  buildRiverPath,
  sampleRiver,
  advanceAlongRiver,
  riverVisibility,
  RIVER_VISIBILITY_THRESHOLD,
  OWL_RIVER,
  SUMMARY_RIVER,
  type RiverGeometry,
} from "../../lib/riverFlow";
import { resolveCoverFrame, projectImagePoint } from "../../lib/presenceAnchor";
import { BACKGROUNDS } from "../../prompts/backgrounds";

type Props = {
  /**
   * Models `prefers-reduced-motion: reduce`.
   *
   * This FREEZES the river, which is what AtmosphereCanvas does app-wide. An
   * earlier version of this file slowed time to 3.5% instead, which is not
   * the same promise: for a user with vestibular sensitivity, very slow
   * motion is still motion. A preview that quietly disagrees with the app
   * hides precisely the accessibility bug it exists to expose.
   */
  isReducedMotion?: boolean;
};

type Glint = {
  u: number;
  lateral: number;
  len: number;
  alpha: number;
  phase: number;
  speed: number;
};

function makeGlints(): Glint[] {
  return Array.from({ length: 54 }, (_, i) => ({
    u: (i * 0.6180339887) % 1,
    lateral: ((i % 7) / 6) * 2 - 1,
    len: 0.016 + (i % 5) * 0.009,
    alpha: 0.055 + (i % 6) * 0.022,
    phase: i * 0.83,
    speed: 0.000026 + (i % 4) * 0.0000085,
  }));
}

const SCENES: Record<string, { label: string; geometry: RiverGeometry; image: string }> = {
  owl: { label: "Owl Valley", geometry: OWL_RIVER, image: BACKGROUNDS.Owl },
  summary: { label: "Summary", geometry: SUMMARY_RIVER, image: BACKGROUNDS.Summary },
};

/** Sizes worth checking: the owl river is cropped out on the portrait ones. */
const VIEWPORTS: { label: string; w: number; h: number }[] = [
  { label: "Phone portrait 390×844", w: 390, h: 844 },
  { label: "Phone landscape 844×390", w: 844, h: 390 },
  { label: "Tablet portrait 834×1112", w: 834, h: 1112 },
  { label: "Laptop 1280×800", w: 1280, h: 800 },
  { label: "Wide desktop 2560×1080", w: 2560, h: 1080 },
];

/** Matches AtmosphereCanvas: t=0 sits at the trough of the slow pulses. */
const STATIC_FRAME_T = 6000;

export function OwlValleyRiverPreview({ isReducedMotion = false }: Props) {
  const [sceneKey, setSceneKey] = useState<string>("owl");
  const [vpIndex, setVpIndex] = useState(3);
  const [showTrace, setShowTrace] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number | null>(null);
  const glints = useRef(makeGlints());

  const scene = SCENES[sceneKey];
  const viewport = VIEWPORTS[vpIndex];
  const path = useMemo(() => buildRiverPath(scene.geometry.controls), [scene]);

  // Read through a ref so toggling a control does not tear down the loop.
  const stateRef = useRef({ scene, viewport, path, showTrace, isReducedMotion });
  stateRef.current = { scene, viewport, path, showTrace, isReducedMotion };

  const visible = riverVisibility(scene.geometry, path, viewport.w, viewport.h);
  const drawn = visible >= RIVER_VISIBILITY_THRESHOLD;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const paint = (t: number) => {
      const s0 = stateRef.current;
      const { w, h } = s0.viewport;
      const geo = s0.scene.geometry;
      const p = s0.path;

      const prev = lastTRef.current;
      // Frozen, not slowed: dt of 0 holds every glint exactly in place.
      const dtMs = s0.isReducedMotion
        ? 0
        : prev === null
          ? 16.7
          : Math.min(50, Math.max(0, t - prev));
      lastTRef.current = t;

      ctx.clearRect(0, 0, w, h);

      const frame = resolveCoverFrame(geo.imageW, geo.imageH, geo.align, w, h);

      if (riverVisibility(geo, p, w, h) >= RIVER_VISIBILITY_THRESHOLD) {
        // ── Channel sheen ────────────────────────────────────────────────
        const STEPS = 48;
        const left: { x: number; y: number }[] = [];
        const right: { x: number; y: number }[] = [];
        for (let i = 0; i <= STEPS; i++) {
          const s = sampleRiver(p, i / STEPS);
          const nx = -s.ty;
          const ny = s.tx;
          const hw = s.w / 2;
          left.push(projectImagePoint(frame, s.x + nx * hw, s.y + ny * hw));
          right.push(projectImagePoint(frame, s.x - nx * hw, s.y - ny * hw));
        }

        const head = projectImagePoint(frame, p.samples[0].x, p.samples[0].y);
        const tailSample = p.samples[p.samples.length - 1];
        const mouth = projectImagePoint(frame, tailSample.x, tailSample.y);

        const breathe = 0.016 + Math.sin(t * 0.00075) * 0.005;
        const sheen = ctx.createLinearGradient(head.x, head.y, mouth.x, mouth.y);
        sheen.addColorStop(0, "rgba(120, 180, 215, 0)");
        sheen.addColorStop(0.3, `rgba(110, 175, 212, ${breathe * 0.8})`);
        sheen.addColorStop(0.7, `rgba(95, 155, 196, ${breathe * 1.25})`);
        sheen.addColorStop(1, `rgba(70, 120, 162, ${breathe * 0.7})`);

        ctx.beginPath();
        left.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
        for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
        ctx.closePath();
        ctx.fillStyle = sheen;
        ctx.fill();

        // ── Glints carried by the current ────────────────────────────────
        ctx.save();
        ctx.clip();
        glints.current.forEach((g) => {
          g.u = advanceAlongRiver(p, g.u, dtMs, g.speed);
          const s = sampleRiver(p, g.u);
          const nx = -s.ty;
          const ny = s.tx;
          const off = g.lateral * (s.w / 2) * 0.72;
          const c = projectImagePoint(frame, s.x + nx * off, s.y + ny * off);

          const len = g.len * frame.dw * (0.6 + s.speedMul * 0.5);
          const shimmer = 0.42 + Math.sin(t * 0.0019 + g.phase) * 0.34;
          const a = g.alpha * shimmer * (0.55 + s.turbulence * 0.75);
          const hx = (s.tx * len) / 2;
          const hy = (s.ty * len) / 2;

          const sg = ctx.createLinearGradient(c.x - hx, c.y - hy, c.x + hx, c.y + hy);
          sg.addColorStop(0, "rgba(140, 205, 240, 0)");
          sg.addColorStop(0.4, `rgba(175, 225, 252, ${a})`);
          sg.addColorStop(0.62, `rgba(200, 238, 255, ${a})`);
          sg.addColorStop(1, "rgba(140, 205, 240, 0)");

          ctx.strokeStyle = sg;
          ctx.lineWidth = Math.max(1, Math.min(2.8, s.w * frame.dw * 0.05));
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(c.x - hx, c.y - hy);
          ctx.lineTo(c.x + hx, c.y + hy);
          ctx.stroke();
        });
        ctx.restore();
      }

      // ── Diagnostic overlay ───────────────────────────────────────────────
      if (s0.showTrace) {
        ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        geo.controls.forEach((cp, i) => {
          const q = projectImagePoint(frame, cp.x, cp.y);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();

        ctx.strokeStyle = "rgba(90, 255, 140, 0.75)";
        ctx.lineWidth = 1.5;
        geo.controls.forEach((cp) => {
          const q = projectImagePoint(frame, cp.x, cp.y);
          const hw = (cp.w * frame.dw) / 2;
          ctx.beginPath();
          ctx.moveTo(q.x - hw, q.y);
          ctx.lineTo(q.x + hw, q.y);
          ctx.stroke();
        });
      }
    };

    const resize = () => {
      const { w, h } = stateRef.current.viewport;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const loop = (t: number) => {
      paint(t);
      rafRef.current = requestAnimationFrame(loop);
    };

    resize();

    if (isReducedMotion) {
      lastTRef.current = null;
      paint(STATIC_FRAME_T);
      return;
    }

    lastTRef.current = null;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isReducedMotion, sceneKey, vpIndex, showTrace]);

  const ctl: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#cdd9ec",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <label style={ctl}>
          Scene
          <select
            value={sceneKey}
            onChange={(e) => setSceneKey(e.target.value)}
            style={{ padding: "4px 8px" }}
          >
            {Object.entries(SCENES).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label style={ctl}>
          Viewport
          <select
            value={vpIndex}
            onChange={(e) => setVpIndex(Number(e.target.value))}
            style={{ padding: "4px 8px" }}
          >
            {VIEWPORTS.map((v, i) => (
              <option key={v.label} value={i}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label style={ctl}>
          <input
            type="checkbox"
            checked={showTrace}
            onChange={(e) => setShowTrace(e.target.checked)}
          />
          Show traced centre line + widths
        </label>
      </div>

      {/* The plate is drawn by CSS using the scene's real background-position,
          so the preview exercises the same cover-crop the app does rather than
          a reimplementation of it that could agree with a bug. */}
      <div
        style={{
          position: "relative",
          width: viewport.w,
          height: viewport.h,
          maxWidth: "100%",
          backgroundImage: `url("${scene.image}")`,
          backgroundSize: "cover",
          backgroundPosition: `${scene.geometry.align} center`,
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: viewport.w,
            height: viewport.h,
          }}
        />
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: drawn ? "#9ec8a4" : "#d8b27a",
          maxWidth: 640,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        {drawn
          ? `River visible: ${(visible * 100).toFixed(0)}% of its length is in frame — drawn.`
          : `River visible: ${(visible * 100).toFixed(0)}% — below the ${(
              RIVER_VISIBILITY_THRESHOLD * 100
            ).toFixed(
              0,
            )}% threshold, so no water is drawn. On this plate the cover-crop keeps the owl in frame and pushes the river out; recentring to show the water would crop out the owl instead.`}
      </p>
    </div>
  );
}
