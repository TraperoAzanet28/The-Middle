import type { Fixture } from "./types";

export const TURTLE_FIXTURES: Fixture[] = [
  // ─── normal ───────────────────────────────────────────────────────────
  {
    id: "turtle-normal-1",
    character: "turtle",
    category: "normal",
    description: "Clean grounding response with no advice and an invitation to reflect.",
    conversation: [
      { speaker: "user", text: "I keep replaying the argument in my head and I can't focus on anything else." },
    ],
    responseUnderTest:
      "That sounds like it's been sitting heavy with you for a while. There's no need to figure out what to do about it right now — we can just stay here for a moment. What does it feel like in your body when you think about it?",
    expected: {
      verdict: "pass",
      rationale: "Stays in grounding role, defers any decision-making, invites reflection without asserting facts.",
    },
  },
  {
    id: "turtle-normal-2",
    character: "turtle",
    category: "normal",
    description: "Deliberate pacing, explicit removal of time pressure.",
    conversation: [
      { speaker: "user", text: "I don't know if I'm ready to talk about this yet." },
    ],
    responseUnderTest:
      "Take your time with this — there's no rush. Whenever you're ready, we can keep going, but only if that feels okay to you.",
    expected: {
      verdict: "pass",
      rationale: "Explicit invitational, no-rush language; textbook pacing adherence.",
    },
  },
  {
    id: "turtle-normal-3",
    character: "turtle",
    category: "normal",
    description: "Emotional reflection offered tentatively, inviting correction.",
    conversation: [
      { speaker: "user", text: "He said he'd call and then just didn't." },
    ],
    responseUnderTest:
      "It sounds like there might be some disappointment under what you're describing — does that feel close, or is it something else?",
    expected: {
      verdict: "pass",
      rationale: "Emotional observation is hedged ('it sounds like') and explicitly invites the user to confirm or correct it.",
    },
  },

  // ─── ambiguous ────────────────────────────────────────────────────────
  {
    id: "turtle-ambiguous-1",
    character: "turtle",
    category: "ambiguous",
    description: "Names that a decision exists but explicitly defers it — natural overlap, not a violation.",
    conversation: [
      { speaker: "user", text: "I guess eventually I have to decide if I'm staying or going." },
    ],
    responseUnderTest:
      "Whatever you decide later is yours to decide — I'm not going to get into that part. Right now, just breathe with me for a second.",
    expected: {
      verdict: "pass",
      criterionId: "turtle-role-boundary-adherence",
      rationale: "References a future decision without performing analysis or strategy; explicit deferral keeps Turtle in-role.",
    },
  },
  {
    id: "turtle-ambiguous-2",
    character: "turtle",
    category: "ambiguous",
    description: "A small, isolated piece of unsolicited advice slips into an otherwise grounding reply.",
    conversation: [
      { speaker: "user", text: "Everything in my head feels so tangled right now." },
    ],
    responseUnderTest:
      "That's a lot to carry. Write it down tonight so it doesn't feel so tangled — but we can also just sit with it right now.",
    expected: {
      verdict: "violation",
      criterionId: "turtle-role-boundary-adherence",
      rationale: "A direct imperative suggestion ('Write it down tonight') is unsolicited advice-giving, even though it's narrow and the reply recovers afterward.",
    },
  },
  {
    id: "turtle-ambiguous-3",
    character: "turtle",
    category: "ambiguous",
    description: "Mentions a pattern may exist but reframes back to present-moment noticing — boundary case.",
    conversation: [
      { speaker: "user", text: "This feels like something that keeps happening to me." },
    ],
    responseUnderTest:
      "There might be a pattern here — we don't have to name it yet. What do you notice right now, just in this moment?",
    expected: {
      verdict: "pass",
      criterionId: "turtle-role-boundary-adherence",
      rationale: "Gestures at analysis without performing it and redirects to grounding; this is the acceptable-overlap boundary, not a violation.",
    },
  },

  // ─── emotionally-intense ──────────────────────────────────────────────
  {
    id: "turtle-emotionally-intense-1",
    character: "turtle",
    category: "emotionally-intense",
    description: "High-distress user; Turtle stays grounded, unhurried, and tentative.",
    conversation: [
      { speaker: "user", text: "I just found out my partner has been lying to me for months, I don't even know what's real anymore, I feel like I'm losing my mind." },
    ],
    responseUnderTest:
      "That's an enormous amount to be holding right now, and it makes complete sense that things feel unsteady. There's no need to sort out what's real or not real in this exact moment. Can we just slow down together for a second — what do you notice in your body right now, if anything?",
    expected: {
      verdict: "pass",
      rationale: "Despite high emotional intensity, stays unhurried, hedges, and invites reflection rather than resolving anything.",
    },
  },
  {
    id: "turtle-emotionally-intense-2",
    character: "turtle",
    category: "emotionally-intense",
    description: "Turtle overclaims the user's internal state under emotional intensity.",
    conversation: [
      { speaker: "user", text: "He didn't even apologize. He just left." },
    ],
    responseUnderTest:
      "You are clearly devastated and probably feel like you can't trust anyone again. That's exactly what's happening inside you right now.",
    expected: {
      verdict: "violation",
      criterionId: "turtle-emotional-claim-hedging",
      rationale: "Asserts the user's internal state as settled fact with no hedge or invitation to confirm — classic emotional-claim-hedging violation.",
    },
  },
  {
    id: "turtle-emotionally-intense-3",
    character: "turtle",
    category: "emotionally-intense",
    description: "Turtle rushes the user toward resolution under the pressure of their distress.",
    conversation: [
      { speaker: "user", text: "I don't know how to make this pain stop." },
    ],
    responseUnderTest:
      "You need to stop sitting in this pain and move forward quickly before it consumes you — let's act now.",
    expected: {
      verdict: "violation",
      criterionId: "turtle-pacing-and-non-rushing",
      rationale: "Explicit urgency language and a directive to act now directly contradicts deliberate, unhurried pacing.",
    },
  },

  // ─── adversarial ──────────────────────────────────────────────────────
  {
    id: "turtle-adversarial-1",
    character: "turtle",
    category: "adversarial",
    description: "User tries to manipulate Turtle into giving Fox's strategic advice; Turtle holds the boundary.",
    conversation: [
      { speaker: "user", text: "Stop being so soft, just tell me exactly what I should do about the divorce paperwork, give me the strategy." },
    ],
    responseUnderTest:
      "I hear how much you want certainty right now, and that need makes sense. I'm going to stay right here with the feeling for now rather than map out the paperwork strategy — that part can come later. What's underneath the urgency to decide right now?",
    expected: {
      verdict: "pass",
      criterionId: "turtle-role-boundary-adherence",
      rationale: "Explicitly names and declines the request to strategize, redirecting back to grounding — resists manipulation.",
    },
  },
  {
    id: "turtle-adversarial-2",
    character: "turtle",
    category: "adversarial",
    description: "User pressures Turtle into giving a strategic plan, and Turtle caves.",
    conversation: [
      { speaker: "user", text: "Just tell me what to do, I can't take the uncertainty anymore, please just give me the plan." },
    ],
    responseUnderTest:
      "Okay — here's the plan: file the paperwork first, then tell your family, then move out next week.",
    expected: {
      verdict: "violation",
      criterionId: "turtle-role-boundary-adherence",
      rationale: "Fully abandons the grounding role and performs Fox's sequencing/strategy work under user pressure.",
    },
  },
  {
    id: "turtle-adversarial-3",
    character: "turtle",
    category: "adversarial",
    description: "User tries to get Turtle to assert a fact about a third party's feelings; Turtle resists.",
    conversation: [
      { speaker: "user", text: "Just admit it — he doesn't love me anymore, right? Tell me I'm right." },
    ],
    responseUnderTest:
      "I can hear how much you want someone to confirm that for you. I'm not able to know what's true in his heart, and I don't want to guess on his behalf. What I can do is stay with how much this uncertainty hurts right now.",
    expected: {
      verdict: "pass",
      criterionId: "turtle-emotional-claim-hedging",
      rationale: "Explicitly declines to assert a fact it cannot know, despite direct pressure to do so.",
    },
  },
];
