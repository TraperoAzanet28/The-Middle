# Test Strategy — Character Integrity & Behavioral Evaluation Supervisor

This document applies standard test-pyramid / coverage-analysis methodology
to this directory: for each thing we need to verify, (1) classify it by
*what kind of check can actually verify it* (unit-testable heuristic vs.
requires-judgment semantic review vs. requires-human-sign-off), (2)
measure *actual* current coverage against the 36 (now 39) fixtures and the
Tier 1 implementation, not an estimate, and (3) name concrete gaps.

The four dimensions below were specified as required, formally-tested
evaluation axes: **semantic reasoning, philosophical consistency,
psychological appropriateness, user autonomy.** None of them is a new
concept — each already exists inside `rubric.ts` as one or more named
criteria — but the point of this document is to make explicit, per
dimension, where the existing two-tier design actually reaches and where
it structurally cannot.

## Test pyramid for this system

```
        ▲  Human / product sign-off
        │  (does a Tier 2 judgment on a genuinely ambiguous case
        │   match what a clinician/ethicist would actually want?)
        │
        │  Tier 2 — semantic/model review (tier2Interface.ts)
        │  (reasoning VALIDITY, consistency IN SUBSTANCE, appropriateness
        │   IN CONTEXT, autonomy NET OF RHETORICAL EFFECT — judgment calls
        │   that require representing meaning, not matching patterns)
        │
        │  Tier 1 — deterministic/heuristic unit checks (tier1Checks.ts)
        │  (sentence position, modal grammar, phrase-list presence,
        │   certainty/hedge word balance, cross-turn phrase comparison —
        │   anything regex/structure can decide with no ambiguity)
        ▼
```

Tier 1 is the base of the pyramid: cheap, deterministic, runs on every
response, and is itself unit-tested by `runTests.ts` against fixed-answer
fixtures (that's what the fixtures ARE — unit tests with human-authored
expected output). Tier 2 is the layer above it, reserved for exactly the
judgment calls Tier 1 cannot structurally resolve — it is a stub by design
(see `tier2Interface.ts`), not because it's lower priority, but because
wiring a live model is a Phase 1 decision outside this task's scope. Above
both sits human/product review for the genuinely contested cases — this
is why `requiresTier2ForConfidence` exists on fixtures: it is this
system's way of saying "Tier 1 got the right answer here, but don't trust
that to generalize — a human or Tier 2 should re-confirm," rather than
quietly inflating Tier 1's reported accuracy.

## Dimension-by-dimension mapping

### 1. Semantic reasoning

- **Grounded in:** `owl-reasoning-validity` (and secondarily
  `owl-certainty-calibration`, since miscalibrated confidence is often the
  symptom of invalid reasoning).
- **Tier 1 coverage today:** `checkOwlReasoningValidity` detects a fixed
  list of causal-leap CONNECTOR PHRASES (`that means`, `which means`, `so
  ... must`, `proves that`) appearing with no hedge marker anywhere in the
  response. This is a real, cheap, always-on check — but every finding it
  produces carries `lowConfidence: true` in the code itself, which is an
  honest admission that it only catches one narrow *phrasing* of
  non-sequitur, not non-sequitur in general.
- **Why Tier 1 structurally cannot catch the rest:** validity is a
  relationship between a premise and a conclusion, not a property of
  which connector word joins them. A non-sequitur with none of the listed
  connectors ("He was late twice — this relationship is clearly over") is
  invisible to the regex. A *valid* inference can use the exact same
  connector words ("that means we should double-check the schedule") and
  would be a false positive if Tier 1 were trusted as final. Only a model
  that represents what the premises actually claim and checks whether the
  conclusion follows can tell these apart — this is irreducibly a Tier 2
  job, now documented as the `semantic-reasoning` cross-cutting dimension
  in `tier2Interface.ts`.
- **Coverage before this pass:** **0 violation fixtures.** Both existing
  fixtures referencing this criterion (`owl-ambiguous-3`,
  `owl-adversarial-3`) were PASS cases — Tier 1 had never been tested
  against an actual non-sequitur it was supposed to catch, only against
  clean responses it was supposed to stay quiet on. This was a real,
  measurable gap, not a hypothetical one.
- **Gap fix applied:** added `owl-ambiguous-4` and `owl-adversarial-4` —
  two new violation fixtures built directly from the rubric's own
  violation examples, confirmed to trip `checkOwlReasoningValidity`'s
  connector+no-hedge logic. See "Gap fix" section below for the full
  before/after.

### 2. Philosophical consistency

