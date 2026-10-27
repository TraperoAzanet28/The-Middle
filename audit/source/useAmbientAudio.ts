import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStep } from "../types/panel";

// Gain targets per scene — each layer tuned to the psychological state of that moment
const sceneMix: Record<AppStep, { wind: number; crickets: number; river: number; cave: number; dawn: number }> = {
  home:       { wind: 0.26, crickets: 0.14, river: 0.00, cave: 0.00, dawn: 0.00 },
  howItWorks: { wind: 0.20, crickets: 0.10, river: 0.00, cave: 0.00, dawn: 0.00 },
  input:      { wind: 0.16, crickets: 0.09, river: 0.05, cave: 0.00, dawn: 0.00 },
  turtle:     { wind: 0.08, crickets: 0.05, river: 0.26, cave: 0.00, dawn: 0.00 },
  owl:        { wind: 0.12, crickets: 0.20, river: 0.04, cave: 0.00, dawn: 0.00 },
  cave:       { wind: 0.03, crickets: 0.02, river: 0.10, cave: 0.30, dawn: 0.00 },
  fox:        { wind: 0.18, crickets: 0.07, river: 0.08, cave: 0.00, dawn: 0.10 },
  summary:    { wind: 0.06, crickets: 0.04, river: 0.05, cave: 0.00, dawn: 0.22 },
};

type Layers = {
  wind: GainNode;
  crickets: GainNode;
  river: GainNode;
  cave: GainNode;
  dawn: GainNode;
};

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Chain: noise → bandpass filter → innerGain (LFO breathes here) → masterGain → destination
// Returns masterGain — we ramp this for scene/mute transitions
function makeLayer(
  ctx: AudioContext,
  noiseBuf: AudioBuffer,
  filterFreq: number,
  q: number,
  lfoFreq: number,
): GainNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop   = true;

  const filter        = ctx.createBiquadFilter();
  filter.type         = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value      = q;

  const inner       = ctx.createGain();
  inner.gain.value  = 0.82;

  const lfo      = ctx.createOscillator();
  lfo.type       = "sine";
  lfo.frequency.value = lfoFreq;
  const lfoAmp   = ctx.createGain();
  lfoAmp.gain.value = 0.18;
  lfo.connect(lfoAmp);
  lfoAmp.connect(inner.gain);
  lfo.start();

  const master      = ctx.createGain();
  master.gain.value = 0;

  src.connect(filter);
  filter.connect(inner);
  inner.connect(master);
  master.connect(ctx.destination);
  src.start();

  return master;
}

function buildLayers(ctx: AudioContext): Layers {
  return {
    // Forest wind — slow, low gust
    wind:    makeLayer(ctx, makeNoiseBuffer(ctx, 6),  580,  0.38, 0.07),
    // Night crickets — high-freq tremolo chirp
    crickets: makeLayer(ctx, makeNoiseBuffer(ctx, 4), 3700, 4.20, 11.0),
    // Stream / river — mid-frequency ripple
    river:   makeLayer(ctx, makeNoiseBuffer(ctx, 5),  920,  0.75, 0.42),
    // Cave resonance — deep, room-like, barely perceptible pulse
    cave:    makeLayer(ctx, makeNoiseBuffer(ctx, 9),  155,  0.18, 0.025),
    // Dawn birds — high harmonics, slow warbler tremolo
    dawn:    makeLayer(ctx, makeNoiseBuffer(ctx, 3),  5100, 5.80, 3.20),
  };
}

export function useAmbientAudio(scene: AppStep) {
  const [isMuted, setIsMuted] = useState(true);
  const ctxRef    = useRef<AudioContext | null>(null);
  const layersRef = useRef<Layers | null>(null);

  // Boot AudioContext on first unmute — satisfies browser autoplay policy
  const boot = useCallback(() => {
    if (ctxRef.current) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx   = new Ctx();
    ctxRef.current    = ctx;
    layersRef.current = buildLayers(ctx);
  }, []);

  const applyMix = useCallback((muted: boolean, sc: AppStep) => {
    const layers = layersRef.current;
    const ctx    = ctxRef.current;
    if (!layers || !ctx) return;

    const target = muted
      ? { wind: 0, crickets: 0, river: 0, cave: 0, dawn: 0 }
      : sceneMix[sc];

    const now = ctx.currentTime;
    const tc  = 1.4; // exponential time constant (seconds)

    (["wind", "crickets", "river", "cave", "dawn"] as const).forEach((key) => {
      layers[key].gain.cancelScheduledValues(now);
      layers[key].gain.setTargetAtTime(target[key], now, tc);
    });
  }, []);

  const toggle = useCallback(() => {
    if (isMuted) {
      boot();
      if (ctxRef.current?.state === "suspended") ctxRef.current.resume();
      applyMix(false, scene);
      setIsMuted(false);
    } else {
      applyMix(true, scene);
      setIsMuted(true);
    }
  }, [isMuted, scene, boot, applyMix]);

  // Cross-fade to new scene whenever step changes
  useEffect(() => {
    applyMix(isMuted, scene);
  }, [scene, isMuted, applyMix]);

  // Cleanup
  useEffect(() => () => { ctxRef.current?.close(); }, []);

  return { isMuted, toggle };
}
