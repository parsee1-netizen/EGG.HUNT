/**
 * Shared EggDrop audio. Synthesized with the Web Audio API so iPhone Safari
 * does not need a file or a CDN. The context is created on the first gesture.
 */

const STORAGE_KEY = "eggdrop-sound";
const MASTER_GAIN = 0.34;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabledCache: boolean | null = null;

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const host = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return host.AudioContext ?? host.webkitAudioContext ?? null;
}

/** Default is on. A stored "off" is the only mute. */
export function soundEnabled(): boolean {
  if (enabledCache != null) return enabledCache;
  if (typeof window === "undefined") return true;
  try {
    enabledCache = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    enabledCache = true;
  }
  return enabledCache;
}

export function setSoundEnabled(on: boolean): void {
  enabledCache = on;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* private mode can block storage; the in-memory flag still applies */
  }
  if (on) unlockAudio();
}

/** Create or resume the context. Call from a user gesture so iOS will play. */
export function unlockAudio(): AudioContext | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function output(): { ctx: AudioContext; master: GainNode } | null {
  if (!soundEnabled()) return null;
  const audio = unlockAudio();
  if (!audio || !master) return null;
  return { ctx: audio, master };
}

function haptic(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers expose vibrate and then throw */
  }
}

function tone(options: {
  freq: number;
  endFreq?: number;
  dur: number;
  type?: OscillatorType;
  peak: number;
  attack?: number;
  delay?: number;
}): void {
  const bus = output();
  if (!bus) return;
  const { ctx: audio, master: dest } = bus;
  const start = audio.currentTime + (options.delay ?? 0);
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = options.type ?? "sine";
  osc.frequency.setValueAtTime(options.freq, start);
  if (options.endFreq != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.endFreq), start + options.dur);
  }
  const peak = Math.max(0.0002, options.peak);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + (options.attack ?? 0.008));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + options.dur + 0.02);
}

function noiseBurst(dur: number, peak: number, frequency: number): void {
  const bus = output();
  if (!bus) return;
  const { ctx: audio, master: dest } = bus;
  const length = Math.max(1, Math.floor(audio.sampleRate * dur));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const fade = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  const gain = audio.createGain();
  const start = audio.currentTime;
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** Soft tick for buttons, tabs, and other controls. */
export function playTap(): void {
  haptic(8);
  tone({ freq: 1480, endFreq: 980, dur: 0.032, peak: 0.05, attack: 0.002 });
}

/** Shell crack, lined up with the crack animation. */
export function playCrack(): void {
  haptic(16);
  noiseBurst(0.14, 0.11, 1900);
  tone({ freq: 210, endFreq: 70, dur: 0.12, type: "triangle", peak: 0.07, attack: 0.004 });
}

/** Gentle bell as a prize is revealed. */
export function playChime(): void {
  haptic([10, 36, 12]);
  tone({ freq: 784, dur: 0.7, peak: 0.05, attack: 0.012 });
  tone({ freq: 1174.7, dur: 0.85, peak: 0.04, attack: 0.012, delay: 0.09 });
  tone({ freq: 1568, dur: 0.95, peak: 0.032, attack: 0.01, delay: 0.18 });
}

/** Short rising major figure after the chime. */
export function playFlourish(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, index) => {
    tone({ freq, dur: 0.38, peak: 0.03, attack: 0.008, delay: index * 0.07 });
  });
}

/** Quiet falling tone for an empty shell. Not a buzzer. */
export function playAww(): void {
  haptic(8);
  tone({ freq: 392, endFreq: 311.13, dur: 0.48, peak: 0.028, attack: 0.02 });
  tone({ freq: 587.33, endFreq: 466.16, dur: 0.52, type: "triangle", peak: 0.014, attack: 0.03, delay: 0.04 });
}
