/**
 * riverFlow.ts
 *
 * Geometry for water that follows the river actually painted into a scene,
 * instead of a horizontal band laid across it.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * AtmosphereCanvas's original river effect filled the bottom 40% of the
 * viewport with a gradient and slid streaks left-to-right across it. On a
 * plate where the river is a winding diagonal — which is every plate in this
 * app — the current visibly flows across the painting rather than along the
 * water. The eye catches that immediately, and a scene that contradicts
 * itself cannot do the one job these scenes have, which is to let someone
 * settle.
 *
 * ── Where the numbers come from ───────────────────────────────────────────
 *
 * The control points below were traced out of the source plates by reading
 * their pixels, not by eye: for each scanline, the dominant contiguous run of
 * water-bright pixels, biased toward continuity with the row above, gives a
 * centre line. Each trace was then rendered back over its own plate and
 * checked visually.
 *
 * This matters. The previous hand-drawn spline in OwlValleyRiverPreview.tsx
 * had the Owl Valley river starting at the cave mouth (x = 0.80) and running
 * down the valley. The cave is a separate feature on the right-hand hillside;
 * the river never touches it. That spline would have drawn flowing water
 * across a forested slope.
 *
 * ── Coordinate space ──────────────────────────────────────────────────────
 *
 * Control points are fractions of the IMAGE, exactly like PresenceAnchor —
 * not fractions of the screen. They are projected each frame through
 * resolveCoverFrame(), so the current stays on the painted water at every
 * viewport size. See the header of presenceAnchor.ts for why screen fractions
 * are only ever correct at one window size.
 *
 * No imports, no DOM, no canvas: all of this is unit tested directly.
 */

import type { AnchorAlign } from "./presenceAnchor";
import { projectImagePoint, resolveCoverFrame } from "./presenceAnchor";

/** A point on the river's centre line, in image fractions. */
export interface RiverControlPoint {
  x: number;
  y: number;
  /** Channel width at this point, as a fraction of image width. */
  w: number;
}

/** A traced river, bound to the plate it was traced from. */
export interface RiverGeometry {
  /** Natural pixel size of the source plate. */
  imageW: number;
  imageH: number;
  /** Must match the scene's `bgPosition` in App.tsx, as with PresenceAnchor. */
  align: AnchorAlign;
  controls: RiverControlPoint[];
}

/** One densely-interpolated sample along the centre line. */
export interface RiverSample {
  x: number;
  y: number;
  w: number;
  /** Unit tangent, pointing downstream. */
  tx: number;
  ty: number;
  /** Cumulative arc length from the head, in image-fraction units. */
  s: number;
  /** 0 in the widest water, approaching 1 in the narrowest. */
  turbulence: number;
  /**
   * How fast water moves here relative to the river's average.
   *
   * Continuity: the same volume through a narrower channel has to move
   * faster. This is why a stream is loud at a bend and silent in a pool, and
   * it is the single cue that makes drawn water read as water rather than as
   * drifting dots.
   */
  speedMul: number;
}

export interface RiverPath {
  samples: RiverSample[];
  /** Total arc length, in image-fraction units. */
  length: number;
}

// ─── Spline ────────────────────────────────────────────────────────────────

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Densely interpolate a control polygon and annotate it with tangents,
 * cumulative arc length, and per-point flow speed.
 *
 * Catmull-Rom is used because it passes THROUGH its control points. The
 * controls are measured positions on a real painting, so a curve that merely
 * approximates them would drift off the water.
 */
export function buildRiverPath(
  controls: RiverControlPoint[],
  stepsPerSegment = 14,
): RiverPath {
  if (controls.length < 2) {
    const only = controls[0] ?? { x: 0.5, y: 0.5, w: 0.05 };
    return {
      samples: [{ ...only, tx: 0, ty: 1, s: 0, turbulence: 0, speedMul: 1 }],
      length: 0,
    };
  }

  // Duplicate the endpoints so the first and last real segments have the
  // neighbours Catmull-Rom needs, and the curve starts and ends on the trace.
  const padded = [controls[0], ...controls, controls[controls.length - 1]];
  const raw: { x: number; y: number; w: number }[] = [];

  for (let i = 1; i < padded.length - 2; i++) {
    const [p0, p1, p2, p3] = [padded[i - 1], padded[i], padded[i + 1], padded[i + 2]];
    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      raw.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        w: Math.max(0.004, catmullRom(p0.w, p1.w, p2.w, p3.w, t)),
      });
    }
  }
  raw.push({ ...controls[controls.length - 1] });

  const widths = raw.map((p) => p.w);
  const maxW = Math.max(...widths);
  // Median, not mean: a single very wide pool should not redefine "normal".
  const sorted = [...widths].sort((a, b) => a - b);
  const medianW = sorted[Math.floor(sorted.length / 2)];

  const samples: RiverSample[] = raw.map((p) => ({
    ...p,
    tx: 0,
    ty: 1,
    s: 0,
    turbulence: Math.max(0, Math.min(1, 1 - p.w / maxW)),
    // Clamped so a pinch point cannot produce a glint that teleports.
    speedMul: Math.max(0.45, Math.min(2.6, medianW / p.w)),
  }));

  // Tangents by central difference.
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1e-9;
    samples[i].tx = dx / len;
    samples[i].ty = dy / len;
  }

  // Cumulative arc length.
  let acc = 0;
  for (let i = 1; i < samples.length; i++) {
    acc += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    samples[i].s = acc;
  }

  return { samples, length: acc };
}

