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
 * Where a `cover`-scaled plate actually lands inside a viewport.
 *
 * This is the one piece of geometry everything else here is built on, so it
 * is exposed separately: presences are not the only thing that has to line up
 * with the painting. The river spline in riverFlow.ts is traced in the same
 * image space and projected through the same frame.
 */
export type CoverFrame = {
  /** Where the plate's left/top edge sits, in CSS pixels. Usually negative. */
  offsetX: number;
  offsetY: number;
  /** On-screen size of the scaled plate, in CSS pixels. */
  dw: number;
  dh: number;
  /** The viewport the plate was fitted to, carried along for bounds checks. */
  viewportW: number;
  viewportH: number;
};

/**
 * Replicate the geometry of `background-size: cover` with a vertically
 * centered position.
 *
 * `cover` scales the image by whichever axis needs the most magnification to
 * fill the viewport, so the scale factor is the max of the two ratios. The
 * resulting plate is at least as large as the viewport on both axes, and the
 * overflow is distributed according to `background-position`.
 */
export function resolveCoverFrame(
  imageW: number,
  imageH: number,
  align: AnchorAlign,
  viewportW: number,
  viewportH: number,
): CoverFrame {
  const scale = Math.max(viewportW / imageW, viewportH / imageH);
  const dw = imageW * scale;
  const dh = imageH * scale;

  // Overflow (dw - viewportW) is pushed off one side, split, or off the other.
  const offsetX =
    align === "left" ? 0 : align === "right" ? viewportW - dw : (viewportW - dw) / 2;

  // Vertical alignment is "center" for every scene in the app.
  const offsetY = (viewportH - dh) / 2;

  return { offsetX, offsetY, dw, dh, viewportW, viewportH };
}

/** Project a point given in image fractions into CSS pixels. */
export function projectImagePoint(
  frame: CoverFrame,
  fx: number,
  fy: number,
): { x: number; y: number } {
  return { x: frame.offsetX + fx * frame.dw, y: frame.offsetY + fy * frame.dh };
}

/** Is a projected point inside the visible viewport? */
export function isOnScreen(frame: CoverFrame, x: number, y: number): boolean {
  return x >= 0 && x <= frame.viewportW && y >= 0 && y <= frame.viewportH;
}

/**
 * Map an anchor from image space into canvas/screen space.
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
  const frame = resolveCoverFrame(
    anchor.imageW,
    anchor.imageH,
    anchor.align,
    viewportW,
    viewportH,
  );
  const { x, y } = projectImagePoint(frame, anchor.fx, anchor.fy);

  return {
    x,
    y,
    dw: frame.dw,
    dh: frame.dh,
    visible: isOnScreen(frame, x, y),
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
