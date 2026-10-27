import { useEffect, useRef } from "react";

export type EffectType =
  | "clouds"
  | "leaves"
  | "river"
  | "fireflies"
  | "fog"
  | "turtle-presence"   // moonlight glow + shell shimmer (Turtle scene)
  | "owl-presence"      // atmospheric glow + periodic eye glint (Owl scene)
  | "fox-character";    // drawn fox silhouette + warm rim light (Fox scene)

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
    x, y,
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

    if (l.x < -0.06) { l.x = 1.06; l.y = (l.y + 0.15) % 1.0; }
    if (l.y >  1.06) { l.y = -0.06; l.x = (l.x + 0.25) % 1.0; }

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
    if (p.x > 1.6) p.x = -0.9;

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
  // Turtle sits at lower-center of the moonlit river scene
  const ox = w * 0.36;
  const oy = h * 0.80;

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
  // Owl perch — left-of-center, matching background-position:"left center" crop.
  // On a 390×844 screen the 1536×1024 image scales to 1266px wide at left edge,
  // placing the owl's body at roughly (50%, 33%) and its eye at (61%, 27%).
  const ox = w * 0.50;
  const oy = h * 0.33;

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
 * Fox character — drawn silhouette with warm dawn rim lighting.
 *
 * The fox is the most important character presence fix.
 * Drawn as a dark silhouette (sitting, alert, facing right) positioned on
 * the rocky highland terrain, with amber rim light from the dawn sky behind.
 * The breathing animation is 40-second period — nearly imperceptible.
 */
