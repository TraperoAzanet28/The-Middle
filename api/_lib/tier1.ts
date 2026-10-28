/**
 * tier1.ts — synchronous Character Integrity checks for the /api boundary.
 *
 * WHAT THIS IS
 *
 * Tier 1 of the two-tier Character Integrity Supervisor: cheap, deterministic,
 * no model call, runs inline on every generated payload before it is returned
 * to the client. It catches STRUCTURAL and LEXICAL-PATTERN role violations —
 * the Turtle handing out advice, the Owl asserting certainty, the Fox
 * pressuring toward one answer. Subtle semantic judgment is Tier 2's job and
 * is not implemented here.
 *
 * WHY IT IS A MIRROR AND NOT AN IMPORT
 *
 * src/lib/integritySupervisor/tier1Checks.ts is the fuller implementation
 * (~800 lines, per-criterion rubric scoring). It is not imported for the same
 * reason types.ts is not imported: /api must build and deploy without the
 * frontend pipeline. This file is a deliberately SMALLER mirror covering the
 * highest-value checks, operating on the structured payload rather than on
 * raw prose — which it can do, and the frontend version cannot, because the
 * payload shape is known here.
 *
 * WHY IT IS ADVISORY BY DEFAULT
 *
 * A violation annotates the response; it does not block it. The ADR leaves
 * the blocking policy open, and failing closed would mean showing a user an
 * error at the exact moment they have just described something painful. An
 * imperfect-but-caring response beats a blank screen. The verdict travels
 * with the response so the decision can be revisited without a rewrite.
 */

import type { CharacterName } from "./types.js";
import type {
  CharacterPayload,
  FoxPayload,
  IntegrityReviewSlot,
  OwlPayload,
  TurtlePayload,
} from "./orchestrator.js";

// ─── Lexical patterns ──────────────────────────────────────────────────────

/**
 * Second-person obligation. The clearest signal that a character has stopped
 * reflecting and started instructing.
 *
 * Note this is checked for the Turtle and the Owl but NOT the Fox: proposing
 * a course of action is the Fox's entire function, and flagging it there
 * would be flagging the character for doing its job.
 *
 * The leading lookbehind excludes the SUBJUNCTIVE, which is the Owl's and the
 * Turtle's most characteristic construction and the opposite of a directive:
 *
 *   "What would you have to be wrong about for this to look different?"
 *   "What would you need to feel before this stopped feeling urgent?"
 *
 * Both are invitations to imagine, not instructions to obey. Flagging them
 * would penalise the two characters for their single best move. (Found by
 * characterIntegrity.test.ts, which runs the deterministic engine across the
 * full input space — these are real strings it emits.)
 */
const MODAL_DIRECTIVE =
  /(?<!\b(?:would|could|might|do|did|does)\s)\byou\s+(should|need to|must|have to|ought to)\b/i;

/**
 * Bare imperatives that open a sentence.
 *
 * Grounding idioms are deliberately excluded ("breathe", "notice", "let",
 * "stay", "take", "wait"): in the Turtle's voice those are invitations, not
 * instructions, and treating them as violations would flag the Turtle's
 * correct behaviour. Only action-directives aimed at the conflict appear.
 */
const DIRECTIVE_VERBS = [
  "stop", "call", "confront", "decide", "tell", "send", "text",
  "leave", "end", "quit", "demand", "insist", "block", "report",
];

/** Unhedged certainty. Corrosive for the Owl, whose value is calibration. */
const CERTAINTY_MARKERS = [
  /\bdefinitely\b/i,
  /\bobviously\b/i,
  /\bclearly\b/i,
  /\bundeniably\b/i,
  /\bwithout question\b/i,
  /\bno doubt\b/i,
  /\bguaranteed?\b/i,
  /\bthe truth is\b/i,
  /\bthere is no other\b/i,
];

/** Coercion and pressure. Disqualifying for the Fox, whose strategy must not manipulate. */
const COERCIVE_MARKERS = [
  /\bmake them\b/i,
  /\bget them to\b/i,
  /\bso they have no choice\b/i,
  /\bleverage\b/i,
  /\bguilt\b/i,
  /\bmanipulat/i,
  /\bbefore it'?s too late\b/i,
];