/**
 * Sample the river at normalised ARC LENGTH u (0 = head, 1 = foreground).
 *
 * The lookup is by arc length, not by array index. An earlier version indexed
 * the dense array directly, which silently reintroduced the problem the
 * arc-length table exists to solve: Catmull-Rom samples are evenly spaced in
 * spline parameter, not in distance, so tight bends pack samples closely and
 * straight runs spread them out. Indexing by position therefore made glints
 * crawl through curves and sprint down straights — a speed variation driven
 * by the parameterisation rather than by the channel, directly fighting the
 * hydraulic cue speedMul is there to provide.
 */
export function sampleRiver(path: RiverPath, u: number): RiverSample {
  const { samples, length } = path;
  if (samples.length === 1 || length <= 0) return samples[0];

  const target = (((u % 1) + 1) % 1) * length;

  // Binary search for the segment containing `target`.
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s <= target) lo = mid;
    else hi = mid;
  }

  const a = samples[lo];
  const b = samples[hi];
  const span = b.s - a.s;
  const f = span > 0 ? (target - a.s) / span : 0;
  const lerp = (p: number, q: number) => p + (q - p) * f;

  return {
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    w: lerp(a.w, b.w),
    tx: lerp(a.tx, b.tx),
    ty: lerp(a.ty, b.ty),
    s: target,
    turbulence: lerp(a.turbulence, b.turbulence),
    speedMul: lerp(a.speedMul, b.speedMul),
  };
}

/**
 * Advance a position along the river by `dtMs`, wrapping at the foreground.
 *
 * Kept here rather than in the renderer so the motion rule is testable and
 * identical everywhere water is drawn.
 */
export function advanceAlongRiver(
  path: RiverPath,
  u: number,
  dtMs: number,
  baseSpeedPerMs: number,
): number {
  const { speedMul } = sampleRiver(path, u);
  const next = u + baseSpeedPerMs * speedMul * dtMs;
  return next - Math.floor(next);
}

/**
 * What fraction of the river survives the cover-crop at this viewport, 0..1.
 *
 * ── Why a renderer must check this ────────────────────────────────────────
 *
 * A presence anchor is a single point, and presenceAnchor.ts already reports
 * whether it got cropped away. A river is a long feature, so the question is
 * not boolean at the source: a crop can leave most of it, a sliver of it, or
 * none.
 *
 * This is not hypothetical. The Owl Valley plate is landscape, its scene
 * crops "left" to keep the owl (image x = 0.154) in frame, and its river sits
 * at image x = 0.52..0.70. On a 390x844 phone the visible window is only
 * x = 0..0.31, so NONE of the river is on screen; on a tablet portrait the
 * window reaches x = 0.50 and it is still none. The river returns at
 * landscape and desktop widths.
 *
 * The alternative — recentring that scene so the water shows on phones —
 * would crop out the owl, trading the character the scene exists for against
 * a background detail. So the water really is absent on portrait, and the
 * honest response is for the renderer to skip it and let fog and fireflies
 * carry the atmosphere, rather than drawing a current across a hillside.
 */
export function riverVisibility(
  geometry: RiverGeometry,
  path: RiverPath,
  viewportW: number,
  viewportH: number,
  probes = 64,
): number {
  const frame = resolveCoverFrame(
    geometry.imageW,
    geometry.imageH,
    geometry.align,
    viewportW,
    viewportH,
  );

  let onScreen = 0;
  for (let i = 0; i < probes; i++) {
    const s = sampleRiver(path, i / probes);
    const { x, y } = projectImagePoint(frame, s.x, s.y);
    // Widened by the channel half-width: water whose centre line is just off
    // the edge still washes into frame, and popping it out entirely would be
    // visible as the window resizes.
    const pad = (s.w * frame.dw) / 2;
    if (x >= -pad && x <= viewportW + pad && y >= -pad && y <= viewportH + pad) {
      onScreen++;
    }
  }
  return onScreen / probes;
}

