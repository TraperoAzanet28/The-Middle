/**
 * deterministic.ts — model-free character payload generation.
 *
 * Two jobs, both important:
 *
 *   1. It is what the mock provider returns, so the whole conversation flow
 *      can be built and tested end to end without spending a cent on model
 *      calls.
 *   2. It is the fallback when a real model call fails. Per the ADR, a
 *      timeout or a malformed tool-call response must never surface as an
 *      error in the UI — this app's entire purpose is helping someone settle,
 *      and an error dialog at the moment a user has just described something
 *      painful is the worst possible outcome. The character says something
 *      true and useful instead, and the user never learns a model was down.
 *
 * Because of (2) this code must never throw and must never depend on network,
 * env, or clock state beyond what is passed in.
 *
 * Cross-boundary note: src/lib/panelEngine.ts does a richer version of this
 * for the frontend. It is deliberately NOT imported — /api must build without
 * the frontend pipeline (see the header of types.ts). This is a mirror, and
 * the two are expected to drift in wording, not in shape.
 */

import type {
  CharacterName,
  EmotionOption,
  GoalOption,
  PanelInput,
  UrgencyOption,
} from "./types.js";
import type {
  CharacterPayload,
  FoxPayload,
  OwlPayload,
  StrategyOptionPayload,
  TurtlePayload,
} from "./orchestrator.js";

// ─── Small text helpers ────────────────────────────────────────────────────

/** Trim, collapse whitespace, and drop a trailing period for inlining. */
function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ").replace(/\.$/, "");
}

/** First sentence of the user's description, capped so quotes stay readable. */
function firstSentence(text: string): string {
  const cleaned = tidy(text);
  if (!cleaned) return "";
  const match = cleaned.match(/^(.{0,160}?)(?:[.!?]|$)/);
  const sentence = (match?.[1] ?? cleaned).trim();
  return sentence.length > 160 ? `${sentence.slice(0, 157).trim()}…` : sentence;
}

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

// ─── Turtle: emotional regulation ──────────────────────────────────────────
//
// The Turtle names what is happening in the body and slows the pace. It does
// NOT analyse the situation (Owl) and does NOT suggest what to do (Fox).
// Its closing move is always a question, never an instruction.

const EMOTION_BODY: Record<EmotionOption, string> = {
  angry: "heat in the chest and jaw, and a pull toward saying it now",
  hurt: "a tightness behind the sternum, the kind that wants to withdraw",
  confused: "a restless loop that starts over every time it reaches the end",
  frustrated: "a clenched, stop-start energy with nowhere to discharge",
  anxious: "a fast, shallow breath and a mind running ahead of the facts",
  disappointed: "a heaviness that settles rather than spikes",
  sad: "a slow, weighted quiet that asks to be left alone",
  other: "something that has not found its name yet",
};

function turtlePayload(input: PanelInput): TurtlePayload {
  const quoted = firstSentence(input.conflictDescription);
  const body = EMOTION_BODY[input.emotion] ?? EMOTION_BODY.other;
  const high = input.intensity >= 7;

  const acknowledgment = quoted
    ? `You said: "${quoted}". That is a real thing to be carrying, and you are carrying it at about ${input.intensity} out of 10 — ${body}.`
    : `Something is sitting at about ${input.intensity} out of 10 right now — ${body}.`;

  const grounding = [
    "Let the out-breath be longer than the in-breath, four or five times. Nothing else has to change yet.",
    high
      ? "Notice where this is living in your body. You are not trying to make it leave — only to know where it is."
      : "Notice what is steady right now: the weight of you on the chair, the temperature of the room.",
    "The situation will still be there in ten minutes. Nothing is being lost by arriving at it slower.",
  ];

  const reflectivePrompt = high
    ? "If this feeling could speak without needing to be right, what would it say it is protecting?"
    : "What would you need to feel before this stopped feeling urgent?";

  const caution =
    input.urgency === "now" && high
      ? "This feels urgent and it is intense. Those two together are usually the moment to wait, not the moment to move."
      : undefined;

  return caution
    ? { acknowledgment, grounding, reflectivePrompt, caution }
    : { acknowledgment, grounding, reflectivePrompt };
}

// ─── Owl: perception and clarity ───────────────────────────────────────────
//
// The Owl separates what is observed from what is inferred. It does not
// soothe (Turtle) and does not recommend (Fox). Its value is the distinction
// between fact and interpretation.

