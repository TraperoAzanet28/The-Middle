/**
 * POST /api/turtle
 *
 * Phase 0 stub for the Turtle (emotional regulation) character endpoint.
 * See /api/README.md for the full contract and Phase 1 integration plan.
 */

import { createCharacterHandler } from "./_lib/handler.js";
import type { ApiHandler } from "./_lib/types.js";

const handler: ApiHandler = createCharacterHandler("turtle");

export default handler;
