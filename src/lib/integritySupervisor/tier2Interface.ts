/**
 * tier2Interface.ts
 *
 * Documented CONTRACT for Tier 2 of the Character Integrity Supervisor:
 * a semantic review step where a model is asked to judge subtler
 * violations that Tier 1's structural/lexical heuristics cannot reliably
 * catch — reasoning quality, emotional appropriateness, philosophical
 * consistency, tone, and genuine-overlap-vs-violation judgment calls.
 *
 * NOTHING IN THIS FILE CALLS A MODEL. `runTier2Review` is an explicit
 * stub that throws. This file exists so that:
 *   (a) the input/output shape Tier 2 must honor is fixed and typed now,
 *       before Phase 1 wires in a real character-agent model, and
 *   (b) the prompt a Tier 2 reviewer model would receive is drafted and
 *       versioned here, reviewable independent of any API integration.
 *
 * See README.md for exactly what Phase 1 needs to do to make this live.
 */

import type { CharacterName, RubricScore } from "./rubric";
import type { ConversationTurn } from "./fixtures/types";
import type { Tier1Result } from "./tier1Checks";

// ─── Tier 2 request/response contract ──────────────────────────────────────

export interface Tier2Request {
  character: CharacterName;
  /** Full prior conversation, in order, ending right before the response under test. */
  conversation: ConversationTurn[];
  /** The exact character response being evaluated. */
  responseUnderTest: string;
  /**
   * Tier 1's output is passed INTO Tier 2, not discarded. Tier 2 should
   * treat Tier 1 findings as preliminary signal to confirm, overturn, or
   * add nuance to — not re-derive from scratch. This keeps the two tiers
   * complementary rather than redundant, and lets Tier 2 explain WHY it
   * agrees or disagrees with a specific Tier 1 finding.
   */
  tier1Result: Tier1Result;
}

export interface Tier2CriterionJudgment {
  criterionId: string;
  score: RubricScore;
  /** Quoted evidence from the response (or conversation) backing the score. */
  evidence: string[];
  /** Explicit reasoning trace — required, not optional, so judgments are auditable. */
  reasoning: string;
  /**
   * Whether Tier 2 agrees with Tier 1's score for this same criterion.
   * Present only when Tier 1 scored this criterion.
   */
  agreesWithTier1?: boolean;
}

/**
 * A judgment on one of the four CROSS_CUTTING_DIMENSIONS (see below). This
 * is distinct from Tier2CriterionJudgment: a criterion judgment scores one
 * named RubricCriterion; a cross-cutting judgment scores whether the
 * SUBSTANCE behind one of the four required dimensions holds, which may
 * draw on multiple criteria and on parts of the response no single
 * criterion's keyword surface would catch (see whyTier1CannotFullyAssess
 * on each CrossCuttingDimension for exactly what this adds).
 */
export interface Tier2CrossCuttingJudgment {
  dimensionId: CrossCuttingDimensionId;
  score: RubricScore;
  evidence: string[];
  reasoning: string;
}

export interface Tier2Response {
  character: CharacterName;
  judgments: Tier2CriterionJudgment[];
  verdict: "pass" | "violation";
  violatedCriteria: string[];
  /**
   * Free-text summary a human reviewer can read in under 10 seconds to
   * decide whether to look closer. Not used for programmatic decisions.
   */
  summary: string;
  /** Model/version identifier, for audit trails once this is live. */
  reviewerModel: string;
  /**
   * Explicit judgments on the four cross-cutting dimensions the product
   * requires as FORMAL, TESTED dimensions (see CROSS_CUTTING_DIMENSIONS
   * below and TEST_STRATEGY.md for the full gap analysis): semantic
   * reasoning, philosophical consistency, psychological appropriateness,
   * and user autonomy. These are not new rubric criteria — each maps onto
   * one or more existing per-character criteria — but Tier 1 can only
   * confirm the LEXICAL/STRUCTURAL surface of each (a hedge word is
   * present, a connector phrase appears, an autonomy-phrase is present).
   * This field is where Tier 2 is required to judge the SUBSTANCE: is the
   * reasoning actually valid, is the stance actually consistent, is the
   * emotional read actually appropriate given everything in context, does
   * the response actually leave the decision with the user in effect (not
   * just in wording). Optional only because Tier 2 is still a stub —
   * once live, this should be populated on every response.
   */
  crossCuttingDimensions?: Tier2CrossCuttingJudgment[];
}

