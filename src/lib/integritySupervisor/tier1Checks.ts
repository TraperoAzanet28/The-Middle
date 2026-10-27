/**
 * tier1Checks.ts
 *
 * Deterministic + heuristic "Tier 1" checks for the Character Integrity
 * Supervisor. These run cheaply, synchronously, with no model call, and
 * are meant to catch STRUCTURAL and LEXICAL-PATTERN signals of role
 * violation — not to fully adjudicate subtle semantic/philosophical
 * judgment calls (that is Tier 2's job; see tier2Interface.ts).
 *
 * Design principle: every check here reasons about SENTENCE STRUCTURE,
 * MODALITY, and CROSS-TURN RELATIONSHIPS — not a flat banned-word list.
 * Specifically:
 *
 *  - Imperative-mood detection looks at sentence POSITION (does the
 *    sentence open with a bare verb and no subject, i.e. true imperative
 *    mood?) combined with modal-directive patterns ("you should/need
 *    to/must"), not just presence of a word anywhere in the text.
 *  - Certainty calibration is a BALANCE of absolute-certainty markers
 *    against hedging markers in the same response, not a single keyword.
 *  - Epistemic self-consistency compares an EARLIER turn's stated
 *    epistemic stance against the CURRENT response, looking for a shift
 *    from hedged to certain with no "new evidence" marker bridging them —
 *    a genuinely cross-turn, structural comparison.
 *  - Alternative sufficiency COUNTS distinct option-introducing phrases
 *    and separately detects exclusivity language ("the only ...").
 *
 * Every check returns its matched evidence strings so a human (or Tier 2)
 * can audit exactly why a score was assigned.
 */

import {
  VIOLATION_THRESHOLD,
  type CharacterName,
  type RubricScore,
} from "./rubric";
import type { ConversationTurn } from "./fixtures/types";

// ─── shared text utilities ─────────────────────────────────────────────────

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const findMatches = (text: string, patterns: RegExp[]): string[] => {
  const hits: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) hits.push(match[0]);
  }
  return hits;
};

// A sentence is in TRUE IMPERATIVE MOOD if it opens directly with a bare
// base-form verb and no subject pronoun ("Call them tonight.") — this is a
// structural/positional check, not a keyword-anywhere-in-text check.
// Note: deliberately EXCLUDES verbs that double as common grounding idioms
// ("take" your time, "breathe" with me, "stay" with it, "let's" slow down,
// "wait" a moment, "trust" yourself) — those read as benign/invitational in
// Turtle's own voice far more often than as advice-giving. Tier 2 is the
// right place to disambiguate truly context-dependent cases.
const BARE_IMPERATIVE_VERBS = [
  "stop", "call", "confront", "decide", "tell", "ask", "set",
  "give", "do", "send", "talk", "leave", "end", "make", "get", "find",
  "write", "say", "quit", "file", "move", "forget", "focus", "accept",
];

