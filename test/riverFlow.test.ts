import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildRiverPath,
  sampleRiver,
  advanceAlongRiver,
  riverVisibility,
  RIVER_VISIBILITY_THRESHOLD,
  OWL_RIVER,
  SUMMARY_RIVER,
  type RiverControlPoint,
  type RiverGeometry,
} from "../src/lib/riverFlow";
import { resolveCoverFrame, projectImagePoint } from "../src/lib/presenceAnchor";

const RIVERS: [string, RiverGeometry][] = [
  ["OWL_RIVER", OWL_RIVER],
  ["SUMMARY_RIVER", SUMMARY_RIVER],
];

/** Viewports the app actually has to survive, not a uniform sweep. */
const VIEWPORTS: [string, number, number][] = [
  ["phone portrait", 390, 844],
  ["phone landscape", 844, 390],
  ["tablet portrait", 834, 1112],
  ["laptop", 1280, 800],
  ["wide desktop", 2560, 1080],
];

/** A straight channel that pinches in the middle, for isolating one variable. */
function pinchedChannel(): RiverControlPoint[] {
  return [
    { x: 0.5, y: 0.0, w: 0.1 },
    { x: 0.5, y: 0.25, w: 0.1 },
    { x: 0.5, y: 0.5, w: 0.02 },
    { x: 0.5, y: 0.75, w: 0.1 },
    { x: 0.5, y: 1.0, w: 0.1 },
  ];
}

describe("buildRiverPath — spline and arc length", () => {
  test("the curve starts and ends exactly on the traced endpoints", () => {
    // Catmull-Rom was chosen over a Bezier precisely because the controls are
    // measured pixel positions. If the curve only approximated them, the
    // water would be drawn beside the painted river rather than on it.
    for (const [name, river] of RIVERS) {
      const { samples } = buildRiverPath(river.controls);
      const first = river.controls[0];
      const last = river.controls[river.controls.length - 1];

      assert.ok(
        Math.hypot(samples[0].x - first.x, samples[0].y - first.y) < 1e-9,
        `${name}: head drifted off the trace`,
      );
      const tail = samples[samples.length - 1];
      assert.ok(
        Math.hypot(tail.x - last.x, tail.y - last.y) < 1e-9,
        `${name}: mouth drifted off the trace`,
      );
    }
  });

  test("arc length is non-decreasing and ends at the reported total", () => {
    for (const [name, river] of RIVERS) {
      const { samples, length } = buildRiverPath(river.controls);
      assert.ok(length > 0, `${name}: zero-length river`);
      assert.equal(samples[0].s, 0, `${name}: head is not at s=0`);

      for (let i = 1; i < samples.length; i++) {
        assert.ok(
          samples[i].s >= samples[i - 1].s,
          `${name}: arc length went backwards at ${i}`,
        );
      }
      assert.ok(
        Math.abs(samples[samples.length - 1].s - length) < 1e-9,
        `${name}: final s does not match reported length`,
      );
    }
  });

  test("tangents are unit vectors pointing downstream", () => {
    // Every river in this app runs toward the viewer, so ty must be positive:
    // a negative ty would send glints up into the horizon.
    for (const [name, river] of RIVERS) {
      for (const s of buildRiverPath(river.controls).samples) {
        assert.ok(
          Math.abs(Math.hypot(s.tx, s.ty) - 1) < 1e-9,
          `${name}: tangent not normalised`,
        );
        assert.ok(s.ty > 0, `${name}: tangent points upstream at y=${s.y}`);
      }
    }
  });

  test("degenerate control sets return something drawable instead of throwing", () => {
    // The renderer runs inside a RAF loop. A throw here would not be a blank
    // river, it would be a dead canvas and a frozen scene.
    const empty = buildRiverPath([]);
    assert.equal(empty.samples.length, 1);
    assert.equal(empty.length, 0);
    assert.ok(Number.isFinite(empty.samples[0].x));

    const single = buildRiverPath([{ x: 0.3, y: 0.4, w: 0.05 }]);
    assert.equal(single.samples.length, 1);
    assert.equal(single.samples[0].x, 0.3);

    // Sampling a degenerate path must also be safe, at any u.
    for (const u of [0, 0.5, 1, -3, 7.25]) {
      assert.ok(Number.isFinite(sampleRiver(empty, u).x));
      assert.ok(Number.isFinite(sampleRiver(single, u).y));
    }
  });
});