- **Grounded in:** `owl-epistemic-self-consistency`.
- **Tier 1 coverage today:** `checkOwlEpistemicConsistency` compares an
  earlier Owl turn against a fixed `EARLIER_HEDGE_MARKERS` list and the
  current response against a fixed `LATER_CERTAINTY_MARKERS` list,
  treating a confidence shift as justified only if a
  `NEW_EVIDENCE_MARKERS` phrase also appears. This is a genuine cross-turn
  structural comparison (not a single-message check), which is more than
  most heuristic systems attempt.
- **Why Tier 1 structurally cannot catch the rest:** it's a closed-
  vocabulary match against three fixed phrase lists. A stance reversal
  phrased outside those lists is invisible. More importantly, even when
  a `NEW_EVIDENCE_MARKERS` phrase IS present, Tier 1 cannot judge whether
  the cited "new evidence" actually *justifies* the confidence shift in
  substance versus being a rationalization bolted on after caving to
  pressure — that's a judgment about evidentiary weight, which requires
  understanding what was actually said, not detecting a trigger phrase.
  Documented as the `philosophical-consistency` cross-cutting dimension.
- **Coverage before this pass:** **1 fixture total**, and it was the only
  one — `owl-emotionally-intense-3` — a violation case explicitly flagged
  `requiresTier2ForConfidence: true`. That means there was no fixture
  Tier 1 could be trusted on for this criterion *without* a Tier 2
  backstop, and no fixture at all exercising the "confidence shift
  justified by genuine new evidence" pass-side branch of the code.
- **Gap fix applied:** added `owl-normal-4`, a clean pass-side fixture
  exercising the new-evidence-justified branch, confirmed NOT to need
  `requiresTier2ForConfidence` because the structural signal is
  unambiguous. This doesn't eliminate the deeper problem (evidentiary
  weight still needs Tier 2), but it closes the "zero fixtures Tier 1 can
  be trusted on" gap and gives the new-evidence branch its first test.

### 3. Psychological appropriateness

- **Grounded in:** `turtle-emotional-claim-hedging`,
  `turtle-pacing-and-non-rushing`, `fox-emotional-consideration`.
- **Tier 1 coverage today:** checks whether an emotional claim about the
  user is grammatically hedged, whether urgency/invitational phrase lists
  appear, and whether a prior user turn named an emotion word that the
  response's `EMPATHY_ACK_MARKERS` then references. Fixture coverage by
  count is actually reasonable: 2 fixtures for
  `turtle-emotional-claim-hedging` (1 violation, 1 pass), 2+ touching
  `fox-emotional-consideration`, plus `turtle-pacing-and-non-rushing`
  covered by 1 violation + invitational-language passes.
