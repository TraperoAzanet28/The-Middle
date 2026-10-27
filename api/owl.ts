/**
 * POST /api/owl
 *
 * Phase 0 stub for the Owl (clarity/perception) character endpoint.
 * See /api/README.md for the full contract and Phase 1 integration plan.
 */

import { createCharacterHandler } from "./_lib/handler.js";
import type { ApiHandler } from "./_lib/types.js";

const handler: ApiHandler = createCharacterHandler("owl");

export default handler;