describe("sampleRiver — lookup is by distance, not by array index", () => {
  test("the dense samples really are unevenly spaced, so the hazard is real", () => {
    // This test guards the PREMISE of the arc-length table. Catmull-Rom emits
    // a fixed number of samples per segment regardless of how long that
    // segment is, so bends pack samples together and straights spread them
    // out. Measured spread on the real traces is 4.1x (owl) and 4.9x
    // (summary). If this ever collapsed toward 1, the binary search below
    // would be dead weight and this suite should say so rather than keep
    // asserting a property nothing depends on.
    for (const [name, river] of RIVERS) {
      const { samples } = buildRiverPath(river.controls);
      let min = Infinity;
      let max = 0;
      for (let i = 1; i < samples.length; i++) {
        const d = Math.hypot(
          samples[i].x - samples[i - 1].x,
          samples[i].y - samples[i - 1].y,
        );
        min = Math.min(min, d);
        max = Math.max(max, d);
      }
      assert.ok(
        max / min > 3,
        `${name}: dense spacing ratio ${(max / min).toFixed(2)} — arc-length lookup may be unnecessary`,
      );
    }
  });

  test("equal steps in u cover equal distance along the water", () => {
    // The regression the binary search exists to prevent: with index-based
    // lookup, glints crawled through curves and sprinted down straights, a
    // speed variation driven by the parameterisation rather than by the
    // channel — directly fighting the hydraulic cue speedMul provides.
    for (const [name, river] of RIVERS) {
      const path = buildRiverPath(river.controls);
      const N = 200;
      let min = Infinity;
      let max = 0;
      let prev = sampleRiver(path, 0);

      for (let i = 1; i < N; i++) {
        const s = sampleRiver(path, i / N);
        const d = Math.hypot(s.x - prev.x, s.y - prev.y);
        min = Math.min(min, d);
        max = Math.max(max, d);
        prev = s;
      }
      assert.ok(
        max / min < 1.1,
        `${name}: uneven arc-length steps, ratio ${(max / min).toFixed(3)}`,
      );
    }
  });

  test("u is periodic, so a drifting glint wraps instead of running off", () => {
    const path = buildRiverPath(OWL_RIVER.controls);
    const head = sampleRiver(path, 0);

    for (const u of [1, 2, -1, 5]) {
      const w = sampleRiver(path, u);
      assert.ok(Math.abs(w.x - head.x) < 1e-9, `u=${u} did not wrap to the head`);
      assert.ok(Math.abs(w.y - head.y) < 1e-9, `u=${u} did not wrap to the head`);
    }
    // A negative u is upstream of the head, which must land near the mouth.
    assert.ok(sampleRiver(path, -0.001).y > 0.9);
  });

  test("s advances monotonically with u across the whole river", () => {
    const path = buildRiverPath(SUMMARY_RIVER.controls);
    let prev = -1;
    for (let i = 0; i < 100; i++) {
      const s = sampleRiver(path, i / 100).s;
      assert.ok(s > prev, `s stalled or reversed at u=${i / 100}`);
      prev = s;
    }
  });
});

describe("speedMul and turbulence — the hydraulic cue", () => {
  test("water moves faster where the channel narrows", () => {
    // Continuity: the same volume through a narrower channel has to move
    // faster. This is the single cue that makes drawn water read as water
    // rather than as drifting dots.
    const path = buildRiverPath(pinchedChannel());
    const wide = sampleRiver(path, 0.1);
    const pinch = sampleRiver(path, 0.5);

    assert.ok(pinch.w < wide.w, "the pinch should be the narrow point");
    assert.ok(
      pinch.speedMul > wide.speedMul * 1.5,
      `pinch ${pinch.speedMul.toFixed(2)} vs wide ${wide.speedMul.toFixed(2)}`,
    );
  });

  test("speedMul stays inside its clamp on the real traces", () => {
    // Unclamped, a pinch point produces a glint that teleports. SUMMARY_RIVER
    // genuinely reaches the 2.6 ceiling at its horizon end, so this clamp is
    // load-bearing rather than theoretical.
    for (const [name, river] of RIVERS) {
      for (const s of buildRiverPath(river.controls).samples) {
        assert.ok(
          s.speedMul >= 0.45 && s.speedMul <= 2.6,
          `${name}: speedMul ${s.speedMul} escaped the clamp`,
        );
      }
    }
    const summary = buildRiverPath(SUMMARY_RIVER.controls).samples;
    assert.ok(
      Math.max(...summary.map((s) => s.speedMul)) > 2.5,
      "expected the summary trace to exercise the upper clamp",
    );
  });

  test("turbulence is 0 in the widest water and rises as the channel closes", () => {
    for (const [name, river] of RIVERS) {
      const samples = buildRiverPath(river.controls).samples;
      for (const s of samples) {
        assert.ok(
          s.turbulence >= 0 && s.turbulence <= 1,
          `${name}: turbulence ${s.turbulence} out of range`,
        );
      }
      const widest = samples.reduce((a, b) => (b.w > a.w ? b : a));
      assert.ok(
        Math.abs(widest.turbulence) < 1e-9,
        `${name}: widest point should be the calmest`,
      );
      assert.ok(
        Math.max(...samples.map((s) => s.turbulence)) > 0.5,
        `${name}: no turbulent stretch at all — the cue would be invisible`,
      );
    }
  });

  test("channel width never collapses to zero", () => {
    // A zero width would divide by zero in speedMul and blank the renderer.
    const path = buildRiverPath([
      { x: 0.5, y: 0.0, w: 0.1 },
      { x: 0.5, y: 0.5, w: 0.001 },
      { x: 0.5, y: 1.0, w: 0.1 },
    ]);
    for (const s of path.samples) {
      assert.ok(s.w >= 0.004, `width ${s.w} fell below the floor`);
      assert.ok(Number.isFinite(s.speedMul));
    }
  });
});

