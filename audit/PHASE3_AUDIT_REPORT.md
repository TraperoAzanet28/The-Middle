# THE MIDDLE PANEL — PHASE 3 AUDIT REPORT
### Cowork / Senior Cinematic UX Auditor
### Audit date: 2026-06-02 | Files reviewed: 11 source + 7 screenshots

---

## DIRECT ANSWER TO THE PRIMARY QUESTION

**"Does The Middle Panel now feel like a cinematic psychological journey, or does it still feel like an app?"**

**Honest answer: It is substantially a cinematic psychological journey. It is not yet fully there.**

The bones are right. The audio architecture is genuinely exceptional. The motion system is real, persistent, and architecturally solid. The cave exists and carries philosophical weight. The summary earns its emotion. The title and tagline are correct.

What keeps it from being fully there: the characters are locked inside static background images and cannot breathe, move, or respond to the world. The fox is invisible in its own scene. The Plato step of the cave was not captured in screenshots, suggesting it may not be surfacing clearly. The input screen has CSS that implies a multi-question form — unverified without InputScreen.tsx.

The app is 75% of the way to the vision. The remaining 25% is concentrated in three specific areas. All are fixable.

---

## AUDIT RESULTS — ALL 10 SECTIONS

---

### SECTION 1 — TITLE & TAGLINE
**VERDICT: PASS ✅**
**Severity: N/A**

`HomeScreen.tsx` line 11–12:
```tsx
<h1>The Middle Panel</h1>
<p className="hero__tagline">From fast thinking to slow thinking.</p>
```

Both strings are exact. The title is rendered in `var(--font-serif)` (Playfair Display) at `clamp(36px, 4.8vw, 68px)`. The tagline sits correctly below at 17px with letter-spacing. Screenshot 01 confirms both render correctly in the live app.

---

### SECTION 2 — ONE QUESTION PER SCREEN
**VERDICT: CONDITIONAL PASS ⚠️**
**Severity: MEDIUM**

**What passes:**
- `StageScreen.tsx` is architecturally correct. Every stage uses an internal `idx` counter. Only one content block renders per `idx` value. The `motion.div key={current}` and `motion.div key={idx}` patterns ensure a fresh entrance animation on every step — each moment gets its own screen. Turtle has 3–4 sequential steps. Owl has 4. Fox has 3. Each step shows one question or one set of items. This is good.
- `CaveScreen.tsx` has exactly 2 steps. Step 0 is the descent. Step 1 is Plato's Cave. Clean.

**What cannot be verified:**
- `InputScreen.tsx` was NOT included in the audit files. This is a significant gap.
- The CSS in `global.css` contains: `.control-grid { grid-template-columns: 1fr 1fr }`, `.segmented-grid { grid-template-columns: repeat(4, 1fr) }`, `.cluster`, `.suggestion-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) }`, and `.urgency-row`.
- These classes exist specifically for the input step. `PanelInput` has 5 fields: conflictDescription, emotion, intensity, goal, urgency. The presence of a 2-column grid and 4-column grid strongly suggests multiple fields are presented simultaneously on at least one input step.
- Screenshot 02 only shows step 0 of input (single textarea). Steps for emotion, intensity, goal, and urgency were not captured.

**Required action:** Submit `InputScreen.tsx` for audit. If emotion + intensity, or goal + urgency appear on the same screen simultaneously, that is a structural violation. The multi-column CSS must not be used to present two decisions at once.

---

### SECTION 3 — ENVIRONMENTAL MOTION
**VERDICT: PASS ✅ with one architectural note**
**Severity: LOW**

**What was verified in `AtmosphereCanvas.tsx`:**

- ✅ `requestAnimationFrame` loop initialized once on mount (`useEffect(() => { ... }, [])`) and never torn down between scene changes
- ✅ `effectsRef.current = effects` — the ref is updated every render so the RAF loop always reads the current effects list without restarting. Architecturally excellent. The world never stops.
- ✅ All 5 particle systems have realistic physics:
  - **Clouds:** Double-ellipse radial gradient, 7 clouds, independent velocities, vertical sine oscillation
  - **Leaves:** 25 leaves with sway, rotation, phase offsets, color variation (hue 75–140), correct organic feel
  - **River:** 48 streaks with directional flow, shimmer math, `fillRect` at 1.8px height — correct and lightweight
  - **Fireflies:** 25 particles with independent orbital drift, pulse, glow radius. Not synchronized. Not grid-distributed.
  - **Fog:** 8 patches at 3 atmospheric depths (horizon/ground/high atmosphere), lateral drift, breathing opacity via sine LFO
