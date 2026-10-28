/**
 * modelProvider.ts — the seam between the orchestrator and whatever actually
 * produces a character's words.
 *
 * The orchestrator never knows whether it is talking to a real model. It
 * depends on the ModelProvider interface only, which means the entire
 * conversation flow — context assembly, handoffs, integrity review, fallback
 * behaviour, the HTTP layer — can be built, exercised and regression-tested
 * against the mock provider with no API key and no spend.
 *
 * ── Cost safety ───────────────────────────────────────────────────────────
 *
 * Selection is deliberately fail-closed. The mock is the default, and a live
 * provider is used ONLY when an operator sets MODEL_PROVIDER=anthropic AND
 * supplies ANTHROPIC_API_KEY. Merely having a key in the environment does not
 * start billing: a key often ends up in a shared env for unrelated reasons,
 * and "deploy quietly started costing money" is not an acceptable failure
 * mode. Two independent signals are required to spend.
 *
 * The Anthropic provider itself is not implemented yet. Turning on a paid
 * service is explicitly outside the standing authority for this work and
 * needs sign-off, so the constructor throws with an explanation rather than
 * silently falling back — a misconfiguration should be loud at startup, not
 * invisible in production.
 */

import type { CharacterName, PanelInput } from "./types.js";
import type { CharacterPayload, ConversationContext } from "./orchestrator.js";
import { buildDeterministicPayload } from "./deterministic.js";

/** What the orchestrator hands a provider in order to get words back. */
export interface GenerateRequest {
  character: CharacterName;
  input: PanelInput;
  context: ConversationContext;
  /** Abort budget for the underlying call, in milliseconds. */
  timeoutMs: number;
}

export interface GenerateResult<C extends CharacterName = CharacterName> {
  payload: CharacterPayload<C>;
  /** Identifier recorded in CharacterResponse.meta.model for audit trails. */
  model: string;
  /** True when no real model was involved. Surfaces as meta.stub. */
  stub: boolean;
  tokensIn?: number;
  tokensOut?: number;
}

export interface ModelProvider {
  /** Stable name for logs and meta. */
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

// ─── Mock provider ─────────────────────────────────────────────────────────

/**
 * Produces real, character-correct payloads from the deterministic engine.
 *
 * This is not a placeholder that returns lorem ipsum — it returns the same
 * shape and the same quality of content a user would actually be shown if a
 * model call failed, which means testing against it tests something real and useful:
 * that the flow holds together and that the Tier 1 integrity checks pass on
 * content the app is willing to ship.
 */
export class MockModelProvider implements ModelProvider {
  readonly name = "mock";

  /**
   * Optional injected latency, so callers can exercise timeout handling.
   * Zero by default to keep the test suite fast.
   */
  constructor(private readonly latencyMs = 0) {}

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    return {
      payload: buildDeterministicPayload(request.character, request.input),
      model: "mock-deterministic",
      stub: true,
    };
  }
}

/**
 * A provider that always fails, for exercising the orchestrator's fallback
 * path. Kept here rather than in the test tree so the failure mode is part of
 * the documented contract rather than a test-only fiction.
 */
export class FailingModelProvider implements ModelProvider {
  readonly name = "failing";

  constructor(private readonly reason = "simulated provider failure") {}

  async generate(): Promise<GenerateResult> {
    throw new Error(this.reason);
  }
}

// ─── Live provider (not enabled) ───────────────────────────────────────────

/**
 * Placeholder for the real Anthropic Messages API provider.
 *
 * Implementation plan, unchanged from the ADR and the TODOs in
 * orchestrator.ts:
 *   - read ANTHROPIC_API_KEY at call time, never at module load
 *   - non-streaming Messages call
 *   - forced tool use (tool_choice: {type:"tool"}) whose input_schema is
 *     CharacterPayload<character>, so the model is structurally unable to
 *     return unparseable prose
 *   - character system prompt adapted into api/_lib/prompts/ (a mirror of
 *     src/prompts/, not an import — see the types.ts boundary note)
 *
 * Deliberately unimplemented: enabling it begins recurring spend against a
 * paid API, which requires explicit owner approval.
 */
export class AnthropicModelProvider implements ModelProvider {
  readonly name = "anthropic";

  constructor() {
    throw new Error(
      "AnthropicModelProvider is not implemented. Enabling live model calls " +
        "starts paid API usage and requires explicit approval. Unset " +
        "MODEL_PROVIDER to continue with the mock provider.",
    );
  }

  async generate(): Promise<GenerateResult> {
    throw new Error("AnthropicModelProvider is not implemented.");
  }
}

// ─── Selection ─────────────────────────────────────────────────────────────

/** Environment inputs that decide which provider is used. */
export interface ProviderEnv {
  MODEL_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
}

/**
 * Choose a provider. Defaults to the mock in every ambiguous case.
 *
 * Takes env as a parameter rather than reading process.env directly so the
 * selection rules are testable without mutating global state.
 */
export function selectProvider(env: ProviderEnv = {}): ModelProvider {
  const requested = (env.MODEL_PROVIDER ?? "").trim().toLowerCase();

  if (requested === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error(
        "MODEL_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.",
      );
    }
    return new AnthropicModelProvider();
  }

  // Includes the empty string, "mock", and anything unrecognised. An unknown
  // value falling back to the mock is intentional: a typo in an env var
  // should degrade to the free, safe path rather than to an outage.
  return new MockModelProvider();
}

/** Read provider configuration from the ambient environment, if there is one. */
export function providerEnvFromProcess(): ProviderEnv {
  // Guarded so this module stays importable in environments with no process
  // global (and so it never throws merely by being loaded).
  if (typeof process === "undefined" || !process.env) return {};
  return {
    MODEL_PROVIDER: process.env.MODEL_PROVIDER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
}