describe("advanceAlongRiver — motion over time", () => {
  test("a drifting particle always stays in [0, 1)", () => {
    const path = buildRiverPath(OWL_RIVER.controls);
    let u = 0;
    // ~16 seconds at 60fps, long enough to wrap the river several times.
    for (let i = 0; i < 1000; i++) {
      u = advanceAlongRiver(path, u, 16, 0.0004);
      assert.ok(u >= 0 && u < 1, `u escaped the unit interval: ${u}`);
    }
  });

  test("the same elapsed time carries a particle further through narrow water", () => {
    const path = buildRiverPath(pinchedChannel());
    const fromWide = advanceAlongRiver(path, 0.1, 16, 0.0004) - 0.1;
    const fromPinch = advanceAlongRiver(path, 0.5, 16, 0.0004) - 0.5;

    assert.ok(
      fromPinch > fromWide,
      `pinch advance ${fromPinch} should exceed wide advance ${fromWide}`,
    );
  });

  test("a zero timestep does not move anything", () => {
    // Guards against a first frame with no previous timestamp jolting the
    // whole river forward.
    const path = buildRiverPath(OWL_RIVER.controls);
    assert.equal(advanceAlongRiver(path, 0.42, 0, 0.0004), 0.42);
  });
});

describe("traced geometries — data integrity against the plates", () => {
  test("control points stay inside the image and run downstream", () => {
    for (const [name, river] of RIVERS) {
      assert.ok(river.controls.length >= 2, `${name}: too few controls`);

      river.controls.forEach((p, i) => {
        assert.ok(p.x >= 0 && p.x <= 1, `${name}[${i}]: x ${p.x} outside the plate`);
        assert.ok(p.y >= 0 && p.y <= 1, `${name}[${i}]: y ${p.y} outside the plate`);
        assert.ok(p.w > 0 && p.w < 0.5, `${name}[${i}]: implausible width ${p.w}`);
        if (i > 0) {
          assert.ok(
            p.y > river.controls[i - 1].y,
            `${name}[${i}]: y did not increase — the trace doubled back`,
          );
        }
      });
    }
  });

  test("each river reaches the bottom edge, so the current has no visible end", () => {
    // If the trace stopped short, the water would simply stop mid-frame.
    for (const [name, river] of RIVERS) {
      const last = river.controls[river.controls.length - 1];
      assert.ok(last.y >= 0.99, `${name}: trace ends at y=${last.y}, short of the frame`);
    }
  });

  test("the owl river never touches the cave mouth on the right hillside", () => {
    // The hand-drawn spline this replaced started at x = 0.80, which put
    // flowing water across a forested slope. Keeping this as an assertion so
    // the mistake cannot quietly return with a future re-trace.
    const maxX = Math.max(...OWL_RIVER.controls.map((p) => p.x));
    assert.ok(maxX < 0.75, `owl river reaches x=${maxX}, back up onto the hillside`);
  });

  test("both plates are 3:2 and declare the align their scene actually uses", () => {
    // align MUST match the scene's bgPosition in App.tsx. If one changes
    // without the other, the current slides off the painted water.
    assert.equal(OWL_RIVER.imageW / OWL_RIVER.imageH, 1.5);
    assert.equal(OWL_RIVER.align, "left");
    assert.equal(SUMMARY_RIVER.imageW / SUMMARY_RIVER.imageH, 1.5);
    assert.equal(SUMMARY_RIVER.align, "center");
  });
});

