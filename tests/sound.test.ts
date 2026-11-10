import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  SOUND_STORAGE_KEY,
  haptic,
  interactiveControl,
  playChime,
  playCrack,
  playFlourish,
  playTap,
  readSoundEnabled,
  unlockAudio,
  writeSoundEnabled,
} from "../src/lib/sound";

function memoryStorage() {
  const mem = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return mem.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      mem.set(key, value);
    },
  };
}

test("sound defaults on and only 'off' mutes it", () => {
  const storage = memoryStorage();
  assert.equal(readSoundEnabled(storage), true);
  writeSoundEnabled(false, storage);
  assert.equal(storage.getItem(SOUND_STORAGE_KEY), "off");
  assert.equal(readSoundEnabled(storage), false);
  writeSoundEnabled(true, storage);
  assert.equal(storage.getItem(SOUND_STORAGE_KEY), "on");
  assert.equal(readSoundEnabled(storage), true);
});

test("cues and haptics no-op without Web Audio", () => {
  assert.equal(interactiveControl(null), null);
  assert.doesNotThrow(() => {
    unlockAudio();
    playTap();
    playCrack();
    playChime();
    playFlourish();
    haptic([8, 20, 8]);
  });
});

test("crack celebration and the shared sound control are wired in", () => {
  const root = process.cwd();
  const crack = fs.readFileSync(path.join(root, "src/app/crack/page.tsx"), "utf8");
  const celebration = fs.readFileSync(path.join(root, "src/components/Celebration.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const shell = fs.readFileSync(path.join(root, "src/components/AppShell.tsx"), "utf8");
  const hunt = fs.readFileSync(path.join(root, "src/app/hunt/page.tsx"), "utf8");
  const sound = fs.readFileSync(path.join(root, "src/lib/sound.ts"), "utf8");

  assert.match(crack, /playCrack\(/);
  assert.match(crack, /playChime\(/);
  assert.match(crack, /playFlourish\(/);
  assert.match(crack, /Celebration/);
  assert.match(crack, /prefers-reduced-motion/);
  assert.match(celebration, /Congratulations/);
  assert.match(celebration, /#c9a96e|#C9A96E|ivory|spark/);
  assert.match(shell, /bindInterfaceSounds/);
  assert.match(shell, /SoundToggle/);
  assert.match(hunt, /SoundToggle/);
  assert.match(sound, /webkitAudioContext/);
  assert.match(sound, /localStorage/);
  assert.match(css, /\.celebration/);
  assert.match(css, /\.prize-card/);
  assert.match(css, /\.sound-toggle/);
  assert.match(css, /#c9a96e/i);
  assert.match(css, /#f5f1e8/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.spark-field/);
  assert.equal(css.includes("100vh"), false);
});
