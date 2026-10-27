/**
 * Minimal, self-contained type definitions for the /api serverless layer.
 *
 * IMPORTANT: This file intentionally duplicates a subset of the shapes found in
 * `src/types/panel.ts` (the frontend). We do NOT import from `src/` here because:
 *   1. `/api` must be deployable independently of the frontend build.
 *   2. Vercel bundles each API route in isolation; cross-boundary imports into
 *      `src/` would couple the serverless bundle to frontend build tooling.
 *
 * If the frontend's PanelInput shape changes, update the mirror below to match.
 *
 * We also avoid depending on the `@vercel/node` package (not currently installed
 * in this project) by declaring the minimal request/response surface we actually
 * use. At runtime, Vercel's Node.js runtime supplies objects that satisfy this
 * shape (including the `status`/`json` helper methods).
 */

// ---- Vercel-compatible request/response (local, dependency-free) ----------

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
  url?: string;
}

export interface ApiResponse {
  status(statusCode: number): ApiResponse;
  setHeader(name: string, value: string): ApiResponse | void;
  getHeader?(name: string): string | string[] | number | undefined;
  json(body: unknown): void;
  end(data?: string): void;
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<void>;

// ---- Mirrors of src/types/panel.ts (duplicated on purpose, see above) -----

export type EmotionOption =
  | "angry"
  | "hurt"
  | "confused"
  | "frustrated"
  | "anxious"
  | "disappointed"
  | "sad"
  | "other";

export type GoalOption =
  | "fix relationship"
  | "set boundary"
  | "get clarity"
  | "respond calmly"
  | "protect myself"
  | "decide whether to act"
  | "other";

export type UrgencyOption = "now" | "soon" | "can wait";

export type PanelInput = {
  conflictDescription: string;
  emotion: EmotionOption;
  intensity: number;
  goal: GoalOption;
  urgency: UrgencyOption;
};

export type CharacterName = "turtle" | "owl" | "fox";

export type StubResponse = {
  stub: true;
  message: string;
  character: CharacterName;
  receivedAt: string;
  echo: {
    emotion: EmotionOption;
    goal: GoalOption;
    urgency: UrgencyOption;
    intensity: number;
  };
};

export type ApiErrorResponse = {
  error: string;
  code: string;
};