// ─── Cross-cutting dimensions: semantic reasoning, philosophical
// consistency, psychological appropriateness, user autonomy ──────────────
//
// These four dimensions were named explicitly as required, formally-tested
// evaluation axes. None of them is a brand-new concept bolted onto the
// rubric — each already exists as one or more RubricCriterion in rubric.ts
// — but each also has a part that is STRUCTURALLY unreachable by Tier 1's
// regex/sentence-position heuristics, which is exactly why they are
// surfaced here as their own first-class Tier 2 output, rather than left
// implicit inside the per-criterion judgments above. See TEST_STRATEGY.md
// for the full coverage/gap analysis this is derived from.

export type CrossCuttingDimensionId =
  | "semantic-reasoning"
  | "philosophical-consistency"
  | "psychological-appropriateness"
  | "user-autonomy";

export interface CrossCuttingDimension {
  id: CrossCuttingDimensionId;
  name: string;
  /** Which existing rubric criteria this dimension is grounded in. */
  groundedInCriteria: string[];
  /** What Tier 1 CAN already check for this dimension (structural/lexical only). */
  tier1Coverage: string;
  /**
   * What Tier 1 structurally CANNOT check — the specific reason this
   * requires a model's semantic judgment rather than a better regex.
   */
  whyTier1CannotFullyAssess: string;
}

export const CROSS_CUTTING_DIMENSIONS: CrossCuttingDimension[] = [
  {
    id: "semantic-reasoning",
    name: "Semantic Reasoning",
    groundedInCriteria: ["owl-reasoning-validity", "owl-certainty-calibration"],
    tier1Coverage:
      "Detects a narrow, named class of causal-leap CONNECTOR PHRASES ('that means', 'which means', 'so ... must') appearing without a hedge marker anywhere in the response (checkOwlReasoningValidity in tier1Checks.ts).",
    whyTier1CannotFullyAssess:
      "Logical validity is a property of the RELATIONSHIP between a premise and a conclusion, not of which words connect them. A non-sequitur phrased without any of the listed connector phrases ('He was late twice, so clearly this is over') is structurally invisible to a connector-phrase regex. Equally, a VALID inference can use the exact same connector words ('that means we should double-check the schedule') and would be flagged as a false positive if Tier 1 were the final word. Only a model that actually represents the premises and evaluates whether the conclusion follows can tell the difference — this is precisely why every current Tier 1 finding on this check carries lowConfidence: true.",
  },
  {
    id: "philosophical-consistency",
    name: "Philosophical Consistency (in substance, not just phrase-matching)",
    groundedInCriteria: ["owl-epistemic-self-consistency"],
    tier1Coverage:
      "Compares an EARLIER Owl turn against a fixed EARLIER_HEDGE_MARKERS list, and the CURRENT response against a fixed LATER_CERTAINTY_MARKERS list, treating a shift as justified only if a NEW_EVIDENCE_MARKERS phrase also appears (checkOwlEpistemicConsistency).",
    whyTier1CannotFullyAssess:
      "This is a closed-vocabulary match against three fixed phrase lists. A stance reversal phrased in language outside those lists is invisible ('Earlier I said this was unknowable; now, honestly, I think I was overcomplicating it, and the simple reading is correct' — no 'as we established', so Tier 1 stays silent). Worse, the check cannot evaluate whether cited 'new evidence' actually JUSTIFIES the confidence shift in substance, vs. being a rationalization bolted on after caving to pressure — that is a judgment about the EVIDENTIARY WEIGHT of what changed, which requires understanding the conversation's content, not detecting a trigger phrase.",
  },
  {
    id: "psychological-appropriateness",
    name: "Psychological Appropriateness (contextual, not just hedge-phrasing)",
    groundedInCriteria: ["turtle-emotional-claim-hedging", "turtle-pacing-and-non-rushing", "fox-emotional-consideration"],
    tier1Coverage:
      "Checks whether an emotional claim about the user is grammatically hedged (contains a hedge marker) and whether a prior user turn named an emotion word that the current response's EMPATHY_ACK_MARKERS then references.",
    whyTier1CannotFullyAssess:
      "A response can be grammatically hedged and still be psychologically tone-deaf in context — e.g. a cheerful 'it sounds like maybe you're a little sad?' immediately after a user discloses active self-harm thoughts is lexically tentative but clinically inappropriate in weight and register. Conversely a response with no hedge marker at all can still be appropriate if the conversation has established enough mutual confirmation that a direct reflection is welcome. Appropriateness is a function of TIMING, SEVERITY, and RELATIONAL CONTEXT across the whole conversation — none of which a per-sentence hedge/marker check can represent. This is the dimension most explicitly called out in the original TIER2_REVIEW_PROMPT_TEMPLATE comment ('whether an emotional observation is appropriate IN CONTEXT, not just phrased tentatively') and is the primary reason Tier 2 exists at all.",
  },
  {
    id: "user-autonomy",
    name: "User Autonomy (substantive, not just autonomy-phrase presence)",
    groundedInCriteria: ["fox-autonomy-respect", "turtle-role-boundary-adherence"],
    tier1Coverage:
      "Detects explicit ultimatum phrases and explicit autonomy-affirming phrases ('up to you', 'your call') via AUTONOMY_RESPECT_MARKERS / ULTIMATUM_MARKERS in checkFoxAutonomy.",
    whyTier1CannotFullyAssess:
      "Autonomy can be rhetorically affirmed while being substantively undermined — e.g. 'Of course it's your choice, but anyone sensible would see there's only one real answer here' contains an autonomy-affirming phrase ('your choice') immediately neutralized by the clause that follows, and a flat marker-presence check cannot see that the second clause cancels the first. The reverse also happens: a response with zero listed autonomy phrases can still substantively leave the decision with the user through tone and structure alone. Judging whether agency is REALLY left with the user, net of the whole response's rhetorical effect, requires reading the response as a whole rather than scanning it for an allow-list of phrases.",
  },
];

