/**
 * characterIntegrity.test.ts
 *
 * Two things are being protected here, and they are related:
 *
 *   1. Tier 1 actually catches the role violations it claims to catch — the
 *      Turtle advising, the Owl asserting certainty, the Fox pressuring.
 *   2. The deterministic engine — which is both the mock provider's output
 *      and the production fallback — never trips any of them. If it did, the
 *      app's own safety net would be shipping content it considers a
 *      violation.
 *
 * The negative cases matter as much as the positive ones. A checker that
 * flags the Turtle for saying "notice your breath" would be training the
 * characters out of their correct behaviour.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import type {
  EmotionOption,
  GoalOption,
  PanelInput,
  UrgencyOption,
} from "../api/_lib/types";
import type {
  FoxPayload,
  OwlPayload,
  TurtlePayload,
} from "../api/_lib/orchestrator";
import { buildDeterministicPayload } from "../api/_lib/deterministic";
import { runTier1, toReviewSlot } from "../api/_lib/tier1";

const INPUT: PanelInput = {
  conflictDescription: "He said he'd call and then went silent for three days.",
  emotion: "hurt",
  intensity: 6,
  goal: "get clarity",
  urgency: "soon",
};

const EMOTIONS: EmotionOption[] = [
  "angry", "hurt", "confused", "frustrated", "anxious", "disappointed", "sad", "other",
];
const GOALS: GoalOption[] = [
  "fix relationship", "set boundary", "get clarity", "respond calmly",
  "protect myself", "decide whether to act", "other",
];
const URGENCIES: UrgencyOption[] = ["now", "soon", "can wait"];

function criteria(character: "turtle" | "owl" | "fox", payload: unknown): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return runTier1(character as any, payload as any).findings.map((f) => f.criterionId);
}

// ─── The safety net is itself safe ─────────────────────────────────────────

describe("deterministic payloads pass Tier 1 across the whole input space", () => {
  test("every emotion × goal × urgency × intensity band, for all three characters", () => {
    let checked = 0;

    for (const emotion of EMOTIONS) {
      for (const goal of GOALS) {
        for (const urgency of URGENCIES) {
          for (const intensity of [1, 5, 7, 10]) {
            const input: PanelInput = { ...INPUT, emotion, goal, urgency, intensity };

            for (const character of ["turtle", "owl", "fox"] as const) {
              const payload = buildDeterministicPayload(character, input);
              const outcome = runTier1(character, payload);
              assert.ok(
                outcome.passed,
                `${character} failed for ${emotion}/${goal}/${urgency}@${intensity}: ` +
                  outcome.findings.map((f) => `${f.criterionId} — ${f.detail}`).join("; "),
              );
              checked++;
            }
          }
        }
      }
    }

    assert.equal(checked, EMOTIONS.length * GOALS.length * URGENCIES.length * 4 * 3);
  });

  test("an empty conflict description does not produce a broken payload", () => {
    // The intake allows skipping the description; the fallback must still hold.
    const input: PanelInput = { ...INPUT, conflictDescription: "" };
    for (const character of ["turtle", "owl", "fox"] as const) {
      const outcome = runTier1(character, buildDeterministicPayload(character, input));
      assert.ok(outcome.passed, `${character}: ${outcome.findings.map((f) => f.detail).join("; ")}`);
    }
  });

  test("the generator is deterministic — same input, same words", () => {
    const a = buildDeterministicPayload("owl", INPUT);
    const b = buildDeterministicPayload("owl", INPUT);
    assert.deepEqual(a, b);
  });
});

// ─── Character contracts, positively stated ────────────────────────────────

describe("deterministic payloads honour each character's contract", () => {
  test("the Turtle closes with a question, not an instruction", () => {
    const t = buildDeterministicPayload("turtle", INPUT) as TurtlePayload;
    assert.ok(t.reflectivePrompt.trim().endsWith("?"));
    assert.ok(t.grounding.length > 0);
  });

  test("high intensity plus 'now' makes the Turtle counsel waiting", () => {
    const t = buildDeterministicPayload(
      "turtle",
      { ...INPUT, intensity: 9, urgency: "now" },
    ) as TurtlePayload;
    assert.ok(t.caution, "no caution offered at the moment it matters most");
    assert.match(t.caution ?? "", /wait/i);
  });

  test("the Owl always separates what is known from what is assumed", () => {
    const o = buildDeterministicPayload("owl", INPUT) as OwlPayload;
    assert.ok(o.known.length > 0);
    assert.ok(o.assumed.length > 0);
    assert.ok(o.alternatives.length >= 2, "one alternative is just a second opinion");
  });

  test("the Owl reads silence as ambiguous rather than as a verdict", () => {
    const o = buildDeterministicPayload(
      "owl",
      { ...INPUT, conflictDescription: "She ignored my message and went silent." },
    ) as OwlPayload;
    assert.ok(o.assumed.some((a) => /silence is ambiguous/i.test(a)));
  });

  test("the Fox always keeps waiting on the table and resolves its recommendation", () => {
    const f = buildDeterministicPayload("fox", INPUT) as FoxPayload;
    assert.ok(f.options.some((o) => o.timing === "Wait"));
    assert.ok(f.options.some((o) => o.id === f.recommendedId));
    for (const option of f.options) {
      assert.ok(option.likelyOutcome.trim().length > 0, `${option.id} states no cost`);
    }
  });

  test("at high intensity the Fox recommends not moving, whatever the stated goal", () => {
    // The app's core thesis, encoded: intensity overrides intent.
    for (const goal of GOALS) {
      const f = buildDeterministicPayload(
        "fox",
        { ...INPUT, goal, intensity: 9 },
      ) as FoxPayload;
      assert.equal(f.recommendedId, "wait", `goal "${goal}" overrode high intensity`);
    }
  });
});

// ─── Tier 1 catches real violations ────────────────────────────────────────

describe("Tier 1 — Turtle", () => {
  const ok: TurtlePayload = {
    acknowledgment: "That sounds heavy.",
    grounding: ["Let the out-breath be longer than the in-breath."],
    reflectivePrompt: "What would you need to feel before this stopped feeling urgent?",
  };

  test("grounding invitations are not treated as instructions", () => {
    // "Notice", "let", "breathe", "stay" are the Turtle's native register.
    const payload: TurtlePayload = {
      ...ok,
      grounding: [
        "Notice where this is living in your body.",
        "Let the out-breath be longer.",
        "Stay with it a moment longer than is comfortable.",
        "Take the weight off the question for now.",
      ],
    };
    assert.deepEqual(criteria("turtle", payload), []);
  });

  test("a second-person obligation is caught", () => {
    const payload: TurtlePayload = { ...ok, caution: "You should call her tonight." };
    assert.ok(criteria("turtle", payload).includes("turtle.no-advice"));
  });

  test("an action-directive aimed at the conflict is caught", () => {
    const payload: TurtlePayload = {
      ...ok,
      grounding: ["Breathe slowly.", "Tell him exactly how this landed."],
    };
    assert.ok(criteria("turtle", payload).includes("turtle.no-advice"));
  });

  test("a prompt that asserts instead of asking is caught", () => {
    const payload: TurtlePayload = { ...ok, reflectivePrompt: "This will pass." };
    assert.ok(criteria("turtle", payload).includes("turtle.ends-in-question"));
  });

  test("empty grounding is caught — it is the Turtle's whole function", () => {
    assert.ok(criteria("turtle", { ...ok, grounding: [] }).includes("turtle.has-grounding"));
  });
});

describe("Tier 1 — Owl", () => {
  const ok: OwlPayload = {
    known: ["He said he would call."],
    assumed: ["That the silence was aimed at you."],
    alternatives: ["He was overwhelmed.", "He forgot and is now embarrassed."],
    reframes: ["Separate what happened from what it means."],
  };

  test("a well-formed reading passes", () => {
    assert.deepEqual(criteria("owl", ok), []);
  });

  test("unhedged certainty is caught — calibration is the Owl's value", () => {
    const payload: OwlPayload = { ...ok, reframes: ["He clearly does not care."] };
    assert.ok(criteria("owl", payload).includes("owl.calibrated-certainty"));
  });

  test("a single alternative is caught", () => {
    assert.ok(
      criteria("owl", { ...ok, alternatives: ["He was busy."] }).includes("owl.multiple-readings"),
    );
  });

  test("collapsing the fact/assumption split is caught on either side", () => {
    assert.ok(criteria("owl", { ...ok, known: [] }).includes("owl.separates-known"));
    assert.ok(criteria("owl", { ...ok, assumed: [] }).includes("owl.separates-assumed"));
  });

  test("the Owl crossing into advice is caught", () => {
    const payload: OwlPayload = { ...ok, reframes: ["You need to confront him."] };
    assert.ok(criteria("owl", payload).includes("owl.no-advice"));
  });
});

describe("Tier 1 — Fox", () => {
  const option = (id: string, timing: FoxPayload["options"][number]["timing"]) => ({
    id,
    title: `Option ${id}`,
    timing,
    description: "A described move.",
    likelyOutcome: "A stated, plausible consequence.",
    strength: "Why it might suit.",
  });

  const ok: FoxPayload = {
    options: [option("wait", "Wait"), option("ask", "Act soon")],
    recommendedId: "wait",
    reasoning: "Waiting costs least and can still be undone.",
  };

  test("a genuine choice passes", () => {
    assert.deepEqual(criteria("fox", ok), []);
  });

  test("proposing action is NOT flagged as advice — it is the Fox's function", () => {
    const payload: FoxPayload = {
      ...ok,
      reasoning: "Tell her plainly what you need. You should not wait on this forever.",
    };
    // Directive language is scored for the Turtle and the Owl, never the Fox.
    assert.deepEqual(criteria("fox", payload), []);
  });

  test("a single option is not a choice", () => {
    const payload: FoxPayload = { ...ok, options: [option("ask", "Act soon")], recommendedId: "ask" };
    assert.ok(criteria("fox", payload).includes("fox.real-choice"));
  });

  test("a recommendation pointing at nothing is caught", () => {
    assert.ok(
      criteria("fox", { ...ok, recommendedId: "nope" }).includes("fox.recommendation-resolves"),
    );
  });

  test("removing waiting entirely is caught", () => {
    const payload: FoxPayload = {
      ...ok,
      options: [option("ask", "Act soon"), option("state", "Act now")],
      recommendedId: "ask",
    };
    assert.ok(criteria("fox", payload).includes("fox.waiting-available"));
  });

  test("an option with no stated cost is caught", () => {
    const payload: FoxPayload = {
      ...ok,
      options: [option("wait", "Wait"), { ...option("ask", "Act soon"), likelyOutcome: "  " }],
    };
    assert.ok(criteria("fox", payload).includes("fox.states-consequences"));
  });

  test("coercive framing is disqualifying", () => {
    const payload: FoxPayload = {
      ...ok,
      reasoning: "Use the guilt to get them to apologise before it's too late.",
    };
    assert.ok(criteria("fox", payload).includes("fox.no-manipulation"));
  });
});

describe("Tier 1 — the subjunctive is not a directive", () => {
  // Regression. An earlier MODAL_DIRECTIVE matched "would you have to" and
  // "would you need to", flagging the Owl and the Turtle for their single
  // most characteristic move: inviting the user to imagine an alternative.
  const subjunctives = [
    "What would you have to be wrong about for this to look completely different?",
    "What would you need to feel before this stopped feeling urgent?",
    "Could you need something you have not named yet?",
    "What might you have to give up to let this go?",
  ];

  test("hypothetical phrasing passes for the Turtle", () => {
    for (const prompt of subjunctives) {
      const payload: TurtlePayload = {
        acknowledgment: "That sounds heavy.",
        grounding: [prompt],
        reflectivePrompt: "What is here right now?",
      };
      assert.deepEqual(criteria("turtle", payload), [], `flagged: ${prompt}`);
    }
  });

  test("hypothetical phrasing passes for the Owl", () => {
    for (const reframe of subjunctives) {
      const payload: OwlPayload = {
        known: ["He said he would call."],
        assumed: ["That the silence was aimed at you."],
        alternatives: ["He was overwhelmed.", "He forgot."],
        reframes: [reframe],
      };
      assert.deepEqual(criteria("owl", payload), [], `flagged: ${reframe}`);
    }
  });

  test("the genuine obligation is still caught alongside it", () => {
    const payload: OwlPayload = {
      known: ["He said he would call."],
      assumed: ["That the silence was aimed at you."],
      alternatives: ["He was overwhelmed.", "He forgot."],
      reframes: [
        "What would you have to be wrong about here?",
        "You have to stop waiting for him.",
      ],
    };
    assert.ok(criteria("owl", payload).includes("owl.no-advice"));
  });
});

describe("Tier 1 — universal", () => {
  test("diagnosis of the absent third person is caught, not just 'you' and 'they'", () => {
    // Regression. The natural phrasing is about the other person, and an
    // earlier pattern only matched second person and plural third person —
    // so the most likely violation in practice went through unflagged.
    const phrasings = [
      "He is a narcissist.",
      "She's gaslighting you.",
      "He was abusive and you know it.",
      "She is clearly depressed.",
      "That person is a sociopath.",
      "He has ptsd from it.",
    ];

    for (const line of phrasings) {
      const payload: TurtlePayload = {
        acknowledgment: line,
        grounding: ["Let the breath slow."],
        reflectivePrompt: "What do you need right now?",
      };
      assert.ok(
        criteria("turtle", payload).includes("universal.no-diagnosis"),
        `not caught: ${line}`,
      );
    }
  });

  test("ordinary description of a person is not mistaken for a diagnosis", () => {
    const payload: OwlPayload = {
      known: ["He is a friend of ten years."],
      assumed: ["That he is aware of the effect."],
      alternatives: ["They are managing something you cannot see.", "He forgot."],
      reframes: ["What is the smallest thing you could learn?"],
    };
    assert.deepEqual(criteria("owl", payload), []);
  });

  test("diagnostic overreach is caught for every character", () => {
    const turtle: TurtlePayload = {
      acknowledgment: "He is a narcissist and you are not imagining it.",
      grounding: ["Let the breath slow."],
      reflectivePrompt: "What do you need right now?",
    };
    assert.ok(criteria("turtle", turtle).includes("universal.no-diagnosis"));

    const owl: OwlPayload = {
      known: ["This is abuse."],
      assumed: ["That you know why."],
      alternatives: ["One reading.", "Another reading."],
      reframes: ["A reframe."],
    };
    assert.ok(criteria("owl", owl).includes("universal.no-diagnosis"));
  });
});

// ─── Review slot adaptation ────────────────────────────────────────────────

describe("toReviewSlot", () => {
  test("a pass becomes a pass verdict with no violated criteria", () => {
    const slot = toReviewSlot(runTier1("owl", buildDeterministicPayload("owl", INPUT)));
    assert.equal(slot.tier, "tier1");
    assert.equal(slot.verdict, "pass");
    assert.deepEqual(slot.violatedCriteria, []);
    assert.equal(slot.reviewerModel, "tier1-heuristics/api");
  });

  test("a violation carries its criterion ids and a readable summary", () => {
    const slot = toReviewSlot(
      runTier1("owl", {
        known: [],
        assumed: [],
        alternatives: [],
        reframes: ["It is obviously her fault."],
      }),
    );
    assert.equal(slot.verdict, "violation");
    assert.ok((slot.violatedCriteria ?? []).includes("owl.calibrated-certainty"));
    assert.ok((slot.summary ?? "").length > 0);
  });

  test("evidence is clipped, never the whole payload", () => {
    const outcome = runTier1("turtle", {
      acknowledgment: "x".repeat(5000),
      grounding: ["Tell him " + "y".repeat(5000)],
      reflectivePrompt: "What now?",
    });
    for (const finding of outcome.findings) {
      assert.ok((finding.evidence ?? "").length <= 120, "evidence was not clipped");
    }
  });
});