function owlPayload(input: PanelInput): OwlPayload {
  const desc = input.conflictDescription;
  const quoted = firstSentence(desc);

  const known: string[] = [];
  if (quoted) known.push(`Something happened that you described as: "${quoted}".`);
  known.push(`You are feeling ${input.emotion === "other" ? "something hard to name" : input.emotion}, at roughly ${input.intensity} out of 10.`);
  known.push(`What you want from this is to ${input.goal === "other" ? "work out what you want" : input.goal}.`);
  if (includesAny(desc, ["said", "told", "wrote", "texted", "called"])) {
    known.push("Specific words were exchanged. Those words are evidence; what they meant is not yet.");
  }
  if (includesAny(desc, ["again", "always", "every time", "keeps", "twice", "repeatedly"])) {
    known.push("You have placed this in a pattern, which means it is not the first time.");
  }

  const assumed: string[] = [];
  if (includesAny(desc, ["ignor", "avoid", "silent", "ghost", "didn't reply", "did not reply"])) {
    assumed.push("That the silence was chosen and aimed at you. Silence is ambiguous — it can be avoidance, overwhelm, or inattention.");
  }
  if (includesAny(desc, ["always", "never", "every time", "keeps"])) {
    assumed.push("That the pattern is stable and will continue. A pattern describes the past; it predicts only weakly.");
  }
  if (includesAny(desc, ["don't care", "doesn't care", "not care", "disrespect"])) {
    assumed.push("That their behaviour reflects what they feel about you. Behaviour is usually about the person doing it.");
  }
  assumed.push("That you know why they did it. A reason has probably already assembled itself — notice that you were not told it.");
  if (input.intensity >= 7) {
    assumed.push("That the intensity of the feeling is evidence of the size of the problem. Intensity measures you, not the event.");
  }

  const alternatives = [
    "They were managing something you cannot see, and this had little to do with you.",
    "They are aware something is wrong and do not know how to begin.",
    "The meaning you have attached to this is not the meaning they attached to it.",
    "Both of you are responding to a version of the other that is partly constructed.",
  ];

  const GOAL_REFRAME: Record<GoalOption, string> = {
    "fix relationship": "What if repair does not require agreement about what happened?",
    "set boundary": "A boundary describes what you will do, not what they must stop doing.",
    "get clarity": "What is the smallest thing you could learn that would change your reading of this?",
    "respond calmly": "Calm is not the absence of the feeling. It is the feeling without the obligation to obey it.",
    "protect myself": "What are you protecting — your safety, or your account of events?",
    "decide whether to act": "Not acting is also an action. What would a week of not acting cost?",
    other: "What would you have to be wrong about for this to look completely different?",
  };

  const reframes = [
    GOAL_REFRAME[input.goal] ?? GOAL_REFRAME.other,
    "Separate what happened from what it means. Only one of those is available to you right now.",
  ];

  return { known, assumed, alternatives, reframes };
}

// ─── Fox: strategic action ─────────────────────────────────────────────────
//
// The Fox turns insight into a move. Options are real alternatives with real
// costs, including waiting — never manipulation, never a single "right"
// answer dressed up as a choice.

const TIMING_BY_URGENCY: Record<UrgencyOption, StrategyOptionPayload["timing"]> = {
  now: "Act soon",
  soon: "Act soon",
  "can wait": "Wait",
};

function foxPayload(input: PanelInput): FoxPayload {
  const high = input.intensity >= 7;
  const baseTiming = TIMING_BY_URGENCY[input.urgency] ?? "Act soon";

  const options: StrategyOptionPayload[] = [
    {
      id: "wait",
      title: "Let it settle first",
      timing: "Wait",
      description:
        "Do nothing for a day. Not avoidance — a deliberate pause so the next move comes from you rather than from the feeling.",
      likelyOutcome:
        "The urgency drops and about half of what felt essential to say turns out not to be.",
      strength: "Costs almost nothing and is the only option you can take after taking any of the others.",
    },
    {
      id: "ask",
      title: "Ask one plain question",
      timing: baseTiming,
      description:
        "Ask about the thing itself, without the interpretation attached. One sentence, no preamble, no case being built.",
      likelyOutcome:
        "You get information instead of a reaction, and the assumptions become testable.",
      strength: "Low cost, high information. If clarity is what you want, a question gets there faster than a statement.",
    },
    {
      id: "state",
      title: "Say what you need",
      timing: baseTiming,
      description:
        "Name the effect it had on you and what you would like to be different. Describe your own position, not their character.",
      likelyOutcome:
        "They learn something they may genuinely not have known. It may land badly at first.",
      strength: "Changes the situation rather than only your understanding of it.",
    },
    {
      id: "step-back",
      title: "Change your own exposure",
      timing: "Wait",
      description:
        "Leave the conversation where it is and adjust what you rely on this person for.",
      likelyOutcome:
        "The immediate friction eases; the underlying thing stays unresolved and may resurface.",
      strength: "Available without their cooperation, which matters if cooperation has not been forthcoming.",
    },
  ];

  const GOAL_PICK: Record<GoalOption, string> = {
    "fix relationship": "ask",
    "set boundary": "state",
    "get clarity": "ask",
    "respond calmly": "wait",
    "protect myself": "step-back",
    "decide whether to act": "wait",
    other: "ask",
  };

  // Intensity overrides intent: at high activation the first move is almost
  // always to not move. This mirrors the app's core thesis.
  const recommendedId = high && input.urgency !== "now"
    ? "wait"
    : high
      ? "wait"
      : (GOAL_PICK[input.goal] ?? "ask");

  const recommended = options.find((o) => o.id === recommendedId) ?? options[0];

  const reasoning = high
    ? `At ${input.intensity} out of 10, the limiting factor is not what to say — it is that anything said now will carry the intensity with it. "${recommended.title}" is recommended because it is the move least likely to need undoing.`
    : `You said you want to ${input.goal === "other" ? "work out what you want" : input.goal}, and the feeling is at a level you can think through. "${recommended.title}" matches that intent most directly.`;

  return { options, recommendedId: recommended.id, reasoning };
}

// ─── Public entry point ────────────────────────────────────────────────────

/**
 * Build a character payload with no model call.
 *
 * Deterministic: the same input always yields the same output, which is what
 * makes it usable both as a test fixture and as a fallback a user might
 * plausibly be shown twice.
 */
export function buildDeterministicPayload<C extends CharacterName>(
  character: C,
  input: PanelInput,
): CharacterPayload<C> {
  switch (character) {
    case "turtle":
      return turtlePayload(input) as CharacterPayload<C>;
    case "owl":
      return owlPayload(input) as CharacterPayload<C>;
    default:
      return foxPayload(input) as CharacterPayload<C>;
  }
}
