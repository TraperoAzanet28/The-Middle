import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  resolveAnchor,
  TURTLE_ANCHOR,
  OWL_ANCHOR,
  FOX_ANCHOR,
  type PresenceAnchor,
} from "../src/lib/presenceAnchor";

/** The reference phone viewport every presence was originally eyeballed on. */
const PHONE = { w: 390, h: 844 };
const DESKTOP = { w: 1280, h: 800 };

/** Express a resolved anchor as a fraction of the viewport, for readability. */
function asScreenFraction(a: PresenceAnchor, w: number, h: number) {
  const r = resolveAnchor(a, w, h);
  return { fx: r.x / w, fy: r.y / h };
}

describe("resolveAnchor — cover-crop geometry", () => {
  test("an exact-aspect viewport needs no cropping, so image and screen fractions agree", () => {
    // 1536x1024 is 3:2; so is 768x512. Nothing is cropped on either axis.
    const a: PresenceAnchor = {
      imageW: 1536, imageH: 1024, fx: 0.25, fy: 0.75, align: "center",
    };
    const r = resolveAnchor(a, 768, 512);
    assert.ok(Math.abs(r.x - 192) < 1e-9, `x was ${r.x}`);
    assert.ok(Math.abs(r.y - 384) < 1e-9, `y was ${r.y}`);
    assert.ok(Math.abs(r.dw - 768) < 1e-9);
    assert.ok(Math.abs(r.dh - 512) < 1e-9);
  });

  test("cover scales by the axis needing the most magnification", () => {
    // 1536x1024 into 390x844: height is the binding axis (844/1024 > 390/1536).
    const r = resolveAnchor(
      { imageW: 1536, imageH: 1024, fx: 0, fy: 0, align: "left" },
      390, 844,
    );
    assert.ok(Math.abs(r.dh - 844) < 1e-9, "plate should exactly fill height");
    assert.ok(r.dw > 390, "plate should overflow width");
    assert.ok(Math.abs(r.dw - 1536 * (844 / 1024)) < 1e-9);
  });

  test("align moves the crop window without changing the plate size", () => {
    const base = { imageW: 1536, imageH: 1024, fx: 0.5, fy: 0.5 } as const;
    const left   = resolveAnchor({ ...base, align: "left" },   390, 844);
    const center = resolveAnchor({ ...base, align: "center" }, 390, 844);
    const right  = resolveAnchor({ ...base, align: "right" },  390, 844);

    assert.equal(left.dw, center.dw);
    assert.equal(center.dw, right.dw);
    // Left crop keeps the image's left edge at x=0, so a mid-image subject
    // sits furthest right on screen; right crop pulls it furthest left.
    assert.ok(left.x > center.x, "left-crop should place subject right of center-crop");
    assert.ok(center.x > right.x, "center-crop should place subject right of right-crop");
  });

  test("a subject at the image's right edge lands at the viewport's right edge under right-align", () => {
    const r = resolveAnchor(
      { imageW: 1536, imageH: 1024, fx: 1, fy: 0.5, align: "right" },
      390, 844,
    );
    assert.ok(Math.abs(r.x - 390) < 1e-9, `expected x=390, got ${r.x}`);
  });

  test("vertical centering is symmetric", () => {
    const top = resolveAnchor(
      { imageW: 1024, imageH: 1536, fx: 0.5, fy: 0, align: "center" },
      390, 844,
    );
    const bottom = resolveAnchor(
      { imageW: 1024, imageH: 1536, fx: 0.5, fy: 1, align: "center" },
      390, 844,
    );
    const midpoint = (top.y + bottom.y) / 2;
    assert.ok(Math.abs(midpoint - 422) < 1e-9, `midpoint was ${midpoint}`);
  });
});