// Modal-directive pattern: second-person subject + obligation modal. This
// is a grammatical-pattern check (pronoun + modal verb class), not a single
// banned word.
const MODAL_DIRECTIVE_PATTERN = /\byou\s+(should|need to|must|have to|ought to|'ve got to)\b/i;

export const isImperativeSentence = (sentence: string): { isImperative: boolean; reason?: string } => {
  const trimmed = sentence.trim().replace(/^[-–•\d.\s]+/, "");
  if (!trimmed) return { isImperative: false };

  if (MODAL_DIRECTIVE_PATTERN.test(trimmed)) {
    return { isImperative: true, reason: "modal-directive (you should/need to/must...)" };
  }

  const firstWord = trimmed.split(/\s+/)[0]?.replace(/[^a-zA-Z']/g, "").toLowerCase();
  if (firstWord && BARE_IMPERATIVE_VERBS.includes(firstWord)) {
    return { isImperative: true, reason: `bare imperative verb opens sentence ("${firstWord}")` };
  }

  return { isImperative: false };
};

export const findImperativeSentences = (text: string): { sentence: string; reason: string }[] => {
  const results: { sentence: string; reason: string }[] = [];
  for (const sentence of splitSentences(text)) {
    const check = isImperativeSentence(sentence);
    if (check.isImperative) {
      results.push({ sentence, reason: check.reason! });
    }
  }
  return results;
};

// ─── certainty / hedge lexicon (used as BALANCE signals, not alone) ───────

const CERTAINTY_MARKERS: RegExp[] = [
  /\bdefinitely\b/i,
  /\balways\b/i,
  /\bnever\b/i,
  /\bthe truth is\b/i,
  /\bclearly\b/i,
  /\bobviously\b/i,
  /\bundeniably\b/i,
  /\bguaranteed?\b/i,
  /\bcertainly\b/i,
  /\bwithout question\b/i,
  /\bthere is no other\b/i,
  /\bno doubt\b/i,
  /\bwill definitely\b/i,
  /\bthat'?s (just|simply) a fact\b/i,
  /\bas we established\b/i,
];

const HEDGE_MARKERS: RegExp[] = [
  /\bmight\b/i,
  /\bmaybe\b/i,
  /\bcould\b/i,
  /\bpossibly\b/i,
  /\bperhaps\b/i,
  /\bi wonder\b/i,
  /\bit'?s possible\b/i,
  /\bit sounds like\b/i,
  /\bone (possibility|way to)\b/i,
  /\bit seems\b/i,
  /\bin my experience\b/i,
  /\btends to\b/i,
  /\blikely\b/i,
  /\bprobably\b/i,
  /\bnot certain\b/i,
  /\bhard to know\b/i,
  /\bcould be wrong\b/i,
  /\bdoesn'?t (necessarily|really prove)\b/i,
  /\?\s*$/,
];

// A classic rhetorical pattern: hedge about alternatives, then pivot on a
// contrastive connector ("but"/"however") into an unhedged certainty claim
// that overrides everything just hedged. A plain hedge-vs-certainty WORD
// COUNT misses this because the hedges are real — they just aren't the
// claim actually being asserted. We check SENTENCE-LEVEL STRUCTURE (does a
// certainty marker occur after a contrastive connector, within the same
// clause-window) rather than counting words in isolation.
const CONTRASTIVE_OVERRIDE_PATTERN =
  /\b(but|however)\b[^.?!]*\b(definitely|clearly|obviously|certainly|no doubt|guaranteed?|the truth is)\b/i;

/** Returns a 1-5 calibration score from the balance of certainty vs hedge markers. */
const calibrationScore = (text: string): { score: RubricScore; certaintyHits: string[]; hedgeHits: string[] } => {
  const certaintyHits = findMatches(text, CERTAINTY_MARKERS);
  const hedgeHits = findMatches(text, HEDGE_MARKERS);

  const overrideMatch = text.match(CONTRASTIVE_OVERRIDE_PATTERN);
  if (overrideMatch) {
    return { score: 1, certaintyHits: [overrideMatch[0], ...certaintyHits], hedgeHits };
  }

  let score: RubricScore;
  if (certaintyHits.length === 0) {
    score = 5;
  } else if (hedgeHits.length >= certaintyHits.length) {
    score = 4;
  } else if (certaintyHits.length === 1) {
    score = 3;
  } else if (certaintyHits.length >= 2 && hedgeHits.length === 0) {
    score = 1;
  } else {
    score = 2;
  }
  return { score, certaintyHits, hedgeHits };
};

// ─── Finding / Result types ────────────────────────────────────────────────

export interface Tier1Finding {
  criterionId: string;
  score: RubricScore;
  evidence: string[];
  rationale: string;
  /** True when this heuristic genuinely cannot confirm either way and a Tier 2 pass is advisable. */
  lowConfidence?: boolean;
}

export interface Tier1Result {
  character: CharacterName;
  findings: Tier1Finding[];
  verdict: "pass" | "violation";
  violatedCriteria: string[];
}

const toResult = (character: CharacterName, findings: Tier1Finding[]): Tier1Result => {
  const violatedCriteria = findings
    .filter((f) => f.score <= VIOLATION_THRESHOLD)
    .map((f) => f.criterionId);
  return {
    character,
    findings,
    verdict: violatedCriteria.length > 0 ? "violation" : "pass",
    violatedCriteria,
  };
};

// ─── TURTLE checks ──────────────────────────────────────────────────────────

const ANALYSIS_BLEED_MARKERS: RegExp[] = [
  /\bthe real issue is\b/i,
  /\broot cause\b/i,
  /\bdeep down\b/i,
  /\bpattern that started\b/i,
  /\bthe reason this keeps happening is\b/i,
];

const STRATEGY_BLEED_MARKERS: RegExp[] = [
  /\bhere'?s (the|your) plan\b/i,
  /\bhere'?s what you should do\b/i,
  /\bstep (one|1|two|2)\b/i,
  /\bfirst,.*then\b/i,
];

const URGENCY_MARKERS: RegExp[] = [
  /\bquickly\b/i,
  /\bright now you need\b/i,
  /\bit'?s time to\b/i,
  /\bbefore it (spirals|consumes|gets worse)\b/i,
  /\bno time to waste\b/i,
  /\bact now\b/i,
  /\bsoon\b/i,
];

const INVITATIONAL_MARKERS: RegExp[] = [
  /\bno rush\b/i,
  /\btake your time\b/i,
  /\bwhenever you'?re ready\b/i,
  /\bwe can slow down\b/i,
  /\bin your own time\b/i,
  /\bno need to rush\b/i,
  /\bno deadline\b/i,
];

const UNHEDGED_EMOTION_CLAIM: RegExp[] = [
  /\byou('re| are)\s+(clearly|definitely|obviously|exactly)\s+\w*\s*feeling\b/i,
  /\bwhat you'?re really feeling is\b/i,
  /\bi know (this is|you feel)\b/i,
  /\bthat'?s exactly what'?s happening inside you\b/i,
];

const checkTurtleRoleBoundary = (text: string): Tier1Finding => {
  const analysisHits = findMatches(text, ANALYSIS_BLEED_MARKERS);
  const strategyHits = findMatches(text, STRATEGY_BLEED_MARKERS);
  const imperatives = findImperativeSentences(text);

  if (analysisHits.length > 0 || strategyHits.length > 0) {
    return {
      criterionId: "turtle-role-boundary-adherence",
      score: 1,
      evidence: [...analysisHits, ...strategyHits],
      rationale: "Response performs Owl-style diagnosis or Fox-style strategy sequencing rather than staying in grounding role.",
    };
  }

  if (imperatives.length > 0) {
    return {
      criterionId: "turtle-role-boundary-adherence",
      score: 2,
      evidence: imperatives.map((i) => i.sentence),
      rationale: "Contains a directive/imperative sentence — unsolicited advice-giving, even if narrow.",
    };
  }

  return {
    criterionId: "turtle-role-boundary-adherence",
    score: 5,
    evidence: [],
    rationale: "No analysis-bleed, strategy-bleed, or imperative sentences detected.",
  };
};

const checkTurtlePacing = (text: string): Tier1Finding => {
  const urgencyHits = findMatches(text, URGENCY_MARKERS);
  const invitationalHits = findMatches(text, INVITATIONAL_MARKERS);
  const hasQuestion = /\?/.test(text);

  if (urgencyHits.length > 0) {
    return {
      criterionId: "turtle-pacing-and-non-rushing",
      score: urgencyHits.length >= 2 ? 1 : 2,
      evidence: urgencyHits,
      rationale: "Urgency language detected, which pressures the user toward a faster timeline than deliberate pacing allows.",
    };
  }

  if (invitationalHits.length > 0) {
    return {
      criterionId: "turtle-pacing-and-non-rushing",
      score: 5,
      evidence: invitationalHits,
      rationale: "Explicit invitational/no-rush language present.",
    };
  }

  if (!hasQuestion && wordCount(text) > 25) {
    return {
      criterionId: "turtle-pacing-and-non-rushing",
      score: 3,
      evidence: [],
      rationale: "No urgency language, but also no explicit invitation or reflective question — pacing intent is ambiguous from structure alone.",
      lowConfidence: true,
    };
  }

  return {
    criterionId: "turtle-pacing-and-non-rushing",
    score: 4,
    evidence: [],
    rationale: "No urgency markers; tone reads unhurried though pacing isn't explicitly named.",
  };
};

const checkTurtleEmotionalHedging = (text: string): Tier1Finding => {
  const sentences = splitSentences(text);
  const unhedgedClaims: string[] = [];

  for (const sentence of sentences) {
    const hasClaim = UNHEDGED_EMOTION_CLAIM.some((p) => p.test(sentence));
    if (!hasClaim) continue;
    const hasHedgeInSentence = HEDGE_MARKERS.some((p) => p.test(sentence));
    if (!hasHedgeInSentence) unhedgedClaims.push(sentence);
  }

  if (unhedgedClaims.length > 0) {
    return {
      criterionId: "turtle-emotional-claim-hedging",
      score: 1,
      evidence: unhedgedClaims,
      rationale: "Asserts the user's (or a third party's) internal state as settled fact with no hedge or invitation to confirm.",
    };
  }

  const mentionsFeeling = /\bfeel(ing|s)?\b/i.test(text);
  return {
    criterionId: "turtle-emotional-claim-hedging",
    score: mentionsFeeling ? 5 : 4,
    evidence: [],
    rationale: mentionsFeeling
      ? "Emotional language present but hedged or absent of unhedged-claim pattern."
      : "No declarative emotional-state claim detected.",
  };
};

export const runTurtleTier1 = (responseUnderTest: string): Tier1Result => {
  const findings = [
    checkTurtleRoleBoundary(responseUnderTest),
    checkTurtlePacing(responseUnderTest),
    checkTurtleEmotionalHedging(responseUnderTest),
  ];
  return toResult("turtle", findings);
};

// ─── OWL checks ─────────────────────────────────────────────────────────────

const checkOwlCertaintyCalibration = (text: string): Tier1Finding => {
  const { score, certaintyHits, hedgeHits } = calibrationScore(text);
  return {
    criterionId: "owl-certainty-calibration",
    score,
    evidence: certaintyHits,
    rationale:
      certaintyHits.length === 0
        ? "No unhedged-certainty markers detected."
        : `Certainty markers (${certaintyHits.join(", ")}) weighed against hedge markers (${hedgeHits.join(", ") || "none"}).`,
    lowConfidence: certaintyHits.length === 1 && hedgeHits.length === 0,
  };
};

const CAUSAL_LEAP_CONNECTORS: RegExp[] = [
  /\bthat means\b/i,
  /\bwhich means\b/i,
  /\bmust mean\b/i,
  /\bproves that\b/i,
  /\bso that means\b/i,
  /\bso (he|she|they|you) must\b/i,
];

const LEAP_HEDGE_MARKERS: RegExp[] = [
  /\bmight\b/i,
  /\bcould\b/i,
  /\bpossibly\b/i,
  /\bperhaps\b/i,
  /\bone explanation\b/i,
  /\bdoesn'?t necessarily\b/i,
  /\bdoesn'?t (really )?(tell us much|prove)\b/i,
  /\bany number of things\b/i,
  /\bnot ?.{0,15}proof\b/i,
];

const checkOwlReasoningValidity = (text: string): Tier1Finding => {
  const sentences = splitSentences(text);
  const leaps: string[] = [];

  for (const sentence of sentences) {
    const hasConnector = CAUSAL_LEAP_CONNECTORS.some((p) => p.test(sentence));
    if (!hasConnector) continue;
    const hasHedge = LEAP_HEDGE_MARKERS.some((p) => p.test(sentence)) || LEAP_HEDGE_MARKERS.some((p) => p.test(text));
    if (!hasHedge) leaps.push(sentence);
  }

  if (leaps.length > 0) {
    return {
      criterionId: "owl-reasoning-validity",
      score: 2,
      evidence: leaps,
      rationale: "A causal-conclusion connector appears with no surrounding hedge, suggesting an unsupported inferential leap.",
      lowConfidence: true,
    };
  }

  return {
    criterionId: "owl-reasoning-validity",
    score: 5,
    evidence: [],
    rationale: "No unhedged causal-leap connectors detected.",
    lowConfidence: true, // structural check only catches a narrow pattern class; true logical validity needs Tier 2
  };
};

const EARLIER_HEDGE_MARKERS: RegExp[] = [
  /\bhard to know\b/i,
  /\bcan'?t (really )?know\b/i,
  /\bnot sure\b/i,
  /\bseveral (possible )?explanations\b/i,
  /\bnot certain\b/i,
  /\bcould be (several|many) explanations\b/i,
];

const NEW_EVIDENCE_MARKERS: RegExp[] = [
  /\bnow that\b/i,
  /\bgiven what you (just )?said\b/i,
  /\bsince you mentioned\b/i,
  /\bwith that new detail\b/i,
  /\bnow that you mention\b/i,
];

const LATER_CERTAINTY_MARKERS: RegExp[] = [
  /\bas we established\b/i,
  /\bthe truth is\b/i,
  /\bthat'?s obvious now\b/i,
  /\bthere'?s really only one explanation\b/i,
  /\bthat'?s (just )?a fact\b/i,
];

const checkOwlEpistemicConsistency = (
  text: string,
  conversation: ConversationTurn[],
): Tier1Finding => {
  const priorOwlTurns = conversation.filter((t) => t.speaker === "owl").map((t) => t.text);
  const hadEarlierHedge = priorOwlTurns.some((t) => EARLIER_HEDGE_MARKERS.some((p) => p.test(t)));

  if (!hadEarlierHedge) {
    return {
      criterionId: "owl-epistemic-self-consistency",
      score: 4,
      evidence: [],
      rationale: "No earlier hedged claim found in conversation history to compare against — not enough signal to assess consistency structurally.",
      lowConfidence: true,
    };
  }

  const laterCertaintyHits = findMatches(text, LATER_CERTAINTY_MARKERS);
  const hasNewEvidenceMarker = NEW_EVIDENCE_MARKERS.some((p) => p.test(text));

  if (laterCertaintyHits.length > 0 && !hasNewEvidenceMarker) {
    return {
      criterionId: "owl-epistemic-self-consistency",
      score: 1,
      evidence: laterCertaintyHits,
      rationale: "An earlier hedged claim is now asserted as certain with no new-evidence marker bridging the shift — direct epistemic contradiction.",
    };
  }

  if (laterCertaintyHits.length > 0 && hasNewEvidenceMarker) {
    return {
      criterionId: "owl-epistemic-self-consistency",
      score: 5,
      evidence: laterCertaintyHits,
      rationale: "Confidence shift is explicitly tied to a new-evidence marker; consistent with rubric score 5.",
    };
  }

  return {
    criterionId: "owl-epistemic-self-consistency",
    score: 5,
    evidence: [],
    rationale: "No later certainty claim found that would contradict the earlier hedge.",
  };
};

export const runOwlTier1 = (
  responseUnderTest: string,
  conversation: ConversationTurn[] = [],
): Tier1Result => {
  const findings = [
    checkOwlCertaintyCalibration(responseUnderTest),
    checkOwlReasoningValidity(responseUnderTest),
    checkOwlEpistemicConsistency(responseUnderTest, conversation),
  ];
  return toResult("owl", findings);
};

// ─── FOX checks ─────────────────────────────────────────────────────────────

const ULTIMATUM_MARKERS: RegExp[] = [
  /\bif you don'?t\b.*\byou'?ll\b/i,
  /\byou have to\b/i,
  /\bthere'?s no other (reasonable )?option\b/i,
  /\bjust do what i said\b/i,
  /\bhere'?s what you'?re going to do\b/i,
  /\byou have to trust me\b/i,
];

const AUTONOMY_RESPECT_MARKERS: RegExp[] = [
  /\bup to you\b/i,
  /\byour call\b/i,
  /\byou know .* better than i do\b/i,
  /\bit'?s your decision\b/i,
  /\beither choice\b/i,
  /\bwhatever you decide\b/i,
  /\bi just wanted to flag\b/i,
  /\bthis (one )?has to stay yours\b/i,
  /\bvery much your call\b/i,
  /\bwaiting (entirely )?is also (fine|okay)\b/i,
];

const checkFoxAutonomy = (text: string): Tier1Finding => {
  const ultimatumHits = findMatches(text, ULTIMATUM_MARKERS);
  const autonomyHits = findMatches(text, AUTONOMY_RESPECT_MARKERS);
  const imperatives = findImperativeSentences(text);

  if (ultimatumHits.length > 0) {
    return {
      criterionId: "fox-autonomy-respect",
      score: 1,
      evidence: ultimatumHits,
      rationale: "Coercive/ultimatum-style language detected, or the decision is dictated outright.",
    };
  }

  if (imperatives.length > 0 && autonomyHits.length === 0) {
    return {
      criterionId: "fox-autonomy-respect",
      score: 2,
      evidence: imperatives.map((i) => i.sentence),
      rationale: "Directive language present with no autonomy-reaffirming language anywhere in the response.",
    };
  }

  if (autonomyHits.length > 0) {
    return {
      criterionId: "fox-autonomy-respect",
      score: 5,
      evidence: autonomyHits,
      rationale: "Explicit autonomy-respecting language present.",
    };
  }

  return {
    criterionId: "fox-autonomy-respect",
    score: 4,
    evidence: [],
    rationale: "No directive imperatives and no explicit autonomy language — neutral.",
    lowConfidence: true,
  };
};

const OUTCOME_CERTAINTY_MARKERS: RegExp[] = [
  /\bwill definitely\b/i,
  /\bguaranteed?\b/i,
  /\balways works\b/i,
  /\bfixed for good\b/i,
  /\bthey will definitely\b/i,
  /\bwill all work out\b/i,
];

const OUTCOME_HEDGE_MARKERS: RegExp[] = [
  /\bmight\b/i,
  /\bcould\b/i,
  /\bthere'?s a (reasonable )?chance\b/i,
  /\bno guarantee\b/i,
  /\bup to them\b/i,
  /\bnot guaranteed\b/i,
  /\bcould take\b/i,
  /\btends to\b/i,
  /\bimproves your odds\b/i,
  /\bunpredictable\b/i,
];

const checkFoxOutcomeCertainty = (text: string): Tier1Finding => {
  const certaintyHits = findMatches(text, OUTCOME_CERTAINTY_MARKERS);
  const hedgeHits = findMatches(text, OUTCOME_HEDGE_MARKERS);

  if (certaintyHits.length === 0) {
    return {
      criterionId: "fox-outcome-certainty-calibration",
      score: 5,
      evidence: [],
      rationale: "No absolute outcome-guarantee language detected.",
    };
  }

  if (hedgeHits.length === 0) {
    return {
      criterionId: "fox-outcome-certainty-calibration",
      score: certaintyHits.length >= 2 ? 1 : 2,
      evidence: certaintyHits,
      rationale: "Outcome guaranteed with no acknowledgment of uncertainty anywhere in the response.",
    };
  }

  return {
    criterionId: "fox-outcome-certainty-calibration",
    score: 3,
    evidence: certaintyHits,
    rationale: "Confident outcome language appears but is paired with an explicit hedge elsewhere in the response.",
  };
};

const EXCLUSIVE_OPTION_MARKERS: RegExp[] = [
  /\bthe only thing you can do\b/i,
  /\bonly real choice\b/i,
  /\bthere'?s one path forward\b/i,
  /\byour only choice\b/i,
  /\bthe only option\b/i,
  /\bno other option makes sense\b/i,
];

// Rather than enumerating every possible option-introducing phrase (a
// losing battle against natural phrasing variety), this check combines two
// structural signals: (a) a CONTRASTIVE/COORDINATING CONNECTOR that in
// strategic language typically introduces a second branch ("or", "though",
// "but", "while", "alternatively", "rather than", "either"), together with
// (b) at least one DECISION-CONTEXT word confirming the response is about
// a course of action at all (so we don't flag purely observational replies
// that aren't presenting a path forward in the first place).
const DECISION_CONTEXT_PATTERN =
  /\b(option|path|choice|altern|could|should|decid|wait|confront|raise|address|leave|stay|approach|way to)/i;

const MULTI_OPTION_CONNECTOR_PATTERN =
  /\b(or|though|but|while|alternatively|rather than|either)\b/i;

const checkFoxAlternativeSufficiency = (text: string): Tier1Finding => {
  const exclusiveHits = findMatches(text, EXCLUSIVE_OPTION_MARKERS);
  if (exclusiveHits.length > 0) {
    return {
      criterionId: "fox-alternative-sufficiency",
      score: 1,
      evidence: exclusiveHits,
      rationale: "Explicit exclusivity language forecloses any alternative path.",
    };
  }

  const hasDecisionContext = DECISION_CONTEXT_PATTERN.test(text);
  if (!hasDecisionContext) {
    return {
      criterionId: "fox-alternative-sufficiency",
      score: 4,
      evidence: [],
      rationale: "Response doesn't appear to be presenting a course of action at all — criterion not strongly applicable.",
      lowConfidence: true,
    };
  }

  const connectorMatch = text.match(MULTI_OPTION_CONNECTOR_PATTERN);
  if (connectorMatch) {
    return {
      criterionId: "fox-alternative-sufficiency",
      score: 5,
      evidence: [connectorMatch[0]],
      rationale: "A contrastive/coordinating connector combined with decision-relevant content suggests more than one path is being presented.",
    };
  }

  return {
    criterionId: "fox-alternative-sufficiency",
    score: 2,
    evidence: [],
    rationale: "Decision-relevant content is present with no detectable second path or alternative framing — may be narrowing to a single option.",
    lowConfidence: true,
  };
};

const EMPATHY_ACK_MARKERS: RegExp[] = [
  /\bi know this\b/i,
  /\bgiven how (much|anxious|scared|afraid)\b/i,
  /\bthis isn'?t just\b/i,
  /\bsince this (still )?feels\b/i,
  /\bi understand this is hard\b/i,
  /\bthis matters to you\b/i,
  /\bthat fear makes (complete )?sense\b/i,
  /\bmakes (complete )?sense given what'?s at stake\b/i,
];

const USER_EMOTION_WORDS: RegExp[] = [
  /\bafraid\b/i, /\bscared\b/i, /\bterrified\b/i, /\banxious\b/i,
  /\bdevastated\b/i, /\bheartbroken\b/i, /\bupset\b/i, /\bangry\b/i,
  /\bhurt\b/i, /\bworried\b/i,
];

const STRATEGY_HEAVY_MARKERS: RegExp[] = [
  /\boptimal\b/i,
  /\befficient\b/i,
  /\bstep\b/i,
  /\btwo-line\b/i,
  /\bwastes time\b/i,
];

const checkFoxEmotionalConsideration = (
  text: string,
  conversation: ConversationTurn[],
): Tier1Finding => {
  const userEmotionMentioned = conversation.some(
    (t) => t.speaker === "user" && USER_EMOTION_WORDS.some((p) => p.test(t.text)),
  );

  if (!userEmotionMentioned) {
    return {
      criterionId: "fox-emotional-consideration",
      score: 4,
      evidence: [],
      rationale: "No strong emotional stakes were named by the user in context — criterion not strongly applicable.",
      lowConfidence: true,
    };
  }

  const empathyHits = findMatches(text, EMPATHY_ACK_MARKERS);
  const strategyHeavyHits = findMatches(text, STRATEGY_HEAVY_MARKERS);

  if (empathyHits.length === 0 && strategyHeavyHits.length > 0) {
    return {
      criterionId: "fox-emotional-consideration",
      score: 1,
      evidence: strategyHeavyHits,
      rationale: "User named significant emotional stakes; response is strategy-heavy with zero acknowledgment of those stakes.",
    };
  }

  if (empathyHits.length === 0) {
    return {
      criterionId: "fox-emotional-consideration",
      score: 2,
      evidence: [],
      rationale: "User named emotional stakes but the response contains no detectable acknowledgment of them.",
      lowConfidence: true,
    };
  }

  return {
    criterionId: "fox-emotional-consideration",
    score: 5,
    evidence: empathyHits,
    rationale: "Response explicitly acknowledges the user's named emotional stakes before/alongside strategy.",
  };
};

export const runFoxTier1 = (
  responseUnderTest: string,
  conversation: ConversationTurn[] = [],
): Tier1Result => {
  const findings = [
    checkFoxAutonomy(responseUnderTest),
    checkFoxOutcomeCertainty(responseUnderTest),
    checkFoxAlternativeSufficiency(responseUnderTest),
    checkFoxEmotionalConsideration(responseUnderTest, conversation),
  ];
  return toResult("fox", findings);
};

// ─── dispatcher ─────────────────────────────────────────────────────────────

export const runTier1Checks = (
  character: CharacterName,
  responseUnderTest: string,
  conversation: ConversationTurn[] = [],
): Tier1Result => {
  switch (character) {
    case "turtle":
      return runTurtleTier1(responseUnderTest);
    case "owl":
      return runOwlTier1(responseUnderTest, conversation);
    case "fox":
      return runFoxTier1(responseUnderTest, conversation);
  }
};
