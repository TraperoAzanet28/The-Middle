/**
 * characterEndpoint.test.ts
 *
 * Exercises the full /api/{turtle,owl,fox} request lifecycle in-process:
 * security headers, method and size guards, input validation, rate limiting,
 * and the routed response. No network, no server, no API key.
 *
 * Each test uses a distinct synthetic IP. The rate limiter is module-level
 * in-memory state shared across the whole suite, so tests that share an IP
 * would interfere with each other in ways that depend on execution order.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createCharacterHandler } from "../api/_lib/handler";
import { MAX_TURNS } from "../api/_lib/validate";
import type { ApiRequest, ApiResponse, PanelInput } from "../api/_lib/types";

const VALID_INPUT: PanelInput = {
  conflictDescription: "A friend cancelled on me twice and then went quiet.",
  emotion: "disappointed",
  intensity: 6,
  goal: "get clarity",
  urgency: "soon",
};

interface Captured {
  statusCode?: number;
  body?: any;
  headers: Record<string, string>;
  ended: boolean;
}

function makeRes(): { res: ApiResponse; captured: Captured } {
  const captured: Captured = { headers: {}, ended: false };
  const res: ApiResponse = {
    status(code) {
      captured.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      captured.headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return captured.headers[name.toLowerCase()];
    },
    json(body) {
      captured.body = body;
      captured.ended = true;
    },
    end() {
      captured.ended = true;
    },
  };
  return { res, captured };
}

let ipCounter = 0;
function makeReq(overrides: Partial<ApiRequest> = {}): ApiRequest {
  ipCounter++;
  return {
    method: "POST",
    headers: { "x-forwarded-for": `10.0.0.${ipCounter % 250}`, origin: "http://localhost:5173" },
    body: { ...VALID_INPUT },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  };
}

async function call(character: "turtle" | "owl" | "fox", req: ApiRequest) {
  const { res, captured } = makeRes();
  await createCharacterHandler(character)(req, res);
  return captured;
}

// ─── Happy path ────────────────────────────────────────────────────────────

describe("POST /api/{character} — success", () => {
  test("each character returns its own payload shape", async () => {
    const turtle = await call("turtle", makeReq());
    assert.equal(turtle.statusCode, 200);
    assert.equal(turtle.body.character, "turtle");
    assert.ok(Array.isArray(turtle.body.payload.grounding));
    assert.ok(turtle.body.payload.reflectivePrompt.endsWith("?"));

    const owl = await call("owl", makeReq());
    assert.equal(owl.body.character, "owl");
    assert.ok(Array.isArray(owl.body.payload.known));
    assert.ok(Array.isArray(owl.body.payload.assumed));

    const fox = await call("fox", makeReq());
    assert.equal(fox.body.character, "fox");
    assert.ok(fox.body.payload.options.length >= 2);
    assert.ok(
      fox.body.payload.options.some((o: any) => o.id === fox.body.payload.recommendedId),
    );
  });

  test("the integrity verdict travels with every response", async () => {
    const out = await call("owl", makeReq());
    assert.equal(out.body.integrityReview.length, 1);
    assert.equal(out.body.integrityReview[0].tier, "tier1");
    assert.equal(out.body.integrityReview[0].verdict, "pass");
  });

  test("meta is honest about not being a live model", async () => {
    const out = await call("turtle", makeReq());
    assert.equal(out.body.meta.stub, true);
    assert.equal(out.body.meta.fallback, false);
    assert.equal(out.body.meta.model, "mock-deterministic");
    assert.equal(typeof out.body.meta.latencyMs, "number");
  });

  test("internal diagnostics never cross the network boundary", async () => {
    const out = await call("fox", makeReq());
    assert.ok(
      !("fallbackReason" in out.body.meta),
      "fallbackReason was serialised to the client",
    );
    assert.equal(JSON.stringify(out.body).includes("ANTHROPIC"), false);
  });

  test("prior conversation turns are accepted and do not change the contract", async () => {
    const out = await call(
      "owl",
      makeReq({
        body: {
          ...VALID_INPUT,
          turns: [
            { role: "user", content: "I keep going over it.", timestamp: "2026-01-01T00:00:00Z" },
            {
              role: "character",
              character: "turtle",
              content: "Let the out-breath be longer.",
              timestamp: "2026-01-01T00:01:00Z",
            },
          ],
        },
      }),
    );
    assert.equal(out.statusCode, 200);
    assert.equal(out.body.integrityReview[0].verdict, "pass");
  });
});

// ─── Guards ────────────────────────────────────────────────────────────────

describe("POST /api/{character} — guards", () => {
  test("a preflight is answered without touching the orchestrator", async () => {
    const out = await call("turtle", makeReq({ method: "OPTIONS" }));
    assert.equal(out.body, undefined);
  });

  test("GET is rejected with an Allow header", async () => {
    const out = await call("turtle", makeReq({ method: "GET" }));
    assert.equal(out.statusCode, 405);
    assert.equal(out.body.code, "METHOD_NOT_ALLOWED");
    assert.equal(out.headers["allow"], "POST, OPTIONS");
  });

  test("an oversized body is rejected before it is parsed", async () => {
    const out = await call(
      "turtle",
      makeReq({
        headers: { "x-forwarded-for": "10.9.9.1", "content-length": "99999" },
      }),
    );
    assert.equal(out.statusCode, 413);
    assert.equal(out.body.code, "PAYLOAD_TOO_LARGE");
  });

  test("a malformed intake is rejected with a reason, not a stack trace", async () => {
    const cases: Array<[string, unknown]> = [
      ["not an object", "hello"],
      ["empty description", { ...VALID_INPUT, conflictDescription: "   " }],
      ["unknown emotion", { ...VALID_INPUT, emotion: "livid" }],
      ["out-of-range intensity", { ...VALID_INPUT, intensity: 42 }],
      ["unknown goal", { ...VALID_INPUT, goal: "win" }],
      ["unknown urgency", { ...VALID_INPUT, urgency: "immediately" }],
    ];

    for (const [label, body] of cases) {
      const out = await call("fox", makeReq({ body }));
      assert.equal(out.statusCode, 400, label);
      assert.equal(out.body.code, "INVALID_INPUT", label);
      assert.equal(typeof out.body.error, "string", label);
      assert.ok(!/\bat \w+ \(/.test(out.body.error), `${label} leaked a stack frame`);
    }
  });

  test("malformed conversation history is rejected", async () => {
    const cases: Array<[string, unknown]> = [
      ["turns not an array", { ...VALID_INPUT, turns: "nope" }],
      ["turn not an object", { ...VALID_INPUT, turns: ["nope"] }],
      ["unknown role", { ...VALID_INPUT, turns: [{ role: "admin", content: "x" }] }],
      ["non-string content", { ...VALID_INPUT, turns: [{ role: "user", content: 5 }] }],
      [
        "character turn with no character",
        { ...VALID_INPUT, turns: [{ role: "character", content: "x" }] },
      ],
      [
        "too many turns",
        {
          ...VALID_INPUT,
          turns: Array.from({ length: MAX_TURNS + 1 }, () => ({ role: "user", content: "x" })),
        },
      ],
    ];

    for (const [label, body] of cases) {
      const out = await call("owl", makeReq({ body }));
      assert.equal(out.statusCode, 400, label);
      assert.equal(out.body.code, "INVALID_INPUT", label);
    }
  });

  test("a missing timestamp is repaired rather than rejected", async () => {
    // Clock formatting differences are not worth refusing a whole request
    // over — the field only orders a summary.
    const out = await call(
      "turtle",
      makeReq({ body: { ...VALID_INPUT, turns: [{ role: "user", content: "x" }] } }),
    );
    assert.equal(out.statusCode, 200);
  });

  test("sustained traffic from one IP is rate limited with Retry-After", async () => {
    const ip = "10.77.77.77";
    let limited: Captured | undefined;

    for (let i = 0; i < 40; i++) {
      const out = await call("fox", makeReq({ headers: { "x-forwarded-for": ip } }));
      if (out.statusCode === 429) {
        limited = out;
        break;
      }
    }

    assert.ok(limited, "the limiter never engaged");
    assert.equal(limited.body.code, "RATE_LIMITED");
    assert.ok(Number(limited.headers["retry-after"]) > 0);
  });
});
