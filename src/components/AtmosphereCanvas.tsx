import { useEffect, useMemo, useRef } from "react";
import {
  resolveAnchor,
  resolveCoverFrame,
  projectImagePoint,
  TURTLE_ANCHOR,
  OWL_ANCHOR,
  FOX_ANCHOR,
} from "../lib/presenceAnchor";
import {
  buildRiverPath,
  sampleRiver,
  advanceAlongRiver,
  riverVisibility,
  RIVER_VISIBILITY_THRESHOLD,
  type RiverGeometry,
  type RiverPath,
} from "../lib/riverFlow";

export type EffectType =
  | "clouds"
  | "leaves"
  | "river"
  | "fireflies"
  | "fog"
  | "turtle-presence"   // moonlight glow + shell shimmer (Turtle scene)
  | "owl-presence"      // atmospheric glow + periodic eye glint (Owl scene)
  | "fox-presence";     // warm dawn rim-glow over the background fox (Fox scene)

// ─── Particle types ───────────────────────────────────────────────────────────

type Cloud = {
  x: number; y: number;
  rx: number; ry: number;
  vx: number;
  alpha: number;
};

type Leaf = {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; rotV: number;
  sway: number; swayFreq: number; phase: number;
  size: number; alpha: number;
  hue: number;
};

type Streak = {
  x: number; y: number;
  len: number; alpha: number;
  speed: number; phase: number;
};

type Glint = {
  /** Normalised position along the river's arc length, 0..1. */
  u: number;
  /** Across-channel offset, -1 (left bank) .. 1 (right bank). */
  lateral: number;
  len: number; alpha: number;
  phase: number;
  /** Arc-length units per millisecond, before the channel's speedMul. */
  speed: number;
};

type Firefly = {
  x: number; y: number;
  dx: number; dy: number;
  r: number; pulseSpeed: number; phase: number;
};

type FogPatch = {
  x: number; y: number;
  w: number; h: number;
  vx: number;
  alpha: number;
  phase: number;
};

// ─── Deterministic particle pools ─────────────────────────────────────────────

function makeClouds(): Cloud[] {
  return [
    { x: 0.08, y: 0.05, rx: 0.20, ry: 0.055, vx: 0.000030, alpha: 0.072 },
    { x: 0.32, y: 0.11, rx: 0.25, ry: 0.072, vx: 0.000048, alpha: 0.088 },
    { x: 0.58, y: 0.04, rx: 0.18, ry: 0.045, vx: 0.000042, alpha: 0.062 },
    { x: 0.76, y: 0.09, rx: 0.22, ry: 0.062, vx: 0.000035, alpha: 0.080 },
    { x: -0.12, y: 0.14, rx: 0.26, ry: 0.065, vx: 0.000055, alpha: 0.070 },
    { x: 0.48, y: 0.19, rx: 0.20, ry: 0.052, vx: 0.000038, alpha: 0.055 },
    { x: 0.90, y: 0.07, rx: 0.17, ry: 0.048, vx: 0.000028, alpha: 0.065 },
  ];
}

/**
 * Vertical band leaves are allowed to occupy, as a fraction of the viewport.
 *
 * Starts below the skyline on every plate in the app. Above this is open sky
 * or distant ridge, where a drifting leaf has nothing to have fallen from.
 */
const LEAF_TOP = 0.22;
const LEAF_SPAN = 1.06 - LEAF_TOP;

