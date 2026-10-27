/**
 * Canonical background image path for every screen in the app.
 * Keys are PascalCase screen names; values are public-folder paths
 * served verbatim by Vite's static asset pipeline.
 *
 * All entries here are actively used in App.tsx screenConfig.
 * CaveInside is the single background used for the Cave step
 * (the CaveTransition/entrance image is not used in the current routing).
 */
export const BACKGROUNDS = {
  Home:       "/bg-home.png",
  HowItWorks: "/HowItWorks.png",
  Input:      "/bg-input.png.jpeg",
  Turtle:     "/bg-turtle.png",
  Owl:        "/bg-owl-main.png",
  Fox:        "/bg-fox.png.jpeg",
  Summary:    "/bg-summary.png",
  CaveInside: "/bg-cave-inside.png",
} as const;

export type BackgroundKey  = keyof typeof BACKGROUNDS;
export type BackgroundPath = (typeof BACKGROUNDS)[BackgroundKey];
