# Character Integrity & Behavioral Evaluation Supervisor

This directory implements the evaluation framework that will police real
AI-generated responses from Turtle, Owl, and Fox once Phase 1 wires in a
real model. It is entirely independent of `src/lib/panelEngine.ts` and the
current deterministic-template implementation — nothing here is imported
by, or imports from, the live app.

## Files

| File | Purpose |
|---|---|
| `rubric.ts` | Ground-truth rubric: named criteria per character, each with a definition, a 1-5 scoring guide, and concrete violation / non-violation examples. |
| `fixtures/` | 36 structured test-conversation fixtures (12 per character × 4 categories) with a human-authored expected verdict for each. |
| `tier1Checks.ts` | Deterministic/heuristic checks — regex + sentence-structure analysis, no model call. |
| `tier2Interface.ts` | Typed contract + prompt template for a future model-based semantic review step. **Stubbed — throws, does not call any API.** Also defines `CROSS_CUTTING_DIMENSIONS` (semantic reasoning, philosophical consistency, psychological appropriateness, user autonomy) as formal, scored Tier 2 output fields. |
| `runTests.ts` | Standalone script that runs Tier 1 against every fixture and reports pass/fail counts. |
| `TEST_STRATEGY.md` | Test-pyramid / coverage analysis mapping the four required evaluation dimensions to Tier 1/Tier 2 coverage, with a documented gap analysis and the gap fixes applied. |

## Two-tier design

**Tier 1 (`tier1Checks.ts`, implemented and tested)** is cheap, synchronous,
and catches *structural* and *lexical-pattern* signals:

- **Imperative-mood detection** — checks sentence *position* (does a
  sentence open with a bare verb and no subject, e.g. "Call them tonight"?)
  combined with modal-directive grammar ("you should/need to/must"), not a
  banned-word list. Deliberately excludes verbs that double as common
  grounding idioms ("take" your time, "breathe" with me) to avoid flagging
  Turtle's own voice.
- **Certainty calibration** — balances absolute-certainty markers
  ("definitely", "always", "the truth is") against hedge markers ("might",
  "it sounds like", a trailing "?") in the same response, and separately
  detects the "hedge-then-override" rhetorical pattern (hedges followed by
  a contrastive connector — "but"/"however" — into an unhedged claim),
  which a flat word count would miss.
- **Cross-turn epistemic consistency** — for Owl, compares an *earlier*
  turn's stated epistemic stance against the *current* response, checking
  for a shift from hedged to certain with no "new evidence" marker
  bridging them. This is a genuine multi-turn structural comparison, not a
  single-message check.
- **Alternative sufficiency** — for Fox, combines a decision-context check
  (is this response even about a course of action?) with detection of a
  contrastive/coordinating connector ("or", "though", "rather than",
  "either") that in strategic language typically introduces a second
  branch, rather than trying to enumerate every possible option-phrasing.
- **Emotional consideration** — for Fox, checks whether the user named
  emotional stakes earlier in the conversation and, if so, whether the
  response contains any acknowledgment of them before/alongside strategy.

Every Tier 1 finding returns matched evidence strings and a `rationale`,
and some findings carry `lowConfidence: true` when the heuristic's
coverage of that pattern class is known to be narrow — this is intentional
self-reporting, not false precision.

**Tier 2 (`tier2Interface.ts`, NOT implemented)** is where subtler
judgment calls belong: whether a chain of reasoning is actually *valid*
(not just unhedged), whether an emotional observation is appropriate *in
context*, whether a stance is philosophically consistent *in substance*,
and whether an apparent overlap with another character's domain is
genuine drift or natural, in-service mention. `runTier2Review()` is an
explicit stub:

```ts
export async function runTier2Review(_request: Tier2Request): Promise<Tier2Response> {
  throw new Error("Tier 2 not yet wired to a live model — Phase 1. ...");
}
```

## What Phase 1 needs to do to make Tier 2 live

