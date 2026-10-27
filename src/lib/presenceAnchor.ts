/**
 * presenceAnchor.ts
 *
 * Geometry for placing canvas "character presence" effects (the glows and
 * glints drawn by AtmosphereCanvas) onto the animal that is already painted
 * into each scene's background photograph.
 *
 * WHY THIS EXISTS
 *
 * The atmosphere canvas is sized to the viewport. The background behind it is
 * a fixed-aspect image drawn by CSS with `background-size: cover`, which
 * scales the image to fill the viewport and crops the overflow. Those two
 * coordinate systems do not line up: the same animal sits at a different
 * fraction of the *screen* on every viewport size, even though it never moves
 * within the *image*.
 *
 * Earlier versions of the presence renderers hardcoded screen fractions tuned
 * by eye on a 390x844 phone. Those values are correct at exactly one viewport.
 * At desktop widths the fox glow sat roughly a third of the screen away from
 * the fox. Storing the position in image space and re-deriving screen
 * coordinates each frame fixes that for every size at once.
 *
 * Kept as a standalone module with no imports so it can be unit tested without
 * a DOM, a canvas, or a React renderer.
 */

/** Horizontal half of a CSS `background-position` value. */
export type AnchorAlign = "left" | "center" | "right";

/**
 * Where a character sits inside its background plate.
 *
 * `fx`/`fy` are fractions of the image's own width/height, measured off the
 * source asset — NOT fractions of the screen. They do not change when the
 * viewport changes.
 */
export type PresenceAnchor = {
  /** Natural pixel width of the background image. */
  imageW: number;
  /** Natural pixel height of the background image. */
  imageH: number;
  /** Subject's horizontal position within the image, 0..1. */
  fx: number;
  /** Subject's vertical position within the image, 0..1. */
  fy: number;
  /**
   * Horizontal half of the scene's `background-position`, which must match
   * the `bgPosition` set for that screen in App.tsx. Vertical alignment is
   * always `center` across the app, so it is not configurable here.
   */
  align: AnchorAlign;
};

/** Screen-space result of resolving an anchor against a viewport. */
export type ResolvedAnchor = {
  /** Subject position in CSS pixels, ready to pass to canvas drawing calls. */
  x: number;
  y: number;
  /** On-screen size of the scaled background plate, in CSS pixels. */
  dw: number;
  dh: number;
  /**
   * False when the cover-crop has pushed the subject outside the viewport, so
   * the animal this presence belongs to is not actually on screen.
   *
   * This is a real situation, not a defect: bg-turtle.png is a tall portrait
   * plate, and on a wide desktop window `cover` scales it by width and crops
   * away the bottom — where the turtle is. Lighting an animal nobody can see
   * would put an unexplained glow in open water, so renderers should check
   * this and skip drawing.
   */
  visible: boolean;
};

/**
 * Map an anchor from image space into canvas/screen space, replicating the
 * geometry of `background-size: cover` with a vertically centered position.
 *
 * `cover` scales the image by whichever axis needs the most magnification to
 * fill the viewport, so the scale factor is the max of the two ratios. The
 * resulting plate is at least as large as the viewport on both axes, and the
 * overflow is distributed according to `background-position`.
 *
 * `dw`/`dh` are returned so callers can size glows relative to the plate
 * rather than the viewport, keeping a halo proportional to the animal instead
 * of to the window.
 */
export function resolveAnchor(
  anchor: PresenceAnchor,
  viewportW: number,
  viewportH: number,
): ResolvedAnchor {
  const scale = Math.max(viewportW / anchor.imageW, viewportH / anchor.imageH);
  const dw = anchor.imageW * scale;
  const dh = anchor.imageH * scale;

  // Overflow (dw - viewportW) is pushed off one side, split, or off the other.
  const offsetX =
    anchor.align === "left"
      ? 0
      : anchor.align === "right"
        ? viewportW - dw
        : (viewportW - dw) / 2;

  // Vertical alignment is "center" for every scene in the app.
  const offsetY = (viewportH - dh) / 2;

  const x = offsetX + anchor.fx * dw;
  const y = offsetY + anchor.fy * dh;

  return {
    x,
    y,
    dw,
    dh,
    visible: x >= 0 && x <= viewportW && y >= 0 && y <= viewportH,
  };
}

// ─── Per-character anchors ───────────────────────────────────────────────────
//
// fx/fy were measured against each source plate in /public. `align` MUST stay
// in sync with the matching `bgPosition` entry in App.tsx's screenConfig — if
// one changes without the other, the glow drifts off its subject.

/** bg-turtle.png (1024x1536, portrait). Scene uses the default center crop. */
export const TURTLE_ANCHOR: PresenceAnchor = {
  imageW: 1024,
  imageH: 1536,
  fx: 0.403,
  fy: 0.8,
  align: "center",
};

/** bg-owl-main.png (1536x1024). Owl is far left; scene uses "left center". */
export const OWL_ANCHOR: PresenceAnchor = {
  imageW: 1536,
  imageH: 1024,
  fx: 0.154,
  fy: 0.33,
  align: "left",
};

/** bg-fox.png.jpeg (1536x1024). Fox is far right; scene uses "right center". */
export const FOX_ANCHOR: PresenceAnchor = {
  imageW: 1536,
  imageH: 1024,
  fx: 0.863,
  fy: 0.488,
  align: "right",
};