describe("projection — the current lands on the painted water at any viewport", () => {
  test("the summary river survives the crop on every supported viewport", () => {
    // This is the app's most prominent water and its scene crops centre, so
    // the river must be there at every size. Measured floor is 63% on an
    // ultrawide desktop.
    const path = buildRiverPath(SUMMARY_RIVER.controls);
    for (const [vp, vw, vh] of VIEWPORTS) {
      const seen = riverVisibility(SUMMARY_RIVER, path, vw, vh);
      assert.ok(seen > 0.5, `summary on ${vp}: only ${(seen * 100).toFixed(0)}% visible`);
    }
  });

  test("the owl river is cropped away on portrait and returns on landscape", () => {
    // Documenting a real constraint of the art, not a defect. The owl plate
    // is landscape and its scene crops "left" to keep the owl at image
    // x = 0.154 in frame; the river sits at x = 0.52..0.70 and falls outside
    // a portrait window entirely. Recentring to show the water would crop out
    // the owl, so the water is genuinely absent on phones.
    //
    // This test exists so that stays a deliberate trade rather than becoming
    // a silent regression if the trace or the scene's bgPosition is revisited.
    const path = buildRiverPath(OWL_RIVER.controls);

    for (const [vp, vw, vh] of [
      ["phone portrait", 390, 844],
      ["tablet portrait", 834, 1112],
    ] as const) {
      const seen = riverVisibility(OWL_RIVER, path, vw, vh);
      assert.ok(
        seen < RIVER_VISIBILITY_THRESHOLD,
        `${vp}: expected the owl river to be cropped away, saw ${(seen * 100).toFixed(0)}%`,
      );
    }

    for (const [vp, vw, vh] of [
      ["phone landscape", 844, 390],
      ["laptop", 1280, 800],
      ["wide desktop", 2560, 1080],
    ] as const) {
      const seen = riverVisibility(OWL_RIVER, path, vw, vh);
      assert.ok(
        seen > 0.5,
        `${vp}: expected the owl river in frame, saw ${(seen * 100).toFixed(0)}%`,
      );
    }
  });

  test("visibility is a fraction, and a fully-cropped river reports zero", () => {
    const path = buildRiverPath(OWL_RIVER.controls);
    for (const [, vw, vh] of VIEWPORTS) {
      for (const river of [OWL_RIVER, SUMMARY_RIVER]) {
        const seen = riverVisibility(river, buildRiverPath(river.controls), vw, vh);
        assert.ok(seen >= 0 && seen <= 1, `visibility ${seen} out of range`);
      }
    }
    // An extreme sliver viewport crops the owl plate to its far left edge,
    // well clear of the water.
    assert.equal(riverVisibility(OWL_RIVER, path, 200, 2000), 0);
  });

  test("projection is a pure scale-and-offset, so the river cannot deform", () => {
    // Spacing along the river may change with the viewport, but RATIOS of
    // distances must not: anything else means the water is being stretched
    // relative to the painting it sits on.
    const river = SUMMARY_RIVER;
    const path = buildRiverPath(river.controls);
    const ratios: number[] = [];

    for (const [, vw, vh] of VIEWPORTS) {
      const frame = resolveCoverFrame(river.imageW, river.imageH, river.align, vw, vh);
      const a = sampleRiver(path, 0.2);
      const b = sampleRiver(path, 0.5);
      const c = sampleRiver(path, 0.8);
      const pa = projectImagePoint(frame, a.x, a.y);
      const pb = projectImagePoint(frame, b.x, b.y);
      const pc = projectImagePoint(frame, c.x, c.y);

      ratios.push(
        Math.hypot(pb.x - pa.x, pb.y - pa.y) / Math.hypot(pc.x - pb.x, pc.y - pb.y),
      );
    }
    for (const r of ratios) {
      assert.ok(
        Math.abs(r - ratios[0]) < 1e-9,
        `shape ratio drifted between viewports: ${ratios.join(", ")}`,
      );
    }
  });

  test("an exact-aspect viewport maps image fractions straight to the screen", () => {
    // 1536x1024 into 768x512 crops nothing, so the arithmetic is checkable by
    // hand — a sanity anchor for the cases above that only assert invariants.
    const frame = resolveCoverFrame(1536, 1024, "center", 768, 512);
    const head = OWL_RIVER.controls[0];
    const { x, y } = projectImagePoint(frame, head.x, head.y);

    assert.ok(Math.abs(x - head.x * 768) < 1e-9, `x was ${x}`);
    assert.ok(Math.abs(y - head.y * 512) < 1e-9, `y was ${y}`);
  });
});