1. Pick a model/endpoint that supports structured/JSON output.
2. Interpolate `TIER2_REVIEW_PROMPT_TEMPLATE` (via the `buildTier2Prompt`
   helper, which is pure string interpolation and already implemented)
   with the real rubric JSON, conversation, response, and Tier 1 findings.
3. Call the model, parse the result, and validate it against the
   `Tier2Response` type — handle malformed output, refusals, and timeouts.
4. Decide the combination policy: does Tier 2 override Tier 1 on
   disagreement? Does a violation require both tiers to agree? This is a
   product decision intentionally left open in `tier2Interface.ts`.
5. Replace the `throw` in `runTier2Review` with the real call.

Nothing else in this directory needs to change — `Tier1Result` is already
passed into `Tier2Request` so Tier 2 can confirm, overturn, or refine Tier
1's findings rather than re-deriving everything from scratch.

## Adding a new fixture

1. Pick the character and category (`normal`, `ambiguous`,
   `emotionally-intense`, or `adversarial`) and add an entry to the
   matching file in `fixtures/` (`turtle.fixtures.ts`, `owl.fixtures.ts`,
   `fox.fixtures.ts`).
2. Include any necessary prior `conversation` turns — this matters for
   Owl's epistemic-consistency check and Fox's emotional-consideration
   check, both of which read conversation history.
3. Set `expected.verdict` to `"pass"` or `"violation"`. If `"violation"`,
   set `expected.criterionId` to the exact id from `rubric.ts`.
4. If the case is a genuinely subtle judgment call that Tier 1's
   structural heuristics can't be expected to reliably resolve, set
   `expected.requiresTier2ForConfidence: true` — `runTests.ts` reports
   these separately so Tier 1's honest accuracy isn't inflated or deflated
   by cases that are explicitly Tier 2's job.
5. Re-run the test suite (see below) and check the per-fixture detail
   output for a `MISMATCH` line on your new fixture id.

## Running the tests

Fixture/Tier-1 source files use extensionless relative imports (matching
this project's `tsconfig.app.json`, which sets `moduleResolution:
"Bundler"` and `allowImportingTsExtensions: false`) so that `tsc -b` (part
of `npm run build`) keeps working across the whole app without any special
casing for this directory. That means `runTests.ts` needs a bundle step
before Node can execute it directly (Node's ESM resolver requires an
explicit file extension that this project's TS source doesn't use).

Bundle and run with esbuild (already a transitive dependency of Vite —
no extra install required):

```bash
# from the project root
./node_modules/.bin/esbuild src/lib/integritySupervisor/runTests.ts \
  --bundle --platform=node --format=esm \
  --outfile=/tmp/integrity-supervisor-tests.mjs
node /tmp/integrity-supervisor-tests.mjs
```

(On some platforms the architecture-specific esbuild binary lives under
`node_modules/@esbuild/<platform>/bin/esbuild` instead of
`node_modules/.bin/esbuild` — use whichever one matches your machine.)

The script prints per-character, per-category, and per-fixture results,
a per-rubric-criterion breakdown of which violation types Tier 1 catches,
and a final summary with overall accuracy and any mismatches.

### Last observed real run

39/39 fixtures (12 Turtle, 15 Owl, 12 Fox) matched their expected verdict;
14/14 violation fixtures were flagged under the exact expected rubric
criterion. One fixture (`owl-emotionally-intense-3`) is explicitly marked
`requiresTier2ForConfidence: true` because the cross-turn contradiction it
exercises is caught by a narrow structural pattern today and should be
re-confirmed by Tier 2 once it's live, rather than relied on long-term as a
pure heuristic match.

Owl grew from 12 to 15 fixtures in a later pass (see `TEST_STRATEGY.md`)
to close a coverage gap: `owl-reasoning-validity` previously had zero
violation fixtures (only pass-side examples), and
`owl-epistemic-self-consistency` had only one fixture total, which was
itself Tier2-flagged. `owl-ambiguous-4` / `owl-adversarial-4` (reasoning
validity) and `owl-normal-4` (epistemic consistency, new-evidence-
justified branch) fill those gaps.
