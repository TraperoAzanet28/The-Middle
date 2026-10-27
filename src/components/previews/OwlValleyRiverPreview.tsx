import { useEffect, useRef } from "react";
import { BACKGROUNDS } from "../../prompts/backgrounds";

/**
 * OwlValleyRiverPreview
 * ─────────────────────
 * An isolated, non-wired preview of enhanced Owl Valley environmental motion:
 * a river current that follows the image's actual painted path with visible
 * speed variation, drifting specular moonlight reflections on the water,
 * three parallax fog bands, incommensurate-oscillator foliage sway near the
 * owl's perch, and a gently pulsing cave mist near the cave mouth.
 *
 * Architecture mirrors src/components/AtmosphereCanvas.tsx: a functional
 * component holding a <canvas> ref, a requestAnimationFrame loop started in
 * useEffect and cancelled on cleanup, and deterministic particle pools built
 * once via useRef so they persist across re-renders without re-seeding.
 *
 * Motion math (river spline + speed-by-channel-width, incommensurate
 * oscillators for non-looping sway/shimmer, layered fog parallax, cave mist
 * pulse) is ported directly from the standalone prototype at
 * /owl-valley-motion-prototype.html — adapted from that file's global
 * mutable module state into pure render functions operating on refs so the
 * component can mount/unmount safely like any other React component.
 *
 * NOT imported by App.tsx or any existing screen. Rendered only by the
 * isolated preview entry (preview-owl-river.html -> src/previews/preview-owl-river.tsx).
 */

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  /**
   * Models what adding prefers-reduced-motion support would look like — the
   * live app currently has none. When true, simulated time advances at
   * ~3.5% speed instead of being hard-frozen, so motion drastically slows
   * rather than jump-cutting.
   */
  isReducedMotion?: boolean;
};

// ─── River path — Catmull-Rom spline over the painted riverbed ────────────

type RiverControlPoint = { x: number; y: number; w: number };

// Relative (0..1) control points tracing the river as painted in
// /bg-owl-main.png: from the glowing cave mouth down through the valley to
// the foreground. `w` is the relative channel width at that point — narrow
// values mark rapids/bends, wide values mark calm pools.
const RIVER_CONTROLS: RiverControlPoint[] = [
  { x: 0.800, y: 0.415, w: 1.00 }, // cave mouth (wide pool)
  { x: 0.735, y: 0.470, w: 0.85 },
  { x: 0.665, y: 0.520, w: 0.62 }, // narrowing
  { x: 0.600, y: 0.575, w: 0.42 }, // bend 1 — rocks / rapids (fast, turbulent)
  { x: 0.567, y: 0.640, w: 0.70 }, // opens into calm pool
  { x: 0.580, y: 0.705, w: 0.80 }, // wide calm stretch
  { x: 0.560, y: 0.770, w: 0.48 }, // bend 2 — rocks / rapids (fast, turbulent)
  { x: 0.567, y: 0.840, w: 0.75 },
  { x: 0.558, y: 0.910, w: 0.90 }, // wide again near foreground
  { x: 0.562, y: 0.985, w: 1.00 },
];

const CAVE_MOUTH = { x: 0.800, y: 0.415 };