function makeLeaves(): Leaf[] {
  const seeds: [number, number, number, number][] = [
    [0.12, 0.18, 3, 90], [0.32, 0.48, 4, 130], [0.51, 0.14, 2, 80],
    [0.70, 0.33, 5, 110], [0.21, 0.68, 3, 95], [0.82, 0.57, 4, 120],
    [0.43, 0.38, 2, 75], [0.63, 0.76, 5, 140], [0.90, 0.24, 3, 88],
    [0.07, 0.52, 4, 105], [0.45, 0.87, 2, 82], [0.74, 0.08, 5, 125],
    [0.56, 0.54, 3, 100], [0.17, 0.82, 4, 115], [0.84, 0.41, 2, 78],
    [0.27, 0.29, 5, 135], [0.66, 0.63, 3, 92], [0.37, 0.73, 4, 108],
    [0.93, 0.48, 2, 86], [0.11, 0.44, 5, 118], [0.42, 0.22, 3, 97],
    [0.87, 0.73, 4, 112], [0.19, 0.60, 2, 84], [0.72, 0.44, 5, 122],
    [0.53, 0.31, 3, 103],
  ];
  return seeds.map(([x, y, size, hue], i) => ({
    x,
    // Seeds are authored as 0..1 for readability, then compressed into the
    // canopy band so none of them start life in open sky.
    y: LEAF_TOP + y * LEAF_SPAN,
    vx: -(0.00038 + (i % 5) * 0.00009),
    vy:  0.00018 + (i % 4) * 0.00005,
    rot: i * 0.72,
    rotV: (i % 2 === 0 ? 1 : -1) * (0.009 + (i % 5) * 0.0018),
    sway: 0.009 + (i % 6) * 0.0018,
    swayFreq: 0.00055 + (i % 5) * 0.00018,
    phase: i * 1.31,
    size,
    alpha: 0.38 + (i % 4) * 0.09,
    hue,
  }));
}

function makeStreaks(): Streak[] {
  return Array.from({ length: 48 }, (_, i) => {
    const row = Math.floor(i / 6);
    return {
      x: ((i % 6) / 6 + (row % 2) * 0.08) % 1,
      y: 0.60 + row * 0.052,
      len: 0.038 + (i % 7) * 0.014,
      alpha: 0.042 + (i % 5) * 0.014,
      speed: 0.00048 + (i % 4) * 0.00018,
      phase: i * 0.87,
    };
  });
}

/**
 * Glints for the spline river.
 *
 * `u` is a position along the river's arc length, not a screen coordinate, so
 * a glint stays on the water at any viewport. `lateral` spreads it across the
 * channel: all glints on the centre line would read as a single seam rather
 * than as a surface.
 */
function makeGlints(): Glint[] {
  return Array.from({ length: 54 }, (_, i) => ({
    // Golden-ratio spacing distributes the pool along the river without the
    // banding a simple i/n would produce once speedMul starts compressing
    // them through the narrow stretches.
    u: (i * 0.6180339887) % 1,
    lateral: ((i % 7) / 6) * 2 - 1,
    len: 0.016 + (i % 5) * 0.009,
    alpha: 0.055 + (i % 6) * 0.022,
    phase: i * 0.83,
    speed: 0.000026 + (i % 4) * 0.0000085,
  }));
}

function makeFireflies(): Firefly[] {
  const pts: [number, number][] = [
    [0.12, 0.40], [0.28, 0.55], [0.45, 0.38], [0.62, 0.48], [0.78, 0.42],
    [0.18, 0.65], [0.38, 0.72], [0.55, 0.60], [0.72, 0.68], [0.88, 0.52],
    [0.08, 0.78], [0.32, 0.35], [0.50, 0.82], [0.68, 0.30], [0.85, 0.75],
    [0.22, 0.48], [0.42, 0.58], [0.58, 0.45], [0.75, 0.62], [0.92, 0.40],
    [0.15, 0.52], [0.35, 0.42], [0.65, 0.75], [0.82, 0.58], [0.48, 0.25],
  ];
  return pts.map(([x, y], i) => ({
    x, y,
    dx: 15 + (i % 6) * 8,
    dy:  8 + (i % 5) * 5,
    r: 1.2 + (i % 3) * 0.55,
    pulseSpeed: 0.00048 + (i % 5) * 0.00022,
    phase: i * 1.71,
  }));
}