describe("character anchors — regression guards", () => {
  // These three assertions pin the positions that were visually validated on
  // a 390x844 phone before the anchors were moved into image space. If the
  // refactor had shifted any presence on that viewport, these would fail.
  test("turtle keeps its validated phone position", () => {
    const { fx, fy } = asScreenFraction(TURTLE_ANCHOR, PHONE.w, PHONE.h);
    assert.ok(Math.abs(fx - 0.36) < 0.005, `fx was ${fx}`);
    assert.ok(Math.abs(fy - 0.80) < 0.005, `fy was ${fy}`);
  });

  test("owl keeps its validated phone position", () => {
    const { fx, fy } = asScreenFraction(OWL_ANCHOR, PHONE.w, PHONE.h);
    assert.ok(Math.abs(fx - 0.50) < 0.005, `fx was ${fx}`);
    assert.ok(Math.abs(fy - 0.33) < 0.005, `fy was ${fy}`);
  });

  test("fox sits on the fox at phone size", () => {
    const { fx, fy } = asScreenFraction(FOX_ANCHOR, PHONE.w, PHONE.h);
    assert.ok(Math.abs(fx - 0.555) < 0.01, `fx was ${fx}`);
    assert.ok(Math.abs(fy - 0.488) < 0.01, `fy was ${fy}`);
  });

  test("fox glow follows the fox to desktop instead of staying put", () => {
    // This is the actual bug the image-space refactor fixed. The old
    // hardcoded value was a flat 0.56 of screen width at every size; on a
    // 1280x800 window the fox is really at ~0.86, a third of a screen away.
    const { fx } = asScreenFraction(FOX_ANCHOR, DESKTOP.w, DESKTOP.h);
    assert.ok(fx > 0.80, `fox should be far right on desktop, got ${fx}`);
    assert.ok(Math.abs(fx - 0.56) > 0.2, "must not be pinned to the old phone value");
  });

  test("visible is true exactly when the resolved point is on screen", () => {
    const viewports = [
      [390, 844], [414, 896], [768, 1024], [1280, 800], [1920, 1080], [360, 640],
    ] as const;
    const anchors = {
      turtle: TURTLE_ANCHOR, owl: OWL_ANCHOR, fox: FOX_ANCHOR,
    };
    for (const [w, h] of viewports) {
      for (const [name, anchor] of Object.entries(anchors)) {
        const r = resolveAnchor(anchor, w, h);
        const onScreen = r.x >= 0 && r.x <= w && r.y >= 0 && r.y <= h;
        assert.equal(
          r.visible, onScreen,
          `${name} at ${w}x${h}: visible=${r.visible} but point (${r.x}, ${r.y}) onScreen=${onScreen}`,
        );
      }
    }
  });

  test("all three presences are on screen at the phone viewport the app targets", () => {
    for (const [name, anchor] of Object.entries({
      turtle: TURTLE_ANCHOR, owl: OWL_ANCHOR, fox: FOX_ANCHOR,
    })) {
      const r = resolveAnchor(anchor, PHONE.w, PHONE.h);
      assert.ok(r.visible, `${name} should be visible at ${PHONE.w}x${PHONE.h}`);
    }
  });

  test("the turtle is correctly reported as cropped away on a wide desktop", () => {
    // bg-turtle.png is a 1024x1536 portrait plate and the turtle sits 80% of
    // the way down it. A 1280x800 window cover-scales by width, so the bottom
    // of the plate — turtle included — falls below the fold. This is a
    // property of the asset, not a bug; the renderer must skip drawing rather
    // than put a moonlight halo on empty water.
    const r = resolveAnchor(TURTLE_ANCHOR, DESKTOP.w, DESKTOP.h);
    assert.equal(r.visible, false);
    assert.ok(r.y > DESKTOP.h, `turtle should be below the fold, y=${r.y}`);
  });

  test("align values match the bgPosition each scene sets in App.tsx", () => {
    // Guards the one coupling resolveAnchor cannot enforce itself: if a
    // scene's bgPosition changes in App.tsx, its anchor must change too.
    assert.equal(TURTLE_ANCHOR.align, "center");
    assert.equal(OWL_ANCHOR.align, "left");
    assert.equal(FOX_ANCHOR.align, "right");
  });
});
