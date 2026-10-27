/**
 * fixtures/types.ts
 *
 * Shared shape for every test-conversation fixture used by runTests.ts.
 * Fixtures are ground truth: a human-reviewed verdict for a given
 * character response, independent of whatever Tier 1 or Tier 2 later
 * compute. The test suite's job is to check Tier 1's output AGAINST this
 * ground truth, not to define the ground truth from Tier 1 itself.
 */

import type { CharacterName } from "../rubric";

export type FixtureCategory =
  | "normal"
  | "ambiguous"
  | "emotionally-intense"
  | "adversarial";

export interface ConversationTurn {
  speaker: "user" | CharacterName;
  text: string;
}

export interface ExpectedVerdict {
  verdict: "pass" | "violation";
  /**
   * Required when verdict is "violation". References a RubricCriterion id
   * from rubric.ts. Optional secondary criteria may also be implicated,
   * but the primary one is what the test suite scores against.
   */
  criterionId?: string;
  /** Human-readable justification for the verdict, for reviewers. */
  rationale: string;
  /**
   * If true, this fixture is included to demonstrate a case that Tier 1
   * heuristics are NOT expected to reliably resolve (subtle semantic
   * judgment, cross-turn nuance, tone). runTests.ts reports these
   * separately so Tier 1's honest accuracy isn't conflated with cases
   * that are explicitly Tier 2's job.
   */
  requiresTier2ForConfidence?: boolean;
}

export interface Fixture {
  id: string;
  character: CharacterName;
  category: FixtureCategory;
  description: string;
  /** Prior conversation context leading up to the response under test. */
  conversation: ConversationTurn[];
  /** The exact character response being evaluated. */
  responseUnderTest: string;
  expected: ExpectedVerdict;
}