function makeFog(): FogPatch[] {
  return [
    // Horizon wisps
    { x: -0.20, y: 0.40, w: 0.72, h: 0.18, vx: 0.000018, alpha: 0.048, phase: 0.0 },
    { x:  0.38, y: 0.36, w: 0.82, h: 0.22, vx: 0.000012, alpha: 0.042, phase: 2.1 },
    { x:  0.85, y: 0.44, w: 0.62, h: 0.16, vx: 0.000022, alpha: 0.038, phase: 4.3 },
    // Ground mist
    { x: -0.10, y: 0.66, w: 0.58, h: 0.22, vx: 0.000015, alpha: 0.055, phase: 1.5 },
    { x:  0.32, y: 0.70, w: 0.68, h: 0.26, vx: 0.000010, alpha: 0.050, phase: 3.7 },
    { x:  0.78, y: 0.63, w: 0.52, h: 0.20, vx: 0.000020, alpha: 0.040, phase: 5.9 },
    // High thin atmosphere
    { x:  0.12, y: 0.26, w: 0.42, h: 0.10, vx: 0.000025, alpha: 0.026, phase: 0.8 },
    { x:  0.58, y: 0.30, w: 0.48, h: 0.12, vx: 0.000016, alpha: 0.024, phase: 2.6 },
  ];
}

// ─── Per-effect renderers ─────────────────────────────────────────────────────

