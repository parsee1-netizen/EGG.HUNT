/**
 * Synthesized EggDrop cues. Web Audio only — nothing is fetched.
 * iOS Safari stays silent until the first gesture resumes the context.
 */

export const SOUND_STORAGE_KEY = "eggdrop-sound";

const MASTER = 0.36;
const TAP_SELECTOR = [
  "button",
  "a[href]",
  "[role='button']",
  "[role='switch']",
  "[role='tab']",
  "input[type='checkbox']",
  "input[type='radio']",
  "input[type='color']",
  "input[type='range']",
  "select",
  "label.file-label",
  ".seg label",
  "label.check-row",
  ".leaflet-marker-icon",
].join(",");

type StoreGet = Pick<Storage, "getItem">;
type StoreSet = Pick<Storage, "setItem">;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let unlocked = false;

function browserStore(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readSoundEnabled(storage: StoreGet | null = browserStore()): boolean {
  if (!storage) return true;
  return storage.getItem(SOUND_STORAGE_KEY) !== "off";
}

export function writeSoundEnabled(on: boolean, storage: StoreSet | null = browserStore()): void {
  storage?.setItem(SOUND_STORAGE_KEY, on ? "on" : "off");
}

function soundOn(): boolean {
  return readSoundEnabled();
}

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const webkit = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return window.AudioContext ?? webkit ?? null;
}

function context(): AudioContext | null {
  if (ctx && ctx.state === "closed") {
    ctx = null;
    master = null;
    noise = null;
    unlocked = false;
  }
  if (ctx && master) return ctx;
  const Ctor = audioCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = soundOn() ? MASTER : 0.0001;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    ctx = null;
    master = null;
    return null;
  }
}

function applyMaster(on: boolean) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  if (on) {
    master.gain.setValueAtTime(MASTER, now);
    return;
  }
  const current = Math.max(0.0001, master.gain.value);
  master.gain.setValueAtTime(current, now);
  master.gain.linearRampToValueAtTime(0.0001, now + 0.07);
}

function noiseBuffer(audio: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === audio.sampleRate) return noise;
  const length = Math.floor(audio.sampleRate * 0.45);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

function tone(
  audio: AudioContext,
  dest: AudioNode,
  freq: number,
  when: number,
  dur: number,
  peak: number,
  type: OscillatorType = "sine",
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(40, freq), when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + Math.min(0.018, dur * 0.22));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.03);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

function noiseBurst(
  audio: AudioContext,
  dest: AudioNode,
  when: number,
  dur: number,
  peak: number,
  band: number,
  q: number,
) {
  const buffer = noiseBuffer(audio);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(band, when);
  filter.Q.setValueAtTime(q, when);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  const offset = Math.min(0.2, Math.max(0, buffer.duration - dur - 0.02)) * Math.random();
  src.start(when, offset, dur);
  src.stop(when + dur + 0.02);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

function bell(audio: AudioContext, dest: AudioNode, freq: number, when: number, dur: number, peak: number) {
  tone(audio, dest, freq, when, dur, peak, "sine");
  tone(audio, dest, freq * 2.02, when, dur * 0.55, peak * 0.22, "sine");
}

function prepare(): AudioContext | null {
  if (!soundOn()) return null;
  const audio = context();
  if (!audio || !master) return null;
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function run(fn: (audio: AudioContext, dest: GainNode, when: number) => void) {
  try {
    const audio = prepare();
    if (!audio || !master) return;
    fn(audio, master, audio.currentTime + 0.012);
  } catch {
    /* A closed or interrupted context should never break a tap. */
  }
}

/** Resume inside a user gesture. Required before any cue on iPhone Safari. */
export function unlockAudio() {
  const audio = context();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  if (unlocked) return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    unlocked = true;
  } catch {
    unlocked = false;
  }
}

export function playTap() {
  run((audio, dest, when) => {
    tone(audio, dest, 1680, when, 0.038, 0.04, "sine");
    noiseBurst(audio, dest, when, 0.016, 0.028, 3800, 1.3);
  });
}

/** Brittle shell: a few high clicks plus a short wooden drop. */
export function playCrack() {
  run((audio, dest, when) => {
    const hits = [
      { at: 0, dur: 0.07, peak: 0.14, band: 2600, q: 0.7 },
      { at: 0.038, dur: 0.06, peak: 0.1, band: 1900, q: 0.85 },
      { at: 0.078, dur: 0.07, peak: 0.07, band: 3400, q: 0.6 },
      { at: 0.12, dur: 0.09, peak: 0.045, band: 880, q: 0.55 },
    ];
    for (const hit of hits) {
      noiseBurst(audio, dest, when + hit.at, hit.dur, hit.peak, hit.band, hit.q);
    }
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(170, when);
    osc.frequency.exponentialRampToValueAtTime(52, when + 0.18);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.06, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + 0.24);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });
}

/** Soft glass notes as the shell opens. */
export function playChime() {
  run((audio, dest, when) => {
    bell(audio, dest, 784, when, 0.52, 0.04);
    bell(audio, dest, 1174.7, when + 0.07, 0.56, 0.028);
    bell(audio, dest, 1568, when + 0.14, 0.5, 0.016);
  });
}

/** Short rising figure for the prize, kept quiet. */
export function playFlourish() {
  run((audio, dest, when) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      bell(audio, dest, freq, when + i * 0.1, 0.62, 0.034);
    });
    bell(audio, dest, 1568, when + 0.46, 0.5, 0.016);
  });
}

export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* iPhone Safari has no vibration API. */
  }
}

export function setSoundEnabled(on: boolean) {
  if (soundOn() === on) return;
  writeSoundEnabled(on);
  applyMaster(on);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("eggdrop-sound", { detail: on }));
  }
  if (on) {
    unlockAudio();
    playTap();
  }
}

export function subscribeSound(listener: (on: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (event: Event) => {
    listener(Boolean((event as CustomEvent<boolean>).detail));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== SOUND_STORAGE_KEY) return;
    const on = readSoundEnabled();
    applyMaster(on);
    listener(on);
  };
  window.addEventListener("eggdrop-sound", onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("eggdrop-sound", onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function interactiveControl(target: EventTarget | null): Element | null {
  if (typeof Element === "undefined") return null;
  if (!(target instanceof Element)) return null;
  if (target.closest(".leaflet-control-attribution")) return null;
  const control = target.closest(TAP_SELECTOR);
  if (!control) return null;
  if (control.matches(":disabled") || control.getAttribute("aria-disabled") === "true") return null;
  if (control.classList.contains("leaflet-marker-icon") && !control.querySelector(".pin")) return null;
  return control;
}

/** One listener for every button, tab, link, and other control. */
export function bindInterfaceSounds(doc: Document = document): () => void {
  let lastCue = 0;

  const cue = (target: EventTarget | null) => {
    unlockAudio();
    if (!interactiveControl(target)) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastCue < 280) return;
    lastCue = now;
    if (soundOn()) playTap();
    haptic(8);
  };

  const onClick = (event: Event) => {
    if (event instanceof MouseEvent && event.button !== 0) return;
    if ("isTrusted" in event && !event.isTrusted) return;
    cue(event.target);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if ("isTrusted" in event && !event.isTrusted) return;
    cue(event.target);
  };

  const onUnlock = () => unlockAudio();

  doc.addEventListener("pointerdown", onUnlock, true);
  doc.addEventListener("touchend", onUnlock, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKey, true);
  return () => {
    doc.removeEventListener("pointerdown", onUnlock, true);
    doc.removeEventListener("touchend", onUnlock, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKey, true);
  };
}
