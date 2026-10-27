/**
 * runTests.ts
 *
 * Executes Tier 1 checks against every fixture in fixtures/ and reports
 * REAL pass/fail counts, broken down by character and by rubric
 * criterion, comparing Tier 1's computed verdict against each fixture's
 * human-authored expected verdict.
 *
 * Run with:
 *   node --experimental-strip-types src/lib/integritySupervisor/runTests.ts
 * (Node 22+. No build step, no test framework dependency — this is a
 * standalone script by design so it can run in CI or locally with zero
 * extra installs.)
 *
 * IMPORTANT HONESTY NOTE: Tier 1 is intentionally a heuristic layer. Some
 * fixtures are specifically included (and flagged
 * `requiresTier2ForConfidence`) because they exercise judgment calls Tier
 * 1's structural checks cannot fully resolve. This script reports BOTH an
 * overall accuracy figure AND a Tier-1-only-applicable accuracy figure
 * that excludes those flagged fixtures, so the two-tier design's rationale
 * is visible in the numbers rather than papered over.
 */

import { ALL_FIXTURES } from "./fixtures/index";
import type { Fixture } from "./fixtures/types";
import { runTier1Checks, type Tier1Result } from "./tier1Checks";
import type { CharacterName } from "./rubric";

interface CaseResult {
  fixture: Fixture;
  tier1: Tier1Result;
  matchedVerdict: boolean;
  matchedCriterion: boolean | null; // null when expected is "pass" (no criterion to match)
}

const evaluateFixture = (fixture: Fixture): CaseResult => {
  const tier1 = runTier1Checks(fixture.character, fixture.responseUnderTest, fixture.conversation);
  const matchedVerdict = tier1.verdict === fixture.expected.verdict;

  let matchedCriterion: boolean | null = null;
  if (fixture.expected.verdict === "violation") {
    matchedCriterion = fixture.expected.criterionId
      ? tier1.violatedCriteria.includes(fixture.expected.criterionId)
      : tier1.verdict === "violation";
  }

  return { fixture, tier1, matchedVerdict, matchedCriterion };
};

const results: CaseResult[] = ALL_FIXTURES.map(evaluateFixture);

// ─── reporting ──────────────────────────────────────────────────────────────

const line = (ch = "─", n = 78) => ch.repeat(n);

console.log(line("="));
console.log("INTEGRITY SUPERVISOR — TIER 1 TEST RUN");
console.log(`Fixtures loaded: ${ALL_FIXTURES.length}`);
console.log(line("="));

const characters: CharacterName[] = ["turtle", "owl", "fox"];

let grandTotal = 0;
let grandVerdictMatches = 0;
let grandCriterionApplicable = 0;
let grandCriterionMatches = 0;
let grandExcludingTier2Total = 0;
let grandExcludingTier2Matches = 0;

for (const character of characters) {
  const charResults = results.filter((r) => r.fixture.character === character);
  const total = charResults.length;
  const verdictMatches = charResults.filter((r) => r.matchedVerdict).length;

  const nonTier2 = charResults.filter((r) => !r.fixture.expected.requiresTier2ForConfidence);
  const nonTier2Matches = nonTier2.filter((r) => r.matchedVerdict).length;

  console.log(`\n${character.toUpperCase()}  (${total} fixtures)`);
  console.log(line("-", 60));
  console.log(
    `  Verdict match (Tier1 vs expected):      ${verdictMatches}/${total}  (${((verdictMatches / total) * 100).toFixed(0)}%)`,
  );
  console.log(
    `  Verdict match, excl. Tier2-flagged:      ${nonTier2Matches}/${nonTier2.length}  (${((nonTier2Matches / nonTier2.length) * 100).toFixed(0)}%)`,
  );

  // per-category breakdown
  const categories = Array.from(new Set(charResults.map((r) => r.fixture.category)));
  for (const category of categories) {
    const inCat = charResults.filter((r) => r.fixture.category === category);
    const catMatches = inCat.filter((r) => r.matchedVerdict).length;
    console.log(`    - ${category.padEnd(20)} ${catMatches}/${inCat.length}`);
  }

  // per-fixture detail
  console.log(`  Per-fixture detail:`);
  for (const r of charResults) {
    const status = r.matchedVerdict ? "PASS-MATCH" : "MISMATCH  ";
    const tier2Flag = r.fixture.expected.requiresTier2ForConfidence ? " [flagged: Tier2 recommended]" : "";
    console.log(
      `    [${status}] ${r.fixture.id.padEnd(28)} expected=${r.fixture.expected.verdict.padEnd(9)} tier1=${r.tier1.verdict.padEnd(9)} criteriaFlagged=${r.tier1.violatedCriteria.join(",") || "-"}${tier2Flag}`,
    );
  }

  grandTotal += total;
  grandVerdictMatches += verdictMatches;
  grandExcludingTier2Total += nonTier2.length;
  grandExcludingTier2Matches += nonTier2Matches;
}

console.log(`\n${line("=")}`);
console.log("PER-RUBRIC-CRITERION BREAKDOWN (violation fixtures only)");
console.log(line("=", 78));

const violationResults = results.filter((r) => r.fixture.expected.verdict === "violation" && r.fixture.expected.criterionId);
const criterionIds = Array.from(new Set(violationResults.map((r) => r.fixture.expected.criterionId!)));

for (const criterionId of criterionIds) {
  const inCriterion = violationResults.filter((r) => r.fixture.expected.criterionId === criterionId);
  const matches = inCriterion.filter((r) => r.matchedCriterion).length;
  grandCriterionApplicable += inCriterion.length;
  grandCriterionMatches += matches;
  console.log(`  ${criterionId.padEnd(38)} ${matches}/${inCriterion.length} caught by Tier 1`);
}

console.log(`\n${line("=")}`);
console.log("SUMMARY");
console.log(line("=", 78));
console.log(`  Total fixtures:                           ${grandTotal}`);
console.log(
  `  Overall verdict accuracy (vs expected):   ${grandVerdictMatches}/${grandTotal} (${((grandVerdictMatches / grandTotal) * 100).toFixed(1)}%)`,
);
console.log(
  `  Verdict accuracy excl. Tier2-flagged:     ${grandExcludingTier2Matches}/${grandExcludingTier2Total} (${((grandExcludingTier2Matches / grandExcludingTier2Total) * 100).toFixed(1)}%)`,
);
console.log(
  `  Violation fixtures where Tier1 flagged    ${grandCriterionMatches}/${grandCriterionApplicable} (${((grandCriterionMatches / grandCriterionApplicable) * 100).toFixed(1)}%)`,
);
console.log(`  the EXACT expected criterion:`);

const mismatches = results.filter((r) => !r.matchedVerdict);
if (mismatches.length > 0) {
  console.log(`\n  Mismatches (${mismatches.length}) — candidates for Tier 2 review or heuristic refinement:`);
  for (const m of mismatches) {
    console.log(`    - ${m.fixture.id}: expected ${m.fixture.expected.verdict}, Tier1 said ${m.tier1.verdict}`);
  }
}

console.log(`\n${line("=")}\n`);