/**
 * Clinical/diagnostic overreach. Out of bounds for every character — none of
 * them is a clinician, and the person being labelled is not in the room to
 * answer for themselves.
 *
 * The subject list covers third-person singular, not just "you" and "they".
 * The overwhelmingly common phrasing is about the absent other person — "he
 * is a narcissist", "she's gaslighting you" — and an earlier version of this
 * pattern matched neither.
 */
const DIAGNOSTIC_MARKERS = [
  // The {0,2} slot absorbs an intervening article and/or adverb, so hedged
  // and emphatic phrasings ("is clearly depressed", "is just a narcissist")
  // are caught as readily as the bare form.
  /\b(?:you|they|he|she|it|this person|that person)\s*(?:are|is|'s|’s|'re|’re|was|were)\s+(?:(?:\w+ly|an?|just)\s+){0,2}(?:narcissis(?:t|tic)|socio-?path(?:ic)?|psycho-?path(?:ic)?|bipolar|depressed|depressive|gaslighting|abusive|abuser)\b/i,
  /\b(?:you|they|he|she)\s*(?:have|has|'ve|’ve)\s+(?:anxiety|depression|trauma|ptsd|bpd|npd)\b/i,
  /\bthis is abuse\b/i,
];

// ─── Finding model ─────────────────────────────────────────────────────────

export interface Tier1Finding {
  /** Stable id so violations can be counted and compared across runs. */
  criterionId: string;
  /** Short, human-scannable statement of what went wrong. */
  detail: string;
  /** The offending text, for audit. Truncated — never the whole payload. */
  evidence?: string;
}

export interface Tier1Outcome {
  character: CharacterName;
  passed: boolean;
  findings: Tier1Finding[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clip(text: string, max = 120): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return undefined;
}

/** Flatten any payload to a single string for lexical scanning. */
function payloadText(payload: unknown): string {
  const parts: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(payload);
  return parts.join(" ");
}

function findDirectiveSentence(text: string): { sentence: string; reason: string } | undefined {
  for (const sentence of splitSentences(text)) {
    const cleaned = sentence.replace(/^[-–•\d.\s"']+/, "");
    if (MODAL_DIRECTIVE.test(cleaned)) {
      return { sentence: cleaned, reason: "second-person obligation (you should / need to / must)" };
    }
    const firstWord = cleaned.split(/\s+/)[0]?.replace(/[^a-zA-Z']/g, "").toLowerCase();
    if (firstWord && DIRECTIVE_VERBS.includes(firstWord)) {
      return { sentence: cleaned, reason: `sentence opens with the directive verb "${firstWord}"` };
    }
  }
  return undefined;
}

// ─── Per-character checks ──────────────────────────────────────────────────

function checkTurtle(payload: TurtlePayload, findings: Tier1Finding[]): void {
  // The Turtle regulates; it does not advise. Grounding invitations are fine,
  // instructions about the conflict are not.
  const advisory = [payload.acknowledgment, ...payload.grounding, payload.caution ?? ""]
    .filter(Boolean)
    .join(" ");
  const directive = findDirectiveSentence(advisory);
  if (directive) {
    findings.push({
      criterionId: "turtle.no-advice",
      detail: `Turtle gave an instruction rather than reflecting: ${directive.reason}.`,
      evidence: clip(directive.sentence),
    });
  }

  // The Turtle's closing move is a question. An assertion closes reflection
  // down at precisely the point it should be opening.
  if (!payload.reflectivePrompt.trim().endsWith("?")) {
    findings.push({
      criterionId: "turtle.ends-in-question",
      detail: "Turtle's reflective prompt is not phrased as a question.",
      evidence: clip(payload.reflectivePrompt),
    });
  }

  if (payload.grounding.length === 0) {
    findings.push({
      criterionId: "turtle.has-grounding",
      detail: "Turtle returned no grounding content, which is its primary function.",
    });
  }
}

function checkOwl(payload: OwlPayload, findings: Tier1Finding[]): void {
  // The Owl's whole contribution is the fact/inference split. Collapsing
  // either side makes the response indistinguishable from an opinion.
  if (payload.known.length === 0) {
    findings.push({
      criterionId: "owl.separates-known",
      detail: "Owl listed nothing as known, so no fact/assumption distinction was offered.",
    });
  }
  if (payload.assumed.length === 0) {
    findings.push({
      criterionId: "owl.separates-assumed",
      detail: "Owl surfaced no assumptions, which is the distinction it exists to draw.",
    });
  }

  // Multiple readings are the point; one alternative is just a second opinion.
  if (payload.alternatives.length < 2) {
    findings.push({
      criterionId: "owl.multiple-readings",
      detail: "Owl offered fewer than two alternative interpretations.",
    });
  }

  const text = payloadText(payload);
  const certainty = firstMatch(text, CERTAINTY_MARKERS);
  if (certainty) {
    findings.push({
      criterionId: "owl.calibrated-certainty",
      detail: "Owl asserted a certainty marker, undercutting its calibration.",
      evidence: clip(certainty),
    });
  }

  const directive = findDirectiveSentence(text);
  if (directive) {
    findings.push({
      criterionId: "owl.no-advice",
      detail: `Owl crossed into advice: ${directive.reason}.`,
      evidence: clip(directive.sentence),
    });
  }
}

function checkFox(payload: FoxPayload, findings: Tier1Finding[]): void {
  // Real agency requires real alternatives.
  if (payload.options.length < 2) {
    findings.push({
      criterionId: "fox.real-choice",
      detail: "Fox offered fewer than two options, which is not a choice.",
    });
  }

  // A recommendation pointing at nothing would render as a broken UI state.
  const ids = new Set(payload.options.map((o) => o.id));
  if (!ids.has(payload.recommendedId)) {
    findings.push({
      criterionId: "fox.recommendation-resolves",
      detail: `Fox recommended "${payload.recommendedId}", which is not among the options offered.`,
    });
  }

  // Waiting must stay on the table — it is frequently the wisest move and the
  // one a reactive user is least likely to generate for themselves.
  const offersPatience = payload.options.some((o) => o.timing === "Wait");
  if (!offersPatience) {
    findings.push({
      criterionId: "fox.waiting-available",
      detail: "Fox presented no option with 'Wait' timing, so acting was the only path shown.",
    });
  }

  // Each option must state a cost or consequence, or it is advocacy.
  for (const option of payload.options) {
    if (!option.likelyOutcome.trim()) {
      findings.push({
        criterionId: "fox.states-consequences",
        detail: `Fox option "${option.id}" has no stated likely outcome.`,
      });
    }
  }

  const coercive = firstMatch(payloadText(payload), COERCIVE_MARKERS);
  if (coercive) {
    findings.push({
      criterionId: "fox.no-manipulation",
      detail: "Fox used coercive framing. Strategy here must never shade into manipulation.",
      evidence: clip(coercive),
    });
  }
}

// ─── Entry point ───────────────────────────────────────────────────────────

/**
 * Run Tier 1 against a generated payload.
 *
 * Pure and synchronous: no I/O, no clock, no randomness, so the same payload
 * always yields the same verdict and the check adds no latency worth
 * measuring to a request.
 */
export function runTier1<C extends CharacterName>(
  character: C,
  payload: CharacterPayload<C>,
): Tier1Outcome {
  const findings: Tier1Finding[] = [];

  // Applies to every character: none of them is a clinician, and none has
  // enough information to diagnose a person who is not in the conversation.
  const diagnostic = firstMatch(payloadText(payload), DIAGNOSTIC_MARKERS);
  if (diagnostic) {
    findings.push({
      criterionId: "universal.no-diagnosis",
      detail: "Response made a clinical or diagnostic claim about a person.",
      evidence: clip(diagnostic),
    });
  }

  switch (character) {
    case "turtle":
      checkTurtle(payload as TurtlePayload, findings);
      break;
    case "owl":
      checkOwl(payload as OwlPayload, findings);
      break;
    default:
      checkFox(payload as FoxPayload, findings);
      break;
  }

  return { character, passed: findings.length === 0, findings };
}

/** Adapt a Tier 1 outcome into the review slot carried on CharacterResponse. */
export function toReviewSlot(outcome: Tier1Outcome): IntegrityReviewSlot {
  return {
    tier: "tier1",
    verdict: outcome.passed ? "pass" : "violation",
    violatedCriteria: outcome.findings.map((f) => f.criterionId),
    summary: outcome.passed
      ? "Tier 1 structural and lexical checks passed."
      : outcome.findings.map((f) => f.detail).join(" "),
    reviewerModel: "tier1-heuristics/api",
  };
}
