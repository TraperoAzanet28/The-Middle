/**
 * POST /api/fox
 *
 * Phase 0 stub for the Fox (strategic action) character endpoint.
 * See /api/README.md for the full contract and Phase 1 integration plan.
 */

import { createCharacterHandler } from "./_lib/handler.js";
import type { ApiHandler } from "./_lib/types.js";

const handler: ApiHandler = createCharacterHandler("fox");

export default handler;
