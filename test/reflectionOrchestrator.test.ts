/**
 * reflectionOrchestrator.test.ts
 *
 * Covers the Phase C conversation flow end to end with NO model call and no
 * API key: context assembly, handoff, provider selection, and the routing
 * guarantees that matter most in production — that routeToCharacter always
 * returns usable content, and never throws, no matter how the provider fails.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import type { PanelInput } from "../api/_lib/types";
import type { ConversationTurn, FoxPayload, TurtlePayload } from "../api/_lib/orchestrator";
import {
  DEFAULT_MAX_TURNS,
  buildContext,
  estimateTokens,
  recordHandoffDecision,
  routeToCharacter,
} from "../api/_lib/orchestrator";
import {
  AnthropicModelProvider,
  FailingModelProvider,
  MockModelProvider,
  selectProvider,
} from "../api/_lib/modelProvider";

const INPUT: PanelInput = {
  conflictDescription:
    "My sister cancelled on me again, twice in a row, and she didn't reply when I asked why.",
  emotion: "hurt",
  intensity: 8,
  goal: "get clarity",
  urgency: "soon",
};

function turn(n: number, role: ConversationTurn["role"] = "user"): ConversationTurn {
  return {
    role,
    content: `turn number ${n}`,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    ...(role === "character" ? { character: "owl" as const } : {}),
  };
}

// ─── buildContext ──────────────────────────────────────────────────────────

describe("buildContext — windowing", () => {
  test("history shorter than the window is returned untouched", () => {
    const history = [turn(1), turn(2), turn(3)];
    const ctx = buildContext(history, INPUT, "turtle");
    assert.deepEqual(ctx.turns, history);
    assert.equal(ctx.activeCharacter, "turtle");
    // panelInput is never trimmed — it is the situation the session is about.
    assert.deepEqual(ctx.panelInput, INPUT);
  });

  test("history longer than maxTurns keeps the newest turns, not the oldest", () => {
    const history = Array.from({ length: 20 }, (_, i) => turn(i + 1));
    const ctx = buildContext(history, INPUT, "owl");

    // One synthetic summary turn + the window.
    assert.equal(ctx.turns.length, DEFAULT_MAX_TURNS + 1);
    assert.equal(ctx.turns[0].role, "system");
    assert.equal(ctx.turns[ctx.turns.length - 1].content, "turn number 20");
    assert.equal(ctx.turns[1].content, "turn number 9");
  });

  test("dropped turns are summarized rather than silently discarded", () => {
    const history = Array.from({ length: 20 }, (_, i) => turn(i + 1));
    const summary = buildContext(history, INPUT, "owl").turns[0];

    assert.equal(summary.role, "system");
    assert.match(summary.content, /8 earlier turns omitted/);
    // Extractive: it quotes the user rather than paraphrasing them.
    assert.match(summary.content, /turn number 8/);
  });

  test("summarizeOverflow:false drops the overflow entirely", () => {
    const history = Array.from({ length: 20 }, (_, i) => turn(i + 1));
    const ctx = buildContext(history, INPUT, "owl", { summarizeOverflow: false });

    assert.equal(ctx.turns.length, DEFAULT_MAX_TURNS);
    assert.equal(ctx.turns[0].content, "turn number 9");
  });

  test("a token budget tighter than the turn window trims further", () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
      ...turn(i + 1),
      content: "x".repeat(400), // ~104 tokens each
    }));

    const ctx = buildContext(history, INPUT, "fox", {
      maxTurns: 6,
      maxContextTokens: 250, // room for roughly two
    });

    const verbatim = ctx.turns.filter((t) => t.role !== "system");
    assert.ok(verbatim.length < 6, `expected trimming, kept ${verbatim.length}`);
    assert.ok(estimateTokens(verbatim) <= 250, "retained turns exceed the budget");
  });

  test("the token pass never empties the context completely", () => {
    // One enormous turn, a budget it cannot possibly meet. Sending a character
    // nothing at all is worse than sending it one oversized turn.
    const history = [{ ...turn(1), content: "y".repeat(100_000) }];
    const ctx = buildContext(history, INPUT, "turtle", { maxContextTokens: 10 });
    assert.equal(ctx.turns.length, 1);
  });

  test("estimateTokens grows with content and charges per-message overhead", () => {
    assert.ok(estimateTokens([]) === 0);
    const one = estimateTokens([turn(1)]);
    const two = estimateTokens([turn(1), turn(2)]);
    assert.ok(two > one);
  });
});

// ─── Handoff ───────────────────────────────────────────────────────────────

describe("recordHandoffDecision — the user owns the transition", () => {
  const base = buildContext([], INPUT, "turtle");
  const offer = {
    fromCharacter: "turtle" as const,
    toCharacter: "owl" as const,
    reason: "You sound steadier. Would it help to look at what you actually know?",
    offeredAt: new Date().toISOString(),
  };

  test("accepting switches the active character and records where we came from", () => {
    const next = recordHandoffDecision(base, offer, "accepted");
    assert.equal(next.activeCharacter, "owl");
    assert.equal(next.priorCharacter, "turtle");
  });

  test("declining changes nothing at all", () => {
    const next = recordHandoffDecision(base, offer, "declined");
    assert.equal(next.activeCharacter, "turtle");
    assert.equal(next.priorCharacter, undefined);
    assert.equal(next, base, "declining should not even allocate a new context");
  });
});

// ─── Provider selection (cost safety) ──────────────────────────────────────

describe("selectProvider — fail closed, never spend by accident", () => {
  test("an empty environment selects the mock", () => {
    assert.equal(selectProvider({}).name, "mock");
  });

  test("a stray ANTHROPIC_API_KEY alone does NOT enable paid calls", () => {
    // A key often lands in a shared env for unrelated reasons. Two independent
    // signals are required before anything bills.
    assert.equal(selectProvider({ ANTHROPIC_API_KEY: "sk-ant-whatever" }).name, "mock");
  });

  test("an unrecognised MODEL_PROVIDER degrades to the mock, not to an outage", () => {
    assert.equal(selectProvider({ MODEL_PROVIDER: "antropic" }).name, "mock");
    assert.equal(selectProvider({ MODEL_PROVIDER: "openai" }).name, "mock");
  });

  test("MODEL_PROVIDER=anthropic without a key is a loud configuration error", () => {
    assert.throws(
      () => selectProvider({ MODEL_PROVIDER: "anthropic" }),
      /ANTHROPIC_API_KEY is not set/,
    );
  });

  test("the live provider refuses to construct until it is explicitly approved", () => {
    // Guards the standing constraint: turning on a paid API needs sign-off.
    assert.throws(
      () => selectProvider({ MODEL_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-x" }),
      /requires explicit approval/,
    );
    assert.throws(() => new AnthropicModelProvider(), /not implemented/);
  });
});

// ─── routeToCharacter ──────────────────────────────────────────────────────

describe("routeToCharacter — always answers", () => {
  const provider = new MockModelProvider();
  const context = buildContext([], INPUT, "turtle");

  test("a healthy provider produces a payload and is not marked as a fallback", async () => {
    const res = await routeToCharacter(
      { character: "turtle", input: INPUT, context },
      { provider },
    );

    assert.equal(res.character, "turtle");
    assert.equal(res.meta.fallback, false);
    assert.equal(res.meta.fallbackReason, undefined);
    assert.equal(res.meta.model, "mock-deterministic");
    assert.ok((res.payload as TurtlePayload).acknowledgment.length > 0);
  });

  test("every response carries a Tier 1 verdict before it can reach a client", async () => {
    for (const character of ["turtle", "owl", "fox"] as const) {
      const res = await routeToCharacter(
        { character, input: INPUT, context: buildContext([], INPUT, character) },
        { provider },
      );
      assert.equal(res.integrityReview.length, 1);
      assert.equal(res.integrityReview[0].tier, "tier1");
      assert.equal(
        res.integrityReview[0].verdict,
        "pass",
        `${character} shipped content that fails its own integrity checks: ` +
          `${res.integrityReview[0].summary}`,
      );
    }
  });

  test("a failing provider still yields real content, and never throws", async () => {
    const res = await routeToCharacter(
      { character: "fox", input: INPUT, context: buildContext([], INPUT, "fox") },
      { provider: new FailingModelProvider("upstream 503"), maxAttempts: 2 },
    );

    assert.equal(res.meta.fallback, true);
    assert.match(res.meta.fallbackReason ?? "", /upstream 503/);
    assert.equal(res.meta.model, "deterministic-fallback");

    // The point of the guarantee: the user gets something usable, not an error.
    const payload = res.payload as FoxPayload;
    assert.ok(payload.options.length >= 2);
    assert.equal(res.integrityReview[0].verdict, "pass");
  });

  test("a provider slower than the budget falls back instead of hanging", async () => {
    const started = Date.now();
    const res = await routeToCharacter(
      { character: "owl", input: INPUT, context: buildContext([], INPUT, "owl") },
      { provider: new MockModelProvider(400), timeoutMs: 40, maxAttempts: 1 },
    );

    assert.equal(res.meta.fallback, true);
    assert.match(res.meta.fallbackReason ?? "", /exceeded 40ms/);
    assert.ok(
      Date.now() - started < 350,
      "the caller waited for the slow provider instead of abandoning it",
    );
  });

  test("latency is measured from an injectable clock", async () => {
    let t = 1_000;
    const res = await routeToCharacter(
      { character: "turtle", input: INPUT, context },
      { provider, now: () => (t += 250) },
    );
    assert.equal(res.meta.latencyMs, 250);
  });

  test("meta.stub stays true while no live model is enabled", async () => {
    const res = await routeToCharacter(
      { character: "owl", input: INPUT, context: buildContext([], INPUT, "owl") },
      { provider },
    );
    assert.equal(res.meta.stub, true);
  });
});