function renderClouds(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  clouds: Cloud[],
) {
  clouds.forEach((c) => {
    c.x += c.vx * 16;
    if (c.x > 1.5) c.x = -0.45;

    const cx = c.x * w;
    const cy = c.y * h + Math.sin(t * 0.00018 + c.rx * 9) * 4;
    const rx = c.rx * w;
    const ry = c.ry * h;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0,    `rgba(210, 228, 255, ${c.alpha})`);
    g.addColorStop(0.55, `rgba(195, 218, 255, ${c.alpha * 0.48})`);
    g.addColorStop(1,    `rgba(195, 218, 255, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    const g2 = ctx.createRadialGradient(cx - rx * 0.28, cy - ry * 0.22, 0, cx - rx * 0.28, cy - ry * 0.22, rx * 0.58);
    g2.addColorStop(0, `rgba(225, 240, 255, ${c.alpha * 0.75})`);
    g2.addColorStop(1, `rgba(225, 240, 255, 0)`);
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.28, cy - ry * 0.22, rx * 0.58, ry * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderLeaves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  leaves: Leaf[],
) {
  leaves.forEach((l) => {
    l.x += l.vx + Math.sin(t * l.swayFreq + l.phase) * l.sway * 0.012;
    l.y += l.vy + Math.cos(t * l.swayFreq * 0.65 + l.phase) * 0.00012;
    l.rot += l.rotV;

    // Leaves live in the canopy and below, never in open sky. Previously they
    // wrapped through the full 0..1 height, which sent them drifting across
    // the moon and the horizon — foliage floating through empty air reads as
    // debris on the lens and breaks the one illusion these scenes depend on.
    if (l.x < -0.06) { l.x = 1.06; l.y = LEAF_TOP + ((l.y + 0.15) % LEAF_SPAN); }
    if (l.y >  1.06) { l.y = LEAF_TOP; l.x = (l.x + 0.25) % 1.0; }

    const lx = l.x * w;
    const ly = l.y * h;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(l.rot);
    ctx.globalAlpha = l.alpha * (0.7 + Math.sin(t * l.swayFreq + l.phase) * 0.3);
    ctx.fillStyle = `hsl(${l.hue}, 55%, 28%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, l.size * 0.55, l.size * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `hsla(${l.hue + 15}, 60%, 50%, 0.35)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -l.size * 1.4);
    ctx.lineTo(0,  l.size * 1.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

/**
 * River that follows the water painted into the plate.
 *
 * The band renderer below fills the bottom 40% of the viewport and slides
 * streaks left-to-right across it. Every river in this app is a winding
 * diagonal, so that current visibly flows ACROSS the painting instead of
 * along it. This version projects a traced centre line through the same
 * cover-crop geometry the background uses, so the motion runs downstream at
 * every viewport size.
 *
 * `dtMs` rather than a fixed per-frame step: glint speed varies with channel
 * width, and a fixed step would make the whole river run faster on a 120Hz
 * display than on a 60Hz one.
 */
function renderSplineRiver(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  dtMs: number,
  geometry: RiverGeometry,
  path: RiverPath,
  glints: Glint[],
) {
  const frame = resolveCoverFrame(
    geometry.imageW,
    geometry.imageH,
    geometry.align,
    w,
    h,
  );

  // `cover` scales both axes equally, so a unit vector in image space is
  // still a unit vector on screen. That is what lets the traced tangents be
  // used directly below without re-deriving them per viewport.

  // ── Sheen along the channel ──────────────────────────────────────────────
  // A ribbon traced from the river's own banks, not a rectangle. Kept very
  // low contrast: the water is already painted, this only has to make it
  // look wet.
  const RIBBON_STEPS = 48;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let i = 0; i <= RIBBON_STEPS; i++) {
    const s = sampleRiver(path, i / RIBBON_STEPS);
    // Normal to the downstream tangent.
    const nx = -s.ty;
    const ny = s.tx;
    const hw = s.w / 2;
    left.push(projectImagePoint(frame, s.x + nx * hw, s.y + ny * hw));
    right.push(projectImagePoint(frame, s.x - nx * hw, s.y - ny * hw));
  }

  const head = projectImagePoint(frame, path.samples[0].x, path.samples[0].y);
  const mouthSample = path.samples[path.samples.length - 1];
  const mouth = projectImagePoint(frame, mouthSample.x, mouthSample.y);

  const breathe = 0.016 + Math.sin(t * 0.00075) * 0.005;
  const sheen = ctx.createLinearGradient(head.x, head.y, mouth.x, mouth.y);
  sheen.addColorStop(0, "rgba(120, 180, 215, 0)");
  sheen.addColorStop(0.3, `rgba(110, 175, 212, ${breathe * 0.8})`);
  sheen.addColorStop(0.7, `rgba(95, 155, 196, ${breathe * 1.25})`);
  sheen.addColorStop(1, `rgba(70, 120, 162, ${breathe * 0.7})`);

  ctx.beginPath();
  left.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fillStyle = sheen;
  ctx.fill();

  // ── Glints carried by the current ────────────────────────────────────────
  ctx.save();
  // Clipped to the channel so a glint riding the outer edge of a tight bend
  // cannot stray onto the bank.
  ctx.clip();

  glints.forEach((g) => {
    g.u = advanceAlongRiver(path, g.u, dtMs, g.speed);

    const s = sampleRiver(path, g.u);
    const nx = -s.ty;
    const ny = s.tx;
    // Pulled in from the banks: the very edge is shallow and broken, and a
    // clean highlight there reads as a hard outline rather than as water.
    const off = g.lateral * (s.w / 2) * 0.72;
    const c = projectImagePoint(frame, s.x + nx * off, s.y + ny * off);

    // Longer and brighter in fast, narrow water; shorter in the calm pools.
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
    // Scaled off the channel so highlights stay proportional to the water,
    // then clamped: a hairline disappears, and anything thick reads as foam.
    ctx.lineWidth = Math.max(1, Math.min(2.8, s.w * frame.dw * 0.05));
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(c.x - hx, c.y - hy);
    ctx.lineTo(c.x + hx, c.y + hy);
    ctx.stroke();
  });

  ctx.restore();
}

function renderRiver(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  streaks: Streak[],
) {
  const shimmerBase = 0.018 + Math.sin(t * 0.00075) * 0.006;
  const area = ctx.createLinearGradient(0, h * 0.60, 0, h);
  area.addColorStop(0,    `rgba(50, 140, 180, 0)`);
  area.addColorStop(0.28, `rgba(60, 160, 200, ${shimmerBase})`);
  area.addColorStop(0.65, `rgba(45, 130, 170, ${shimmerBase * 1.4})`);
  area.addColorStop(1,    `rgba(30,  90, 130, ${shimmerBase * 0.6})`);
  ctx.fillStyle = area;
  ctx.fillRect(0, h * 0.60, w, h * 0.40);

  streaks.forEach((s) => {
    s.x += s.speed * 16;
    if (s.x > 1.12) s.x = -0.12;

    const shimmer = 0.38 + Math.sin(t * 0.0019 + s.phase) * 0.32;
    const sx = s.x * w;
    const sy = s.y * h + Math.sin(t * 0.00088 + s.phase * 2.1) * 5;
    const len = s.len * w;

    const sg = ctx.createLinearGradient(sx, sy, sx + len, sy);
    sg.addColorStop(0,    `rgba(120, 200, 235, 0)`);
    sg.addColorStop(0.35, `rgba(150, 220, 250, ${s.alpha * shimmer})`);
    sg.addColorStop(0.65, `rgba(170, 230, 255, ${s.alpha * shimmer})`);
    sg.addColorStop(1,    `rgba(120, 200, 235, 0)`);
    ctx.fillStyle = sg;
    ctx.fillRect(sx, sy, len, 1.8);
  });
}

function renderFireflies(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  flies: Firefly[],
) {
  flies.forEach((f) => {
    const pulse = 0.38 + Math.sin(t * f.pulseSpeed + f.phase) * 0.42;
    const x = f.x * w + Math.sin(t * 0.00028 + f.phase) * f.dx;
    const y = f.y * h + Math.cos(t * 0.00020 + f.phase) * f.dy;

    const glow = ctx.createRadialGradient(x, y, 0, x, y, 22);
    glow.addColorStop(0,    `rgba(215, 255, 140, ${0.38 * pulse})`);
    glow.addColorStop(0.28, `rgba(160, 235, 100, ${0.16 * pulse})`);
    glow.addColorStop(1,    `rgba(160, 235, 100, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(242, 255, 188, ${0.78 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y, f.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderFog(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  patches: FogPatch[],
) {
  patches.forEach((p) => {
    p.x += p.vx;
    // Wrap once the patch's trailing edge has actually left the frame, and
    // re-enter by its own width. The old fixed 1.6 / -0.9 pair ignored `w`,
    // so the widest bank vanished while still half on screen and the
    // narrowest waited offscreen before returning — a visible pop in the one
    // layer whose whole job is to be imperceptible.
    if (p.x > 1 + p.w) p.x = -p.w;

    const breathe = p.alpha * (0.62 + Math.sin(t * 0.00016 + p.phase) * 0.38);
    const cx = (p.x + p.w / 2) * w;
    const cy = (p.y + p.h / 2) * h + Math.sin(t * 0.000092 + p.phase) * 14;
    const rw = (p.w / 2) * w;
    const rh = (p.h / 2) * h;
    const radius = Math.max(rw, rh);

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0,   `rgba(228, 240, 255, ${breathe})`);
    g.addColorStop(0.4, `rgba(218, 234, 252, ${breathe * 0.58})`);
    g.addColorStop(1,   `rgba(208, 226, 248, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Character presence renderers ─────────────────────────────────────────────

/**
 * Turtle presence — moonlight glow pulse + shell shimmer.
 * Positioned lower-center where the turtle silhouette sits in the background.
 * All motion is extremely subtle — cinematic, not animated.
 */
function renderTurtlePresence(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  // Turtle sits low in the moonlit river scene. Anchored in image space so the
  // glow stays on the shell at any viewport — see resolveAnchor.
  const { x: ox, y: oy, visible } = resolveAnchor(TURTLE_ANCHOR, w, h);
  // The subject is cropped out of this viewport; lighting it would put
  // a glow on empty scenery. See ResolvedAnchor.visible.
  if (!visible) return;

  // Soft moonlight halo — slow breathing pulse (28-second period)
  const moonPulse = 0.055 + Math.sin(t * 0.00022) * 0.022;
  const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.30);
  halo.addColorStop(0,   `rgba(185, 220, 255, ${moonPulse})`);
  halo.addColorStop(0.4, `rgba(165, 205, 250, ${moonPulse * 0.50})`);
  halo.addColorStop(0.8, `rgba(150, 192, 242, ${moonPulse * 0.18})`);
  halo.addColorStop(1,   'rgba(140, 182, 235, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(ox, oy, w * 0.30, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shell shimmer — a few moonlit horizontal glints on the shell surface
  const shimmerY = oy - h * 0.025;
  for (let i = 0; i < 5; i++) {
    const sx  = ox - w * 0.075 + (i / 5) * w * 0.15;
    const sy  = shimmerY + (i % 2) * h * 0.018;
    const sa  = (0.10 + Math.sin(t * 0.00055 + i * 1.85) * 0.06) * 0.7;
    const len = w * (0.022 + (i % 3) * 0.010);

    const sg = ctx.createLinearGradient(sx, sy, sx + len, sy);
    sg.addColorStop(0,   'rgba(210, 240, 255, 0)');
    sg.addColorStop(0.5, `rgba(225, 248, 255, ${sa})`);
    sg.addColorStop(1,   'rgba(210, 240, 255, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, sy, len, 1.4);
  }

  // Water reflection beneath — faint ripple echoing the moonlight
  const reflAlpha = 0.028 + Math.sin(t * 0.00038 + 1.2) * 0.012;
  const refl = ctx.createLinearGradient(0, oy + h * 0.01, 0, oy + h * 0.06);
  refl.addColorStop(0, `rgba(180, 215, 255, ${reflAlpha})`);
  refl.addColorStop(1, 'rgba(160, 200, 250, 0)');
  ctx.fillStyle = refl;
  ctx.beginPath();
  ctx.ellipse(ox, oy + h * 0.035, w * 0.12, h * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Owl presence — atmospheric glow around perch + periodic eye glint.
 * The owl silhouette is in the upper-left of the valley scene.
 * The eye glint appears briefly every ~10 seconds — almost subliminal.
 */
function renderOwlPresence(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  // Owl perch — anchored in image space against the scene's "left center"
  // crop, so the glow and the eye glint stay on the bird at any viewport.
  const { x: ox, y: oy, visible } = resolveAnchor(OWL_ANCHOR, w, h);
  // The subject is cropped out of this viewport; lighting it would put
  // a glow on empty scenery. See ResolvedAnchor.visible.
  if (!visible) return;

  // Soft atmospheric presence (very dim, slow breathing)
  const atmosAlpha = 0.030 + Math.sin(t * 0.00018) * 0.012;
  const atmos = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.24);
  atmos.addColorStop(0,   `rgba(155, 192, 242, ${atmosAlpha})`);
  atmos.addColorStop(0.5, `rgba(145, 182, 235, ${atmosAlpha * 0.42})`);
  atmos.addColorStop(1,   'rgba(135, 172, 228, 0)');
  ctx.fillStyle = atmos;
  ctx.beginPath();
  ctx.ellipse(ox, oy, w * 0.24, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye glint — the owl's eye catches the moonlight briefly
  // Appears once per ~10-second cycle, lasts ~1 second
  const eyeX = ox + w * 0.110;
  const eyeY = oy - h * 0.060;
  const cycle  = (t * 0.000060) % (Math.PI * 2);       // ~10.5s period
  const raw    = Math.sin(cycle);
  // Only visible at the very peak of the cycle — brief and subtle
  const glintAlpha = raw > 0.94 ? (raw - 0.94) / 0.06 * 0.72 : 0;

  if (glintAlpha > 0.01) {
    // Soft amber eye glow
    const eyeGrd = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 14);
    eyeGrd.addColorStop(0,   `rgba(248, 228, 165, ${glintAlpha * 0.55})`);
    eyeGrd.addColorStop(0.4, `rgba(230, 210, 148, ${glintAlpha * 0.22})`);
    eyeGrd.addColorStop(1,   'rgba(215, 195, 130, 0)');
    ctx.fillStyle = eyeGrd;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Bright glint point — tiny specular highlight
    ctx.fillStyle = `rgba(255, 248, 228, ${glintAlpha * 0.90})`;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Fox presence — warm dawn rim-glow over the fox already in the background.
 *
 * IMPORTANT: bg-fox.png.jpeg ALREADY CONTAINS a photoreal fox, standing on the
 * rock shelf on the right-hand side of the valley. An earlier version of this
 * function drew a second, hand-drawn fox silhouette on the canvas, which
 * produced two foxes on screen at once on any viewport wide enough to show the
 * background one. It also read as illustrated rather than photoreal, which is
 * off-direction for this app.
 *
 * This renderer therefore draws NO animal. Like renderTurtlePresence and
 * renderOwlPresence, it only adds light to the creature that is already in the
 * plate: a slow dawn halo and a faint rim catch along the cliff edge.
 *
 * Position comes from FOX_ANCHOR, which is in image space, so it tracks the
 * fox across viewports. The scene also needs bgPosition:"right center" in
 * App.tsx — the fox lives near the right edge of the plate and a centered
 * cover-crop removes it entirely on portrait, the same trap the owl hit.
 */
function renderFoxPresence(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  const { x: ox, y: oy, visible } = resolveAnchor(FOX_ANCHOR, w, h);
  // The subject is cropped out of this viewport; lighting it would put
  // a glow on empty scenery. See ResolvedAnchor.visible.
  if (!visible) return;

  // Warm dawn halo — slow breathing pulse (~33-second period).
  const dawnPulse = 0.050 + Math.sin(t * 0.000190) * 0.020;
  const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.26);
  halo.addColorStop(0,    `rgba(245, 186, 108, ${dawnPulse})`);
  halo.addColorStop(0.40, `rgba(232, 158, 78, ${dawnPulse * 0.46})`);
  halo.addColorStop(0.78, `rgba(214, 132, 56, ${dawnPulse * 0.15})`);
  halo.addColorStop(1,    'rgba(198, 112, 40, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(ox, oy, w * 0.26, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rim catch along the cliff edge the fox is standing on — a short, soft
  // horizontal band of low sun, not an outline around the animal.
  const rimAlpha = 0.055 + Math.sin(t * 0.000260 + 0.8) * 0.022;
  const rim = ctx.createLinearGradient(ox - w * 0.10, oy, ox + w * 0.12, oy);
  rim.addColorStop(0,   'rgba(255, 206, 140, 0)');
  rim.addColorStop(0.5, `rgba(255, 214, 152, ${rimAlpha})`);
  rim.addColorStop(1,   'rgba(255, 206, 140, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(ox - w * 0.10, oy + h * 0.018, w * 0.22, 1.6);
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  effects: EffectType[];
  /**
   * Traced geometry of the river painted into this scene's plate.
   *
   * Optional on purpose. Only the Owl Valley and Summary plates have had
   * their rivers pixel-traced and checked against the art; the turtle, fox
   * and cave scenes keep the generic band until theirs are traced too.
   * Guessing a spline for them would put a current on dry ground, which is
   * strictly worse than the band it replaced.
   */
  river?: RiverGeometry;
};

/**
 * Timestamp used for the single frame rendered in reduced-motion mode.
 *
 * Not 0: several renderers key their opacity off sin(t * k), which sits at its
 * trough at t=0 and would render the presence glows nearly invisible. This
 * value lands mid-cycle for the slow pulses, so a reduced-motion user sees the
 * scene as it looks at a representative moment rather than at its dimmest.
 */
const STATIC_FRAME_T = 6000;

export function AtmosphereCanvas({ effects, river }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const effectsRef = useRef(effects);
  effectsRef.current = effects; // always current without restarting the loop

  const clouds    = useRef(makeClouds());
  const leaves    = useRef(makeLeaves());
  const streaks   = useRef(makeStreaks());
  const fireflies = useRef(makeFireflies());
  const fog       = useRef(makeFog());
  const glints    = useRef(makeGlints());

  // Interpolating ~250 spline samples is not something to redo 60 times a
  // second for a curve that never changes.
  const riverPath = useMemo(
    () => (river ? buildRiverPath(river.controls) : null),
    [river],
  );
  const riverRef = useRef<{ geometry: RiverGeometry; path: RiverPath } | null>(null);
  riverRef.current = river && riverPath ? { geometry: river, path: riverPath } : null;

  // Previous RAF timestamp, so glints advance by real elapsed time rather
  // than by a step that assumes 60Hz.
  const lastTRef = useRef<number | null>(null);

  // Re-rendering a static frame is needed whenever the scene changes while
  // motion is suppressed, since there is no RAF loop to pick the change up.
  const redrawStaticRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const paint = (t: number) => {
      const w  = window.innerWidth;
      const h  = window.innerHeight;
      const fx = effectsRef.current;

      // Clamped: a backgrounded tab resumes with a gap of many seconds, and
      // an unclamped dt would teleport every glint down the river at once.
      const prev = lastTRef.current;
      const dtMs = prev === null ? 16.7 : Math.min(50, Math.max(0, t - prev));
      lastTRef.current = t;

      ctx.clearRect(0, 0, w, h);

      // Render order: fog → clouds → river → character presence → leaves → fireflies
      if (fx.includes("fog"))             renderFog(ctx, w, h, t, fog.current);
      if (fx.includes("clouds"))          renderClouds(ctx, w, h, t, clouds.current);

      if (fx.includes("river")) {
        const r = riverRef.current;
        // A traced river that the cover-crop has pushed off screen is not
        // drawn at all, and is NOT replaced by the band: on the Owl Valley
        // plate at portrait sizes the water genuinely is not in frame, and
        // the band would paint a current across a forested hillside.
        if (r && riverVisibility(r.geometry, r.path, w, h) >= RIVER_VISIBILITY_THRESHOLD) {
          renderSplineRiver(ctx, w, h, t, dtMs, r.geometry, r.path, glints.current);
        } else if (!r) {
          renderRiver(ctx, w, h, t, streaks.current);
        }
      }

      if (fx.includes("turtle-presence")) renderTurtlePresence(ctx, w, h, t);
      if (fx.includes("owl-presence"))    renderOwlPresence(ctx, w, h, t);
      if (fx.includes("fox-presence"))    renderFoxPresence(ctx, w, h, t);
      if (fx.includes("leaves"))          renderLeaves(ctx, w, h, t, leaves.current);
      if (fx.includes("fireflies"))       renderFireflies(ctx, w, h, t, fireflies.current);
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const drawAnimated = (t: number) => {
      paint(t);
      rafRef.current = requestAnimationFrame(drawAnimated);
    };

    // Reduced motion keeps the atmosphere — fog, glow, the character presences
    // are all still composed — but freezes it. The scene becomes a still
    // photograph rather than being stripped bare, which preserves the
    // contemplative framing for users who cannot tolerate movement.
    const drawStatic = () => {
      resize();
      paint(STATIC_FRAME_T);
    };

    const stop = () => cancelAnimationFrame(rafRef.current);

    const applyMotionPreference = () => {
      stop();
      if (motionQuery.matches) {
        redrawStaticRef.current = drawStatic;
        drawStatic();
      } else {
        redrawStaticRef.current = () => {};
        resize();
        rafRef.current = requestAnimationFrame(drawAnimated);
      }
    };

    const onResize = () => {
      if (motionQuery.matches) drawStatic();
      else resize();
    };

    applyMotionPreference();
    window.addEventListener("resize", onResize);
    motionQuery.addEventListener("change", applyMotionPreference);

    return () => {
      window.removeEventListener("resize", onResize);
      motionQuery.removeEventListener("change", applyMotionPreference);
      stop();
    };
  }, []);

  // In reduced-motion mode no loop is running, so a scene change would
  // otherwise leave the previous screen's effects frozen on the canvas.
  useEffect(() => {
    redrawStaticRef.current();
  }, [effects, river]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