- ✅ **Camera drift:** CSS `@keyframes cameraDrift` on `.screen-bg` with 42s cycle, scale 1.000–1.020 + translate up to ±9px. The scale-before-translate technique prevents edge bleed. This is done correctly.
- ✅ DPR scaling (`window.devicePixelRatio`) for crisp retina rendering
- ✅ Resize handler updates canvas dimensions correctly

**Particle count concern (low severity):**
At maximum load (turtle scene: fog + river + fireflies):
- 8 fog patches + 48 streaks + 25 fireflies = 81 active draw calls per frame
- This exceeds the 60-particle guideline from the directive
- River streaks are `fillRect` (very cheap). Total GPU cost is acceptable for modern hardware.
- Monitor on lower-end devices.

**Architectural note:**
The `screen-bg` uses `AnimatePresence mode="sync"` — old and new backgrounds overlap during crossfade. Camera drift is a CSS animation on `.screen-bg`, meaning TWO drift cycles momentarily run during transitions (outgoing + incoming). Visually this is nearly imperceptible, but if jitter appears during transitions, the fix is to put camera drift on a wrapper div that is NOT inside AnimatePresence.

---

### SECTION 4 — CHARACTER VISIBILITY & ENVIRONMENTAL PRESENCE
**VERDICT: CONDITIONAL PASS for Turtle/Owl | FAIL for Fox ❌**
**Severity: HIGH**

This is the most important finding in this audit.

**The structural problem:**
The characters are baked into static background PNG files. They have zero programmatic presence. No breathing. No eye movement. No water interaction for the Turtle. No head rotation for the Owl. No tail movement for the Fox. They are photographs, not environmental archetypes. This means the following from the framework are all failures by default:

- ❌ Turtle breathing animation (1 breath per 4–6 seconds)
- ❌ Water disturbance/ripple at the Turtle's edge
- ❌ Owl slow head rotation
- ❌ Moonlight eye reflection on Owl
- ❌ Fox ear or tail movement
- ❌ Any reactive environmental interaction for any character

**Individual character assessment from screenshots:**

**Turtle (screenshot 03):** The turtle shell is faintly visible in the lower-center of the frame, partially submerged near the river. The silhouette is readable. It has some rim lighting from the background image. It is present and discoverable — it passes minimum visibility. However, it reads as part of the background photography, not as a living presence. The atmospheric text that floats above it is poetic and emotionally correct. The turtle SCENE works. The turtle CHARACTER is static.

**Owl (screenshot 04):** There is a shape visible near the large moon and treeline, upper-center of the frame, that could be the owl. It requires active searching to locate. It is NOT the first thing the eye finds. For an archetype that represents clarity and elevated perception, the owl should be immediately readable — not discovered by searching the frame. The valley landscape is beautiful. The owl presence is marginal.

**Fox (screenshot 06):** The fox does not appear in the screenshot. The scene shows an open highland with a river at the bottom. There is no visible fox character anywhere in the frame. The amber/dawn tonal shift IS present in the sky, which is correct. But the fox — the psychological anchor for strategic action — is absent from its own scene. This is a **FAIL**. A user completing the Fox stage has no environmental archetype to connect the psychological content to.

**Required actions:**

For the Fox: The background image `/bg-fox.png.jpeg` must be replaced or supplemented with a visible fox element. At minimum, a fox silhouette should be visible on the ridgeline at approximately the rule-of-thirds intersection. It does not need to be photographic — a painted/atmospheric SVG overlay positioned on top of the background would be appropriate and would also allow animation.

For all three characters — the longer path that makes the experience fully cinematic is to layer a subtle SVG or canvas character element on top of the background image with minimal animation: breathing scale, eye glow pulse, water ripple for the Turtle. This can be done as a character-specific overlay layer in `AtmosphereCanvas` or as a separate component. It does not require a full artistic redraw — even a correctly positioned glowing eye highlight with a slow pulse would transform a static photograph into a living presence.

---

### SECTION 5 — CAVE — SYMBOLIC POWER & VISUAL DISTINCTION
**VERDICT: PASS ✅ for structure | CONDITIONAL PASS ⚠️ for Plato step visibility**
**Severity: LOW-MEDIUM**