/**
 * Below this, drawing the spline river costs frame time to animate water
 * nobody can see, and any glint that does land on screen reads as an
 * unexplained shimmer with no river attached to it.
 */
export const RIVER_VISIBILITY_THRESHOLD = 0.15;

// ─── Traced geometries ─────────────────────────────────────────────────────

/**
 * bg-owl-main.png (1536x1024), scene crop "left center".
 *
 * Pixel-traced over y = 0.44..0.97. The river enters mid-frame below the
 * distant ridge, makes two bends, and exits bottom-centre. It does NOT reach
 * the cave mouth on the right-hand hillside, despite what the earlier
 * hand-drawn spline assumed.
 *
 * Widths here are the measured bright-run widths, which on this plate are
 * trustworthy: it is a night scene, the water is the only cool bright feature,
 * and the forest does not wash out against it.
 */
export const OWL_RIVER: RiverGeometry = {
  imageW: 1536,
  imageH: 1024,
  align: "left",
  controls: [
    { x: 0.571, y: 0.439, w: 0.030 },
    { x: 0.556, y: 0.469, w: 0.036 },
    { x: 0.521, y: 0.498, w: 0.040 },
    { x: 0.516, y: 0.528, w: 0.052 },
    { x: 0.580, y: 0.547, w: 0.070 },
    { x: 0.640, y: 0.567, w: 0.060 },
    { x: 0.623, y: 0.596, w: 0.070 },
    { x: 0.662, y: 0.625, w: 0.080 },
    { x: 0.698, y: 0.654, w: 0.076 },
    { x: 0.680, y: 0.684, w: 0.078 },
    { x: 0.628, y: 0.713, w: 0.110 },
    { x: 0.567, y: 0.742, w: 0.125 },
    { x: 0.540, y: 0.771, w: 0.117 },
    { x: 0.563, y: 0.801, w: 0.105 },
    { x: 0.613, y: 0.840, w: 0.084 },
    { x: 0.630, y: 0.879, w: 0.060 },
    { x: 0.620, y: 0.918, w: 0.080 },
    { x: 0.605, y: 0.957, w: 0.082 },
    { x: 0.600, y: 1.000, w: 0.085 },
  ],
};

/**
 * bg-summary.png (1536x1024), default "center" crop.
 *
 * Pixel-traced over y = 0.46..0.95. This is the app's most prominent river —
 * a wide braided channel running from the sunset haze down to the foreground.
 *
 * The centre line is the measured trace. The WIDTHS are not: this is a warm
 * daylight plate, and above roughly y = 0.60 the bright-run measurement spans
 * the whole valley because sunlit haze clears the threshold too. Measured
 * widths up there came back as 0.25–0.33 of the image, which is the valley,
 * not the river. They are replaced with a perspective ramp — narrow at the
 * horizon, widening toward the viewer — which is both physically right and
 * visibly right against the painting.
 */
export const SUMMARY_RIVER: RiverGeometry = {
  imageW: 1536,
  imageH: 1024,
  align: "center",
  controls: [
    { x: 0.601, y: 0.460, w: 0.016 },
    { x: 0.561, y: 0.489, w: 0.022 },
    { x: 0.575, y: 0.519, w: 0.030 },
    { x: 0.628, y: 0.548, w: 0.042 },
    { x: 0.621, y: 0.577, w: 0.058 },
    { x: 0.562, y: 0.597, w: 0.072 },
    { x: 0.485, y: 0.626, w: 0.090 },
    { x: 0.480, y: 0.655, w: 0.105 },
    { x: 0.531, y: 0.685, w: 0.120 },
    { x: 0.568, y: 0.714, w: 0.135 },
    { x: 0.550, y: 0.743, w: 0.150 },
    { x: 0.584, y: 0.772, w: 0.160 },
    { x: 0.614, y: 0.802, w: 0.165 },
    { x: 0.560, y: 0.831, w: 0.170 },
    { x: 0.449, y: 0.860, w: 0.150 },
    { x: 0.382, y: 0.890, w: 0.125 },
    { x: 0.341, y: 0.919, w: 0.110 },
    { x: 0.330, y: 0.960, w: 0.100 },
    { x: 0.350, y: 1.000, w: 0.095 },
  ],
};