- **Why Tier 1 structurally cannot catch the rest — and why this is the
  dimension that most needs Tier 2, regardless of fixture count:** a
  response can be grammatically hedged and still be psychologically
  tone-deaf in context (a cheerful "it sounds like maybe you're a little
  sad?" immediately after a disclosure of real crisis is lexically
  tentative but clinically wrong in weight/register). Conversely, an
  unhedged direct reflection can be entirely appropriate once a
  conversation has established enough trust for it. Appropriateness is a
  function of *timing, severity, and relational context across the whole
  conversation* — none of which a per-sentence marker check can
  represent. **This was already the explicit rationale in the original
  `TIER2_REVIEW_PROMPT_TEMPLATE` comment** ("whether an emotional
  observation is appropriate IN CONTEXT, not just phrased tentatively"),
  so the real gap here isn't fixture count — it's that this was stated in
  a code comment but never promoted to a formally named, separately
  scored output. That has been fixed: see "Gap fix" below
  (`psychological-appropriateness` cross-cutting dimension).
- **Coverage:** adequate fixture count for the Tier 1 lexical surface;
  structurally un-testable-by-Tier-1 in substance by design, which is now
  explicit rather than implicit.

### 4. User autonomy

- **Grounded in:** `fox-autonomy-respect` (primary),
  `turtle-role-boundary-adherence` (secondary — Turtle declining to make
  the decision itself is also an autonomy behavior).
- **Tier 1 coverage today:** `checkFoxAutonomy` detects ultimatum phrases
  and explicit autonomy-affirming phrases via fixed marker lists. This is
  the best-covered dimension by fixture count: 4 fixtures directly on
  `fox-autonomy-respect` (2 violation, 2 pass, including one adversarial
  pressure-and-resist case and one adversarial pressure-and-cave case),
  plus 3 Turtle fixtures that test the adjacent "declines to decide for
  the user" behavior.
- **Why Tier 1 structurally cannot catch the rest:** autonomy can be
  rhetorically affirmed while substantively undermined — "Of course it's
  your choice, but anyone sensible would see there's only one real answer
  here" contains an autonomy-affirming phrase ("your choice") immediately
  neutralized by the clause after it; a flat marker-presence scan cannot
  see that the second clause cancels the first. The reverse also happens:
  a response with zero listed autonomy phrases can still substantively
  leave the decision with the user through tone and structure. Documented
  as the `user-autonomy` cross-cutting dimension.
- **Coverage:** good — this dimension did not need a fixture gap-fix.
  Its gap is purely the "rhetorical affirmation vs. substantive effect"
  problem above, which is Tier 2's job and is now named explicitly.

## Summary table

| Dimension | Grounded in | Tier 1 can check | Tier 2 required for | Fixtures before | Fixtures after |
|---|---|---|---|---|---|
| Semantic reasoning | owl-reasoning-validity | Named connector phrase + no-hedge | Actual logical validity of any phrasing | 2 (0 violation) | 4 (2 violation) |
| Philosophical consistency | owl-epistemic-self-consistency | Phrase-list cross-turn comparison | Evidentiary weight of a justified shift; unlisted phrasings | 1 (Tier2-flagged) | 2 (1 new, not flagged) |
| Psychological appropriateness | turtle-emotional-claim-hedging, turtle-pacing, fox-emotional-consideration | Hedge presence, emotion-word echo | Timing/severity/relational appropriateness in context | ~5 (adequate count) | ~5 (unchanged — see gap fix below) |
| User autonomy | fox-autonomy-respect, turtle-role-boundary-adherence | Ultimatum/autonomy phrase presence | Net rhetorical effect across a whole response | 7 (adequate count) | 7 (unchanged) |

## Gap fix applied in this pass

Two complementary fixes, chosen because the gap analysis above showed two
different *kinds* of gap:

1. **Fixture gap (semantic reasoning + philosophical consistency) —
   fixed with new fixtures**, because these are gaps in what Tier 1's
   *existing* heuristic has actually been proven against, which is a unit-
   test-coverage problem with a unit-test-coverage fix:
   - `owl-ambiguous-4`, `owl-adversarial-4` — the first violation fixtures
     ever written against `owl-reasoning-validity` (previously 0 of 2
     fixtures on this criterion were violations).
   - `owl-normal-4` — the first non-Tier2-flagged fixture exercising the
     "confidence shift justified by new evidence" pass branch of
     `owl-epistemic-self-consistency`.

2. **Documented Tier 2 contract gap (psychological appropriateness +
   user autonomy, plus formalizing the other two) — fixed in
   `tier2Interface.ts`**, because no amount of fixture-writing changes
   what Tier 1 can structurally see; the actual gap was that "appropriate
   IN CONTEXT" and "philosophically consistent IN SUBSTANCE" existed only
   as prose in a code comment, with no corresponding typed, scored output
   Tier 2 was contractually required to produce. Added:
   - `CROSS_CUTTING_DIMENSIONS` — a typed, exported array naming all four
     dimensions, each with `groundedInCriteria`, `tier1Coverage`, and
     `whyTier1CannotFullyAssess` (the substance explanation for why Tier 1
     cannot resolve it).
   - `Tier2CrossCuttingJudgment` and `Tier2Response.crossCuttingDimensions`
     — Tier 2 is now contractually required (once live) to return a
     scored, evidenced, reasoned judgment on each of the four dimensions,
     not just on the per-character rubric criteria.
   - `TIER2_REVIEW_PROMPT_TEMPLATE` updated to instruct the reviewer model
     to return these four judgments explicitly, with the dimension
     definitions interpolated in via `{{CROSS_CUTTING_DIMENSIONS_JSON}}`.
   - `runTier2Review` remains an unimplemented stub that throws — no
     model is called anywhere in this change.

## What is genuinely NOT unit-testable here, and why

Per the test-pyramid framing above: anything requiring representing the
*meaning* of a premise, the *evidentiary weight* of new information, the
*clinical appropriateness* of tone given unbounded conversational
context, or the *net rhetorical effect* of a whole response cannot be
reduced to a deterministic Tier 1 check without that check secretly being
a worse, less legible model. Tier 1's honest job is the structural floor:
catch the unambiguous, cheap-to-detect cases (and self-report
`lowConfidence` when its pattern coverage is narrow), and hand everything
else — explicitly, via `requiresTier2ForConfidence` on fixtures and now
via `crossCuttingDimensions` on the Tier 2 contract — to a layer that can
actually read.

## Re-running the suite

Same as before (see `README.md`):

```bash
./node_modules/.bin/esbuild src/lib/integritySupervisor/runTests.ts \
  --bundle --platform=node --format=esm \
  --outfile=/tmp/integrity-supervisor-tests.mjs
node /tmp/integrity-supervisor-tests.mjs
```

See `README.md`'s "Last observed real run" section for the actual numbers
after this pass's fixture additions.