**What works:**
- The cave has its own dedicated component (`CaveScreen.tsx`), its own background image (`/bg-cave-inside.png`), and its own atmospheric effect set (`["fog", "river"]`). It is architecturally distinct from every other stage.
- Screenshots 05 confirm the cave background is visually different: stone walls, enclosed space, water visible at the bottom of frame, darker and more compressed than the open landscapes of the other scenes.
- The progress label "DESCEND · CAVE" is atmospheric. Good.
- The cave audio mix is the most distinctive in the app: `{ wind: 0.03, crickets: 0.02, river: 0.10, cave: 0.30, dawn: 0.00 }`. The cave resonance layer dominates. Psychologically correct.
- Step 0 text: "You have moved deeper into yourself. / Now comes the question beneath the question. / Not what you should do. But what you are still carrying that may not belong to this moment." — This is earned and correct.
- Step 1 Plato text (from code): *"What have you been treating as certain that may only be a story?"* followed by the explicit Plato's Cave allegory. This is the philosophical center working as intended.

**What needs verification:**
Screenshots 05 and 05b appear to show the same step — both display "You have moved deeper into yourself" which is step 0 content. The Plato step (step 1) was not captured in screenshots. Either the screenshots were taken before the user pressed "Go deeper", or step 1 is somehow not surfacing. The code for step 1 is correct and present. This should be verified in the live app.

The cave background is darker than other scenes but still reads as blue-cold rather than having any hint of torch warmth or amber firelight. A subtle warm orange-amber overlay (very low opacity, perhaps 0.04–0.06) would make the cave feel distinct not just in darkness but in color temperature — reinforcing the psychological shift from cool perception (Owl) to warm confrontation (Cave → Fox).

---

### SECTION 6 — RIVER CONTINUITY
**VERDICT: CONDITIONAL PASS ⚠️**
**Severity: LOW-MEDIUM**

**Canvas river effect presence per scene:**
```
home:       ❌ (fireflies, clouds — no river effect)
howItWorks: ❌ (fog, fireflies, clouds, leaves — no river effect)
input:      ⚠️ (fog, leaves — no river effect, but bg image shows river)
turtle:     ✅ (fog, river, fireflies — river effect ACTIVE)
owl:        ❌ (fog, fireflies, leaves — river effect ABSENT)
cave:       ✅ (fog, river — river effect ACTIVE)
fox:        ✅ (clouds, river — river effect ACTIVE)
summary:    ❌ (fog, fireflies, clouds, leaves — no river effect)
```

The animated river shimmer effect is absent from the Owl scene and from the Summary scene. However, the background images in screenshots consistently show river/water elements in the landscape, providing visual continuity through the photography rather than through the canvas layer.

This is a pragmatic approach that works at a surface level. But the river as living, moving water — the emotional spine the directive describes — is interrupted at the Owl stage. A user moving from Turtle (river active) to Owl (river absent) may feel the world become less alive at the very moment they are meant to achieve elevated clarity. The river going quiet during the Owl stage actually has psychological logic (the owl rises above the river), but it should be a conscious decision, not an omission.

The summary not having the river effect is a missed emotional opportunity. The summary scene represents resolution — bringing everything together. The river returning at the end would symbolically complete the journey. Add `"river"` to the summary effects array.

---

### SECTION 7 — AUDIO ARCHITECTURE
**VERDICT: PASS ✅ — Architecture is exceptional**
**Severity: N/A (structural pass)**

This is the strongest technical system in the app. The implementation goes beyond what the directive specified.

**Verified:**
- ✅ `AudioContext` — NOT `<audio>` tags. Web Audio API throughout.
- ✅ `GainNode` per layer with exponential ramping via `setTargetAtTime(value, now, 1.4)`
- ✅ 5 independent layers: wind, crickets, river, cave, dawn
- ✅ Each layer: `noise → BiquadFilter (bandpass) → inner gain → LFO → master gain → destination`
- ✅ LFO on every layer adds organic breathing — no layer is a static tone
- ✅ Scene-specific mix table with 8 distinct mixes
- ✅ Lazy boot on first unmute (browser autoplay policy compliance)
- ✅ Crossfade via `setTargetAtTime` with 1.4s time constant — smooth, exponential
- ✅ Full cleanup on unmount