function renderFoxCharacter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  // Fox origin — lower-center-right, standing on the highland rock shelf
  const ox = w * 0.60;
  const oy = h * 0.76;
  // Scale: fox body ~10% of viewport's smaller dimension
  const s  = Math.min(w, h) * 0.145;

  // Very slow breathing (40-second full cycle — almost imperceptible)
  const breathe = 1 + Math.sin(t * 0.000157) * 0.007;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(breathe, breathe);

  // ── Ground shadow — anchors fox to the terrain ──────────────────────────
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.55);
  shadow.addColorStop(0,   'rgba(0, 0, 0, 0.28)');
  shadow.addColorStop(0.6, 'rgba(0, 0, 0, 0.10)');
  shadow.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.04, s * 0.55, s * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Warm dawn rim-light halo behind the fox ──────────────────────────────
  const rimPulse = 0.095 + Math.sin(t * 0.000320) * 0.030;
  const halo = ctx.createRadialGradient(s * 0.12, -s * 0.52, 0, s * 0.12, -s * 0.52, s * 1.45);
  halo.addColorStop(0,    `rgba(240, 160, 60, ${rimPulse * 0.90})`);
  halo.addColorStop(0.30, `rgba(220, 130, 45, ${rimPulse * 0.48})`);
  halo.addColorStop(0.65, `rgba(200, 105, 30, ${rimPulse * 0.16})`);
  halo.addColorStop(1,    'rgba(180, 85, 20, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(s * 0.12, -s * 0.52, s * 1.45, s * 1.10, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Fox silhouette — very dark warm tone ────────────────────────────────
  const body = 'rgba(14, 9, 4, 0.93)';
  ctx.fillStyle = body;

  // Tail (drawn first — sits behind body)
  ctx.beginPath();
  ctx.moveTo(-s * 0.30, -s * 0.26);
  ctx.bezierCurveTo(-s * 0.50, -s * 0.14, -s * 0.72, s * 0.04, -s * 0.70, s * 0.10);
  ctx.bezierCurveTo(-s * 0.62, s * 0.16, -s * 0.44, s * 0.08, -s * 0.36, s * 0.00);
  ctx.bezierCurveTo(-s * 0.28, -s * 0.08, -s * 0.24, -s * 0.16, -s * 0.30, -s * 0.26);
  ctx.fill();

  // Tail tip softening gradient (adds bushy texture to tail end)
  const tailGrd = ctx.createRadialGradient(-s * 0.69, s * 0.09, 0, -s * 0.69, s * 0.09, s * 0.20);
  tailGrd.addColorStop(0, 'rgba(36, 22, 10, 0.55)');
  tailGrd.addColorStop(1, 'rgba(14, 9, 4, 0)');
  ctx.fillStyle = tailGrd;
  ctx.beginPath();
  ctx.ellipse(-s * 0.69, s * 0.09, s * 0.20, s * 0.15, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Body — crouching ellipse, slightly angled
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-s * 0.02, -s * 0.30, s * 0.44, s * 0.28, -0.14, 0, Math.PI * 2);
  ctx.fill();

  // Neck — bridges body to head
  ctx.beginPath();
  ctx.moveTo(s * 0.14, -s * 0.50);
  ctx.bezierCurveTo(s * 0.20, -s * 0.54, s * 0.28, -s * 0.58, s * 0.30, -s * 0.55);
  ctx.bezierCurveTo(s * 0.26, -s * 0.50, s * 0.18, -s * 0.47, s * 0.14, -s * 0.50);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.ellipse(s * 0.33, -s * 0.65, s * 0.21, s * 0.19, 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Snout — pointed muzzle extending forward (right)
  ctx.beginPath();
  ctx.moveTo(s * 0.46, -s * 0.64);
  ctx.bezierCurveTo(s * 0.60, -s * 0.61, s * 0.67, -s * 0.57, s * 0.63, -s * 0.54);
  ctx.bezierCurveTo(s * 0.56, -s * 0.51, s * 0.44, -s * 0.56, s * 0.46, -s * 0.64);
  ctx.fill();

  // Near ear (left) — tall pointed triangle
  ctx.beginPath();
  ctx.moveTo(s * 0.22, -s * 0.80);
  ctx.lineTo(s * 0.15, -s * 1.01);
  ctx.lineTo(s * 0.33, -s * 0.83);
  ctx.closePath();
  ctx.fill();

  // Far ear (right) — slightly smaller, partially behind
  ctx.beginPath();
  ctx.moveTo(s * 0.36, -s * 0.80);
  ctx.lineTo(s * 0.30, -s * 0.97);
  ctx.lineTo(s * 0.45, -s * 0.82);
  ctx.closePath();
  ctx.fill();

  // Front legs — subtle hints at the base of the body
  ctx.beginPath();
  ctx.ellipse(s * 0.22, -s * 0.08, s * 0.065, s * 0.12, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.07, -s * 0.07, s * 0.060, s * 0.11, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // ── Rim light strokes — dawn light catching fox edges ───────────────────
  const rimAlpha = 0.20 + Math.sin(t * 0.000320) * 0.065;
  ctx.strokeStyle = `rgba(245, 170, 68, ${rimAlpha})`;
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = 'round';

  // Back of body — primary rim catch
  ctx.beginPath();
  ctx.ellipse(-s * 0.02, -s * 0.30, s * 0.44, s * 0.28, -0.14, Math.PI * 0.88, Math.PI * 1.72);
  ctx.stroke();

  // Top of head — moonlight above
  ctx.beginPath();
  ctx.ellipse(s * 0.33, -s * 0.65, s * 0.21, s * 0.19, 0.18, -Math.PI * 0.18, Math.PI * 0.55);
  ctx.stroke();

  // Ear edges — catching the light
  ctx.beginPath();
  ctx.moveTo(s * 0.15, -s * 1.01);
  ctx.lineTo(s * 0.22, -s * 0.80);
  ctx.stroke();

  // Top of tail arc
  ctx.beginPath();
  ctx.moveTo(-s * 0.30, -s * 0.28);
  ctx.bezierCurveTo(-s * 0.48, -s * 0.18, -s * 0.68, s * 0.01, -s * 0.72, s * 0.07);
  ctx.stroke();

  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  effects: EffectType[];
};

export function AtmosphereCanvas({ effects }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const effectsRef = useRef(effects);
  effectsRef.current = effects; // always current without restarting the loop

  const clouds    = useRef(makeClouds());
  const leaves    = useRef(makeLeaves());
  const streaks   = useRef(makeStreaks());
  const fireflies = useRef(makeFireflies());
  const fog       = useRef(makeFog());

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      const w  = window.innerWidth;
      const h  = window.innerHeight;
      const fx = effectsRef.current;

      ctx.clearRect(0, 0, w, h);

      // Render order: fog → clouds → river → character presence → leaves → fireflies
      if (fx.includes("fog"))              renderFog(ctx, w, h, t, fog.current);
      if (fx.includes("clouds"))           renderClouds(ctx, w, h, t, clouds.current);
      if (fx.includes("river"))            renderRiver(ctx, w, h, t, streaks.current);
      if (fx.includes("turtle-presence")) renderTurtlePresence(ctx, w, h, t);
      if (fx.includes("owl-presence"))    renderOwlPresence(ctx, w, h, t);
      if (fx.includes("fox-character"))   renderFoxCharacter(ctx, w, h, t);
      if (fx.includes("leaves"))          renderLeaves(ctx, w, h, t, leaves.current);
      if (fx.includes("fireflies"))       renderFireflies(ctx, w, h, t, fireflies.current);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
