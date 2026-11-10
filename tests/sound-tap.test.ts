import assert from "node:assert/strict";
import test from "node:test";

test("menu and control taps start one tone, and a second tap still can", async () => {
  const { parseHTML } = await import("linkedom");
  const { window, document } = parseHTML(`<!doctype html><html><body>
    <nav class="nav">
      <a id="map" href="/"><i>Map</i></a>
      <a id="wallet" href="/wallet"><i>Wallet</i></a>
    </nav>
    <header>
      <button id="player" type="button">Player</button>
      <div role="tablist"><div id="tab" role="tab">Design</div></div>
    </header>
    <div role="menu"><div id="item" role="menuitem">Hide eggs</div></div>
    <a id="row" class="card list" href="/wallet/1"><span>20% off</span></a>
    <div class="seg"><button id="seg" type="button">Discount</button></div>
    <button id="swatch" type="button" aria-label="#c9a96e"></button>
    <input id="slider" type="range" />
    <label id="batch"><input type="checkbox" /> Only this batch</label>
    <select id="pick"><option>A</option></select>
    <div id="sheet" data-sound="tap">Sheet row</div>
    <button id="mute" type="button" data-sound="silent">Sound</button>
    <button id="dead" type="button" disabled>Nope</button>
  </body></html>`);

  let starts = 0;
  let contexts = 0;
  const session = { type: "auto" };

  class FakeAudioContext {
    state = "suspended";
    currentTime = 0;
    sampleRate = 48000;
    destination = {};
    constructor() {
      contexts += 1;
    }
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    createGain() {
      const node = {
        gain: {
          value: 1,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
      return node;
    }
    createOscillator() {
      const ctx = this;
      return {
        type: "sine",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {
          if (ctx.state !== "running") throw new Error("tone started while AudioContext was suspended");
          starts += 1;
        },
        stop() {},
      };
    }
  }

  window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  Object.defineProperty(globalThis, "window", { value: window, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: { audioSession: session, vibrate() {} },
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });

  const { audioCallCount } = await import("../src/lib/sound");
  const { TAP_SELECTOR, installInterfaceSounds } = await import("../src/lib/use-sound");
  assert.match(TAP_SELECTOR, /\ba\b/);
  assert.match(TAP_SELECTOR, /button/);
  assert.match(TAP_SELECTOR, /\[role='tab'\]/);
  assert.match(TAP_SELECTOR, /\[role='menuitem'\]/);
  assert.match(TAP_SELECTOR, /\[data-sound\]/);
  installInterfaceSounds(document);

  const fire = (selector: string, type: string) => {
    const el = document.querySelector(selector);
    assert.ok(el, selector);
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerType: "touch", button: 0 });
    el.dispatchEvent(event);
  };

  const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

  // iOS sends touchstart then pointerdown for one tap on a nav link.
  fire("#wallet i", "touchstart");
  fire("#wallet i", "pointerdown");
  await flush();
  assert.equal(starts, 1);
  assert.equal(audioCallCount(), 1);
  assert.equal(session.type, "playback");
  assert.equal(contexts, 1);
  assert.equal((window as unknown as { __eggdropAudioCalls?: number }).__eggdropAudioCalls, 1);

  const controls = ["#player", "#tab", "#item", "#row span", "#seg", "#swatch", "#slider", "#batch", "#pick", "#sheet"];
  for (const selector of controls) {
    await flush();
    fire(selector, "pointerdown");
    await flush();
  }
  assert.equal(starts, 1 + controls.length);

  const beforeSilent = starts;
  fire("#mute", "pointerdown");
  fire("#mute", "touchstart");
  fire("#dead", "pointerdown");
  await flush();
  assert.equal(starts, beforeSilent);

  // The same AudioContext is still the one that plays after a "navigation".
  await flush();
  fire("#map i", "touchstart");
  await flush();
  assert.equal(starts, beforeSilent + 1);
  assert.equal(contexts, 1);
});
