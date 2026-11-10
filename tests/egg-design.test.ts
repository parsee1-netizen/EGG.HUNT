import assert from "node:assert/strict";
import test from "node:test";
import { CAFE_EGG, EGG_PRESETS, clipBadgeText, isPngLogo, parseEggDesign, sameDesign } from "../src/lib/egg-design";
import { eggMarkup } from "../src/lib/egg-svg";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("presets round-trip and badge text stays short", () => {
  for (const preset of EGG_PRESETS) {
    assert.ok(sameDesign(parseEggDesign(preset.design), preset.design));
  }
  assert.equal(clipBadgeText("  hello world  "), "hello wo");
  assert.equal(clipBadgeText("café"), "café");
  assert.equal(isPngLogo(TINY_PNG), true);
  assert.equal(isPngLogo("data:image/svg+xml,<svg></svg>"), false);
  assert.throws(() => parseEggDesign({ ...CAFE_EGG, badge: { kind: "logo", logo: "https://evil.example/a.png" } }));
  assert.throws(() => parseEggDesign({ ...CAFE_EGG, badge: { kind: "text", text: "   " } }));
});

test("egg markup escapes badge text and only embeds a png logo", () => {
  const plain = eggMarkup(null, { id: "plain", classicBand: true });
  assert.match(plain, /#ffc93c/);
  assert.match(plain, /#e85d75/);
  assert.equal(eggMarkup(null, { id: "pin", detail: "mini" }).includes("#e85d75"), false);

  const marked = eggMarkup(
    {
      baseColor: "#112233",
      secondColor: "#ABCDEF",
      pattern: "stripes",
      shine: true,
      badge: { kind: "text", text: `<b>&"'` },
    },
    { id: "t:1" },
  );
  assert.equal(marked.includes("<b>"), false);
  assert.match(marked, /&lt;b&gt;&amp;&quot;&#39;/);
  assert.match(marked, /id="t1-fill"/);
  assert.match(marked, /class="glitter"/);

  const logo = eggMarkup(
    { ...CAFE_EGG, badge: { kind: "logo", logo: TINY_PNG } },
    { id: "logo" },
  );
  assert.ok(logo.includes(TINY_PNG));
  const rejected = eggMarkup(
    { ...CAFE_EGG, badge: { kind: "logo", logo: `data:image/svg+xml,<script>` } },
    { id: "bad" },
  );
  assert.equal(rejected.includes("<script>"), false);
  assert.equal(rejected.includes("<image"), false);
});