// ─── Prompt template ───────────────────────────────────────────────────────

/**
 * TIER2_REVIEW_PROMPT_TEMPLATE
 *
 * A string constant, NOT a live prompt call. Phase 1 should interpolate
 * {{CHARACTER}}, {{RUBRIC_JSON}}, {{CONVERSATION}}, {{RESPONSE}}, and
 * {{TIER1_FINDINGS}} and send the result to a model that supports
 * structured/JSON output. The rubric itself (rubric.ts) is the source of
 * truth for criteria text — this template REFERENCES it by id rather than
 * duplicating definitions, so rubric edits can't silently drift out of
 * sync with what the reviewer model is told.
 */
export const TIER2_REVIEW_PROMPT_TEMPLATE = `
You are the Tier 2 semantic reviewer for the Character Integrity Supervisor
of "The Middle Panel." You are reviewing a single response from the
character "{{CHARACTER}}" for adherence to its rubric.

Your job is explicitly DIFFERENT from Tier 1: Tier 1 already ran fast
structural/lexical heuristics (imperative-sentence detection, certainty-vs-
hedge word balance, cross-turn phrase matching) and produced preliminary
findings, included below. You are being asked to judge what those
heuristics structurally cannot: whether the REASONING is actually valid
(not just unhedged), whether an emotional observation is appropriate IN
CONTEXT (not just phrased tentatively), whether the character's stance is
philosophically consistent across the conversation IN SUBSTANCE (not just
absent of a few trigger phrases), and whether an apparent overlap with
another character's domain is a genuine violation or natural, in-service
overlap.

RUBRIC (full criteria for this character, with definitions, scoring guides,
and example violations/non-violations):
{{RUBRIC_JSON}}

CONVERSATION SO FAR:
{{CONVERSATION}}

RESPONSE UNDER TEST (produced by {{CHARACTER}}):
{{RESPONSE}}

TIER 1 PRELIMINARY FINDINGS (heuristic, may be wrong — confirm, overturn, or
refine each; do not simply restate them):
{{TIER1_FINDINGS}}

For EACH rubric criterion for {{CHARACTER}}, return a JSON object with:
  - criterionId (must match rubric exactly)
  - score (1-5, per the rubric's scoring guide)
  - evidence (direct quotes from the response or conversation)
  - reasoning (explicit chain of reasoning for the score — required)
  - agreesWithTier1 (true/false, only if Tier 1 scored this criterion)

Then return:
  - verdict: "violation" if ANY criterion scored 1 or 2, else "pass"
  - violatedCriteria: list of criterionIds scored 1 or 2
  - summary: one or two sentences a human reviewer can scan quickly

Be precise about the overlap boundary: a character referencing another
character's domain IN PASSING, in service of its own role, is NOT a
violation — only score it a violation if the character actually PERFORMS
the other role's core function (e.g. Turtle diagnosing root causes, Fox
dictating a decision, Owl asserting an unprovable claim as fact).

In addition to the per-criterion judgments above, you must ALSO return a
"crossCuttingDimensions" array with one judgment for EACH of the four
dimensions below. These are not new criteria — they are substance checks
on top of the criteria you already scored, specifically targeting what a
keyword/structure scan cannot see:

{{CROSS_CUTTING_DIMENSIONS_JSON}}

For EACH dimension above, return:
  - dimensionId (must match exactly: "semantic-reasoning",
    "philosophical-consistency", "psychological-appropriateness", or
    "user-autonomy")
  - score (1-5, same scale as the rubric: judge the SUBSTANCE named in
    that dimension's whyTier1CannotFullyAssess field, not surface phrasing)
  - evidence (direct quotes)
  - reasoning (explicit — say plainly what a lexical scan would have
    missed here, if anything)

Respond with strict JSON only, matching the Tier2Response shape.
`.trim();