**Technically impressive:** The synthesized approach means zero file loading, zero format issues, zero loop artifacts, infinite duration. The cricket layer (3700Hz, Q=4.2, LFO at 11Hz) produces a plausible high-frequency insect texture. The cave layer (155Hz, Q=0.18, LFO at 0.025Hz) is a very slow, deep sub-bass resonance — more felt than heard.

**The gap that matters:** There is no dedicated owl call layer. The owl scene audio (`{ wind: 0.12, crickets: 0.20, river: 0.04 }`) is just stronger crickets and light wind. The valley silence broken by a sparse, distant owl call is one of the most psychologically distinctive sound moments available to this scene. An owl layer — high-frequency narrow-band noise with a very slow LFO (0.3Hz) and very low gain, fired only in the owl scene — would elevate the Owl stage from atmospheric to iconic.

Also: the dawn layer at 5100Hz, Q=5.8, LFO at 3.2Hz is a high-frequency texture. Whether it sounds like birds or like electrical shimmer depends entirely on the gain level. In the summary scene it's at 0.22 gain — this is the loudest single layer in any scene. At that level it risks sounding harsh. It should be tested at 0.12–0.15.

---

### SECTION 8 — SCENE TRANSITIONS
**VERDICT: PASS ✅**
**Severity: N/A**

From `App.tsx`:
- Background: `AnimatePresence mode="sync"` — old and new backgrounds crossfade simultaneously. Duration: 0.90s easeInOut. This produces a true film-style dissolve.
- Content: `AnimatePresence mode="wait"` — old content fully exits before new content enters. Duration: 0.48s easeInOut with `y: 8 → 0` rise.
- Within-stage steps: `motion.div key={current/idx}` with 0.38–0.42s easeOut — fast enough to feel responsive, slow enough to be cinematic.
- `AtmosphereCanvas` is outside both `AnimatePresence` blocks — confirmed persistent across all transitions.

The separation of background-dissolve and content-wait is architecturally correct. The world breathes while the content changes. This is the right pattern.

---

### SECTION 9 — SUMMARY SCREEN — EMOTIONAL ARC
**VERDICT: PASS ✅**
**Severity: N/A**

From `SummaryScreen.tsx` and screenshot 07:

Opening: *"You paused. / You saw clearly. / You chose."* — Three lines. Each a complete sentence. Each a movement. This is earned language.

From the screenshot, the three summary sections read:
- "Hurt at 5/10 — a signal worth attending to before it becomes a decision." — This is synthesis, not data. ✅
- "Assumptions feel like facts when emotional intensity is high. This is the central perceptual trap." — Philosophical, not clinical. ✅
- "Ask one calm question" in italic serif — the chosen path, featured. ✅
- *"I want to make sure I'm reading this accurately. From my side, my partner went silent after our argument..."* — The example message is personal, specific, and actionable.

This does not feel like a report card. It feels like a mirror. The structure (what you felt / what you saw / what you chose) maps directly to the three stages (Turtle / Owl / Fox) without naming them explicitly — which is the correct restraint.

**One improvement:** The summary opens with poetic language but never anchors the user in the journey they physically traveled through — the forest, the river, the cave. A single transitional line before the three sections, something like "You moved through darkness and came out knowing something you didn't before." would connect the environmental symbolism to the psychological content. The journey was visual and experiential. The summary is only verbal. Bridge them.

---

### SECTION 10 — PERFORMANCE & ARCHITECTURE
**VERDICT: PASS ✅**
**Severity: LOW**

- Particle system is well-budgeted. Maximum active items at turtle (heaviest scene): ~81. River streaks are `fillRect` (trivial GPU cost). Total is manageable on any modern device from 2020 onward.
- State architecture is clean. Single `useState` for `step`, `input`, `analysis`. No unnecessary re-renders observed.
- `backgrounds.ts` naming inconsistency: `"/bg-input.png.jpeg"` and `"/bg-fox.png.jpeg"` have double extensions. This works but is sloppy. Rename to `.jpeg` or `.jpg` and update paths.
- `panel.ts` defines `AppStep` as a type union — there is no dedicated "emergence" stage between cave and fox. This collapses the 8-stage symbolic journey to 7 effective stages. Acceptable given the current build phase but worth revisiting.

---

## TOP 10 IMPROVEMENTS FOR NEXT BUILD PASS

Listed in order of psychological and cinematic impact:

**1. Make the Fox visible in the Fox scene.** (HIGH PRIORITY)
The fox is absent. This is the scene's entire purpose. Replace `/bg-fox.png.jpeg` or add an SVG/canvas overlay with a fox silhouette visible on the ridgeline. At minimum it must be identifiable. Ideally it should be layered in code so it can eventually be animated.

**2. Submit InputScreen.tsx for audit.** (HIGH PRIORITY)
The multi-column CSS (`control-grid`, `segmented-grid`) suggests multiple simultaneous decisions somewhere in the input flow. If emotion and intensity, or goal and urgency, are shown on the same screen, they must be separated into individual steps. One question per screen is the single most important UX law in this app.

**3. Add programmatic character animation layer.** (HIGH)
All three characters are locked in static background images. Even minimal programmatic presence — a glowing eye pulse, a breathing scale oscillation, water ripple at the Turtle's feet — would transform them from background photography into living archetypes. Suggested implementation: a `CharacterLayer` component rendered above `AtmosphereCanvas` and below `screen-content`, keyed to the current stage, with character-specific canvas elements.

**4. Add river effect to the Summary scene.** (MEDIUM)
`summary: ["fog", "fireflies", "clouds", "leaves"]` — the river is absent from the resolution moment. The river returning at the end completes the symbolic arc. Add `"river"` to the summary effects.

**5. Verify and surface the Plato step visually.** (MEDIUM)
Screenshots 05 and 05b both show CaveScreen step 0. Step 1 — the explicit Plato's Cave quote and philosophical paragraph — was not captured. Confirm in the live app that pressing "Go deeper" reliably transitions to step 1 and that the text is readable against the cave background.

**6. Add an owl call to the audio architecture.** (MEDIUM)
`useAmbientAudio.ts` has no owl layer. Add a 6th synthesized layer: narrow-band noise at ~800Hz, Q=12, LFO at 0.3Hz (very slow undulation), gain 0.06 maximum. Active only in the owl scene. A sparse, distant-feeling owl call that pulses slowly would make the valley scene unmistakably distinct from every other.

**7. Add a warm color overlay in the Cave.** (LOW-MEDIUM)
The cave background is cool-blue. A subtle amber/orange radial gradient overlay (rgba(180, 80, 20, 0.04)) would create a sense of torchlight without changing the fundamental atmosphere. This reinforces the cave as a distinct temperature zone between the cool Owl valley and the warming Fox highland.

**8. Adjust dawn audio gain in the Summary.** (LOW)
`summary: { dawn: 0.22 }` — this is the highest single-layer gain in the entire app. At 5100Hz, this risks sounding shrill rather than birdsong-like. Test at 0.12–0.14 and adjust to where it reads as atmospheric birds rather than high-frequency noise.

**9. Add a transitional line to the Summary that anchors the journey.** (LOW)
A single sentence between the opening "You paused. You saw clearly. You chose." and the summary sections — something like "You moved through the forest, the river, and the cave to reach this." — would bridge the environmental journey to the psychological output. Currently the summary is emotionally correct but environmentally disconnected.

**10. Fix background file naming.** (LOW / maintenance)
`"/bg-input.png.jpeg"` and `"/bg-fox.png.jpeg"` in `backgrounds.ts` have double extensions. This works but is a maintenance hazard. Rename the files and update paths.

---

## FINAL SUMMARY TABLE

| Section | Verdict | Severity |
|---------|---------|----------|
| Title & tagline | ✅ PASS | — |
| One question per screen | ⚠️ CONDITIONAL (InputScreen.tsx missing) | MEDIUM |
| Environmental motion architecture | ✅ PASS | LOW note |
| Character visibility — Turtle | ⚠️ CONDITIONAL (static, present) | MEDIUM |
| Character visibility — Owl | ⚠️ CONDITIONAL (marginal, static) | MEDIUM |
| Character visibility — Fox | ❌ FAIL (not visible) | HIGH |
| Cave symbolism & structure | ✅ PASS | — |
| River continuity | ⚠️ CONDITIONAL (absent from Owl, Summary) | MEDIUM |
| Audio architecture | ✅ PASS | — |
| Scene transitions | ✅ PASS | — |
| Summary emotional arc | ✅ PASS | — |
| Performance | ✅ PASS | LOW note |

**STRUCTURAL FAIL triggers (from framework): 0 active**
No full rebuilds required. All issues are targeted corrections.

---

*Audit completed by: Cowork / Senior Cinematic UX Auditor*
*Framework version: v2 (post-mascot phase)*