type RiverSample = {
  x: number; y: number; w: number;
  tx: number; ty: number;
  s: number; u: number;
};

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function buildRiverPath(controls: RiverControlPoint[], stepsPerSeg: number): RiverSample[] {
  const pts = [controls[0], ...controls, controls[controls.length - 1]];
  const dense: RiverSample[] = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];
    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      dense.push({
        x: catmullRom1D(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom1D(p0.y, p1.y, p2.y, p3.y, t),
        w: catmullRom1D(p0.w, p1.w, p2.w, p3.w, t),
        tx: 0, ty: 0, s: 0, u: 0,
      });
    }
  }
  const last = controls[controls.length - 1];
  dense.push({ x: last.x, y: last.y, w: last.w, tx: 0, ty: 0, s: 0, u: 0 });

  // Tangents, via central differences.
  for (let i = 0; i < dense.length; i++) {
    const a = dense[Math.max(0, i - 1)];
    const b = dense[Math.min(dense.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1e-6;
    dense[i].tx = dx / len;
    dense[i].ty = dy / len;
  }

  // Cumulative arc length -> normalized position u, for even-speed sampling.
  let acc = 0;
  dense[0].s = 0;
  for (let i = 1; i < dense.length; i++) {
    acc += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
    dense[i].s = acc;
  }
  dense.forEach((p) => { p.u = p.s / acc; });
  return dense;
}

const RIVER_PATH = buildRiverPath(RIVER_CONTROLS, 28);

/** Sample the river at normalized position u (0 = cave mouth, 1 = foreground). */
function sampleRiver(u: number) {
  const uu = Math.max(0, Math.min(1, u));
  const d = RIVER_PATH;
  let idx = Math.floor(uu * (d.length - 1));
  idx = Math.max(0, Math.min(d.length - 2, idx));
  const localT = uu * (d.length - 1) - idx;
  const a = d[idx];
  const b = d[idx + 1];
  const x = a.x + (b.x - a.x) * localT;
  const y = a.y + (b.y - a.y) * localT;
  const w = a.w + (b.w - a.w) * localT;
  const tx = a.tx + (b.tx - a.tx) * localT;
  const ty = a.ty + (b.ty - a.ty) * localT;
  // Continuity of flow, as in real hydraulics: narrower channel -> faster,
  // more turbulent water.
  const turbulence = Math.max(0, 1 - w);
  const speedMul = 0.55 + turbulence * 1.65; // calm wide sections slow, bends fast
  return { x, y, w, tx, ty, turbulence, speedMul };
}

// ─── Deterministic particle pools ──────────────────────────────────────────

type FlowGlint = { u: number; side: number; phase: number; lenBase: number };
type MoonGlint = { u: number; side: number; phase: number; phase2: number; driftSpeed: number };
type FogPuff = { x: number; y: number; vx: number; alpha: number; w: number; phase: number };
type Branch = {
  px: number; py: number; len: number; baseRot: number;
  f1: number; f2: number; amp: number; phase: number;
};
type MistWisp = { ox: number; oy: number; r: number; period: number; phase: number; warm: boolean };

const FLOW_COUNT = 46;
function makeFlowGlints(): FlowGlint[] {
  return Array.from({ length: FLOW_COUNT }, (_, i) => ({
    u: i / FLOW_COUNT,
    side: ((i % 7) - 3) / 3.2, // lateral offset across channel width
    phase: i * 1.37,
    lenBase: 0.010 + (i % 5) * 0.004,
  }));
}

const MOON_GLINT_COUNT = 9;
function makeMoonGlints(): MoonGlint[] {
  return Array.from({ length: MOON_GLINT_COUNT }, (_, i) => ({
    u: 0.08 + (i / MOON_GLINT_COUNT) * 0.86,
    side: ((i % 5) - 2) / 2.6,
    phase: i * 2.19,
    phase2: i * 0.73,
    driftSpeed: 0.0000022 + (i % 3) * 0.0000012,
  }));
}

/**
 * Tiny deterministic PRNG (mulberry32) so the fog layout is stable across
 * mounts without mutating the global `Math.random`, unlike the standalone
 * prototype (which could safely monkey-patch it in an isolated page scope).
 */
function mulberry32(seed: number) {
  let s = seed;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeFogLayer(
  rand: () => number,
  count: number,
  yRange: [number, number],
  speedRange: [number, number],
  alphaRange: [number, number],
  sizeRange: [number, number],
): FogPuff[] {
  return Array.from({ length: count }, () => ({
    x: rand() * 1.6 - 0.3,
    y: yRange[0] + rand() * (yRange[1] - yRange[0]),
    vx: speedRange[0] + rand() * (speedRange[1] - speedRange[0]),
    alpha: alphaRange[0] + rand() * (alphaRange[1] - alphaRange[0]),
    w: sizeRange[0] + rand() * (sizeRange[1] - sizeRange[0]),
    phase: rand() * 10,
  }));
}

function makeFogLayers() {
  const rand = mulberry32(42);
  return {
    // Distant horizon wisps, mid-depth bank fog, near-foreground ground mist —
    // three bands drifting at different speeds/opacities for parallax depth.
    distant: makeFogLayer(rand, 5, [0.28, 0.40], [0.0000035, 0.0000065], [0.025, 0.045], [0.34, 0.52]),
    mid: makeFogLayer(rand, 5, [0.46, 0.60], [0.0000070, 0.0000120], [0.035, 0.060], [0.30, 0.46]),
    near: makeFogLayer(rand, 4, [0.78, 0.95], [0.0000140, 0.0000220], [0.055, 0.095], [0.34, 0.54]),
  };
}

// Branch anchors near the owl's perch (top-left foliage), each swaying on two
// slow incommensurate frequencies so the group never settles into a visible
// repeating loop.
const BRANCHES: Branch[] = [
  { px: 0.025, py: 0.035, len: 0.095, baseRot: 1.95, f1: 0.000071, f2: 0.000133, amp: 3.2, phase: 0.4 },
  { px: 0.050, py: 0.015, len: 0.070, baseRot: 2.25, f1: 0.000084, f2: 0.000119, amp: 2.6, phase: 2.1 },
  { px: 0.010, py: 0.090, len: 0.080, baseRot: 1.55, f1: 0.000063, f2: 0.000147, amp: 3.6, phase: 4.0 },
  { px: 0.000, py: 0.190, len: 0.110, baseRot: 1.15, f1: 0.000077, f2: 0.000101, amp: 2.4, phase: 1.3 },
  { px: 0.015, py: 0.260, len: 0.065, baseRot: 0.85, f1: 0.000069, f2: 0.000156, amp: 3.0, phase: 5.2 },
];

// Warm/cool wisps breathing near the cave mouth to suggest depth.
const CAVE_MIST_WISPS: MistWisp[] = [
  { ox: -0.012, oy: 0.006, r: 0.052, period: 7400, phase: 0.0, warm: true },
  { ox: 0.010, oy: -0.010, r: 0.038, period: 9200, phase: 2.3, warm: true },
  { ox: -0.004, oy: 0.022, r: 0.030, period: 6100, phase: 4.1, warm: false },
  { ox: 0.018, oy: 0.012, r: 0.044, period: 8300, phase: 1.2, warm: false },
];

// ─── Per-effect renderers ─────────────────────────────────────────────────

function renderRiver(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, t: number, dt: number,
  glints: FlowGlint[],
) {
  const d = RIVER_PATH;

  // Riverbed ribbon — subtle depth shading that follows the spline exactly,
  // rather than a straight horizontal band.
  ctx.save();
  ctx.beginPath();
  const leftEdge: { x: number; y: number }[] = [];
  const rightEdge: { x: number; y: number }[] = [];
  for (let i = 0; i < d.length; i++) {
    const p = d[i];
    const nx = -p.ty;
    const ny = p.tx;
    const halfW = (0.014 + p.w * 0.020) * h;
    leftEdge.push({ x: p.x * w + nx * halfW, y: p.y * h + ny * halfW });
    rightEdge.push({ x: p.x * w - nx * halfW, y: p.y * h - ny * halfW });
  }
  ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
  for (let i = 1; i < leftEdge.length; i++) ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
  for (let i = rightEdge.length - 1; i >= 0; i--) ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
  ctx.closePath();
  const shimmer = 0.5 + Math.sin(t * 0.00032) * 0.5;
  const grad = ctx.createLinearGradient(0, d[0].y * h, 0, d[d.length - 1].y * h);
  grad.addColorStop(0, `rgba(70,140,185,${0.05 + shimmer * 0.02})`);
  grad.addColorStop(0.5, `rgba(55,120,165,${0.07 + shimmer * 0.03})`);
  grad.addColorStop(1, `rgba(35,90,135,0.06)`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Flowing current glints — travel along the path; local channel width sets
  // speed (slow in wide calm pools, fast + turbulent at narrow bends), and
  // surface-ripple texture via length/alpha tied to turbulence.
  glints.forEach((g) => {
    const sample = sampleRiver(g.u);
    const speedBase = 0.000016; // relative-u per ms at speedMul = 1
    g.u += speedBase * sample.speedMul * dt;
    if (g.u > 1) g.u -= 1;

    const s = sampleRiver(g.u);
    const nx = -s.ty;
    const ny = s.tx;
    const lateral = g.side * (0.010 + s.w * 0.012);
    const px = (s.x + nx * lateral) * w;
    const py = (s.y + ny * lateral) * h;

    const flicker = 0.4 + Math.sin(t * 0.0024 + g.phase + s.turbulence * 6) * 0.35;
    const alpha = Math.max(0, (0.20 + s.turbulence * 0.45) * flicker);
    const len = (g.lenBase + s.turbulence * 0.014) * Math.max(w, h);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(s.ty, s.tx));
    const streak = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    streak.addColorStop(0, "rgba(150,205,240,0)");
    streak.addColorStop(0.5, `rgba(185,225,250,${alpha})`);
    streak.addColorStop(1, "rgba(150,205,240,0)");
    ctx.fillStyle = streak;
    ctx.fillRect(-len / 2, -0.9, len, 1.8 + s.turbulence * 1.4);
    ctx.restore();
  });
}

function renderMoonlight(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, t: number, dt: number,
  glints: MoonGlint[],
) {
  glints.forEach((g) => {
    g.u += g.driftSpeed * dt; // reflections creep slowly along the current
    if (g.u > 0.96) g.u = 0.06;

    const s = sampleRiver(g.u);
    const nx = -s.ty;
    const ny = s.tx;
    const lateral = g.side * (0.009 + s.w * 0.010);
    const px = (s.x + nx * lateral) * w;
    const py = (s.y + ny * lateral) * h;

    // Two incommensurate slow oscillators so shape/opacity never settle into
    // an obvious repeating loop.
    const osc1 = Math.sin(t * 0.000081 + g.phase);
    const osc2 = Math.sin(t * 0.000137 + g.phase2);
    const breathe = 0.30 + (osc1 * 0.55 + osc2 * 0.45) * 0.22;
    if (breathe <= 0.02) return;

    const rx = (0.016 + s.w * 0.012) * w * (0.75 + osc2 * 0.3);
    const ry = rx * (0.28 + osc1 * 0.10);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(s.ty, s.tx));
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    glow.addColorStop(0, `rgba(226,240,255,${breathe * 0.85})`);
    glow.addColorStop(0.45, `rgba(200,224,252,${breathe * 0.38})`);
    glow.addColorStop(1, "rgba(190,215,250,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function renderFogLayer(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, t: number, dt: number,
  layer: FogPuff[], depthTint: string,
) {
  layer.forEach((p) => {
    p.x += p.vx * dt;
    if (p.x > 1.5) p.x = -0.5;
    const breathe = p.alpha * (0.7 + Math.sin(t * 0.00014 + p.phase) * 0.3);
    const cx = p.x * w;
    const cy = (p.y + Math.sin(t * 0.00009 + p.phase) * 0.01) * h;
    const rw = p.w * w;
    const rh = rw * 0.22;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw);
    g.addColorStop(0, `rgba(${depthTint},${breathe})`);
    g.addColorStop(0.5, `rgba(${depthTint},${breathe * 0.55})`);
    g.addColorStop(1, `rgba(${depthTint},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderFog(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, t: number, dt: number,
  layers: { distant: FogPuff[]; mid: FogPuff[]; near: FogPuff[] },
) {
  renderFogLayer(ctx, w, h, t, dt, layers.distant, "215,228,248");
  renderFogLayer(ctx, w, h, t, dt, layers.mid, "208,224,248");
  renderFogLayer(ctx, w, h, t, dt, layers.near, "198,216,244");
}

function renderLeaves(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  BRANCHES.forEach((b) => {
    const osc1 = Math.sin(t * b.f1 + b.phase);
    const osc2 = Math.sin(t * b.f2 + b.phase * 1.6);
    const swayDeg = (osc1 * 0.65 + osc2 * 0.35) * b.amp;
    const rot = b.baseRot + (swayDeg * Math.PI) / 180;

    const px = b.px * w;
    const py = b.py * h;
    const len = b.len * Math.min(w, h) * 1.6;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.strokeStyle = "rgba(6,8,14,0.55)";
    ctx.lineWidth = Math.max(1, len * 0.018);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, len * 0.12);
    ctx.stroke();

    // A few leaf clusters along the branch, each with slight independent
    // flutter so the group never reads as one rigid piece.
    for (let k = 1; k <= 3; k++) {
      const lt = k / 3.4;
      const lx = len * lt;
      const ly = len * 0.12 * lt;
      const flutter = Math.sin(t * (b.f1 * 1.8) + b.phase + k * 1.7) * 4 * (Math.PI / 180);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(0.5 + flutter);
      ctx.fillStyle = "rgba(5,7,12,0.50)";
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.065, len * 0.022, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });
}

function renderCaveMist(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = CAVE_MOUTH.x * w;
  const cy = CAVE_MOUTH.y * h;
  CAVE_MIST_WISPS.forEach((wisp) => {
    const cyclePos = (t % wisp.period) / wisp.period;
    const pulse = 0.5 + Math.sin(cyclePos * Math.PI * 2 + wisp.phase) * 0.5;
    const drift = Math.sin(t * 0.00006 + wisp.phase) * 0.012;
    const x = cx + (wisp.ox + drift) * w;
    const y = cy + wisp.oy * h - pulse * 0.01 * h;
    const r = wisp.r * Math.min(w, h) * (0.85 + pulse * 0.3);
    const alpha = 0.10 + pulse * 0.16;
    const color = wisp.warm ? "244,214,160" : "214,228,248";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(0.5, `rgba(${color},${alpha * 0.45})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Component ────────────────────────────────────────────────────────────

export function OwlValleyRiverPreview({ isReducedMotion = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number>(0);

  const isReducedMotionRef = useRef(isReducedMotion);
  isReducedMotionRef.current = isReducedMotion; // always current without restarting the loop

  const flowGlints = useRef(makeFlowGlints());
  const moonGlints  = useRef(makeMoonGlints());
  const fogLayers   = useRef(makeFogLayers());

  useEffect(() => {
    const container = containerRef.current;
    const canvas     = canvasRef.current;
    const ctx        = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Simulated time: advances at full speed normally; when isReducedMotion
    // is true it advances at ~3.5% speed, drastically slowing all ambient
    // motion rather than hard-freezing it (models adding prefers-reduced-motion
    // support, which the live app does not currently have).
    let simTime  = 0;
    let lastSim  = 0;
    let lastReal = performance.now();

    const draw = (nowReal: number) => {
      const dtReal = Math.min(64, nowReal - lastReal);
      lastReal = nowReal;
      const scale = isReducedMotionRef.current ? 0.035 : 1;
      simTime += dtReal * scale;
      const t  = simTime;
      const dt = Math.max(0, t - lastSim);
      lastSim  = t;

      ctx.clearRect(0, 0, w, h);

      // Render order: fog (farthest) → river current → moonlight reflections
      // → cave mist → foliage sway (nearest, over the owl's perch).
      renderFog(ctx, w, h, t, dt, fogLayers.current);
      renderRiver(ctx, w, h, t, dt, flowGlints.current);
      renderMoonlight(ctx, w, h, t, dt, moonGlints.current);
      renderCaveMist(ctx, w, h, t);
      renderLeaves(ctx, w, h, t);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 960,
        aspectRatio: "3 / 2", // matches the native 1536x1024 Owl Valley asset
        margin: "0 auto",
        overflow: "hidden",
        borderRadius: 10,
        background: "#000",
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(160,195,235,0.10)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${BACKGROUNDS.Owl}")`,
          backgroundSize: "cover",
          backgroundPosition: "left center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          display: "block",
        }}
      />
    </div>
  );
}