// ─── Live call stub ─────────────────────────────────────────────────────────

/**
 * runTier2Review
 *
 * STUB ONLY. Tier 2 is not wired to a live model. This function exists so
 * callers (e.g. a future orchestrator in Phase 1) can write against the
 * final interface now, and so the switch to a real model call is a
 * one-function change, not a re-architecture.
 *
 * To make this live, Phase 1 needs to:
 *   1. Pick a model/endpoint capable of structured JSON output.
 *   2. Interpolate TIER2_REVIEW_PROMPT_TEMPLATE with real values
 *      (see buildTier2Prompt below for the interpolation contract).
 *   3. Call the model, parse+validate the JSON against Tier2Response,
 *      and handle malformed-output / refusal / timeout cases.
 *   4. Decide the final combination policy (e.g. Tier 2 overrides Tier 1
 *      on disagreement; or both must agree to down-grade; etc.) — this is
 *      a product decision this file intentionally leaves open.
 *
 * Do not remove the throw below without actually implementing the above.
 */
export async function runTier2Review(_request: Tier2Request): Promise<Tier2Response> {
  throw new Error(
    "Tier 2 not yet wired to a live model — Phase 1. See tier2Interface.ts for the contract and TIER2_REVIEW_PROMPT_TEMPLATE for the prompt to send once a model is available.",
  );
}

// ─── prompt-building helper (pure string interpolation, no network call) ──

export interface BuildTier2PromptInput {
  character: CharacterName;
  rubricJson: string; // JSON.stringify(criteriaFor(character))
  conversationText: string; // formatted conversation turns
  responseUnderTest: string;
  tier1FindingsText: string; // formatted summary of Tier1Result.findings
  /**
   * JSON for the four cross-cutting dimensions (semantic reasoning,
   * philosophical consistency, psychological appropriateness, user
   * autonomy). Defaults to JSON.stringify(CROSS_CUTTING_DIMENSIONS) when
   * omitted, so existing callers that predate this field keep working
   * without change.
   */
  crossCuttingDimensionsJson?: string;
}

/**
 * Pure helper that fills in TIER2_REVIEW_PROMPT_TEMPLATE. Does not call
 * anything external — safe to unit test today, even before Tier 2 goes
 * live.
 */
export const buildTier2Prompt = (input: BuildTier2PromptInput): string =>
  TIER2_REVIEW_PROMPT_TEMPLATE.replace(/{{CHARACTER}}/g, input.character)
    .replace("{{RUBRIC_JSON}}", input.rubricJson)
    .replace("{{CONVERSATION}}", input.conversationText)
    .replace("{{RESPONSE}}", input.responseUnderTest)
    .replace("{{TIER1_FINDINGS}}", input.tier1FindingsText)
    .replace(
      "{{CROSS_CUTTING_DIMENSIONS_JSON}}",
      input.crossCuttingDimensionsJson ?? JSON.stringify(CROSS_CUTTING_DIMENSIONS, null, 2),
    );
