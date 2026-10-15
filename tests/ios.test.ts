import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { create } from "qrcode";
import {
  cameraActionLabel,
  cameraHelp,
  cameraPreflight,
  cameraStatusLabel,
  classifyCameraError,
} from "../src/lib/camera";
import { decodeQrImage } from "../src/lib/qr-scan";
import { isHttpsRequest } from "../src/lib/session";
import { describeGpsError } from "../src/lib/use-position";

test("camera stays idle until a tap, and denial has a retry", () => {
  assert.equal(cameraPreflight(true, true), null);
  assert.equal(cameraPreflight(false, true), "insecure");
  assert.equal(cameraPreflight(true, false), "unavailable");
  assert.equal(classifyCameraError(Object.assign(new Error("no"), { name: "NotAllowedError" }), true), "denied");
  assert.equal(classifyCameraError(Object.assign(new Error("no"), { name: "SecurityError" }), true), "insecure");
  assert.equal(classifyCameraError(new Error("missing"), true), "unavailable");
  assert.equal(classifyCameraError(new Error("ignored"), false), "insecure");
  assert.equal(cameraActionLabel("idle"), "Start camera");
  assert.equal(cameraActionLabel("denied"), "Try camera again");
  assert.match(cameraHelp("denied", "hunt"), /allow Camera/i);
  assert.match(cameraHelp("insecure", "scan"), /HTTPS/);
  assert.equal(cameraStatusLabel("live"), "Live camera");
  assert.equal(cameraStatusLabel("denied"), "Camera blocked");
});

test("the demo session cookie is Secure only on HTTPS", () => {
  assert.equal(isHttpsRequest(new Request("http://127.0.0.1:3000/api/session")), false);
  assert.equal(isHttpsRequest(new Request("https://eggdrop.example/api/session")), true);
  assert.equal(
    isHttpsRequest(new Request("http://localhost:3000/api/session", { headers: { "x-forwarded-proto": "https" } })),
    true,
  );
});

test("a denied location falls back to a plain-language note", () => {
  assert.match(describeGpsError({ code: 1 }), /demo spot/);
  assert.match(describeGpsError({ code: 1 }), /Try GPS again/);
  assert.match(describeGpsError({ code: 3 }), /too long/);
  assert.match(describeGpsError({ code: 2 }), /demo spot/);
});

test("jsQR reads a code painted the same way the wallet draws one", () => {
  const text = "EGG-4F7K-22";
  const qr = create(text, { errorCorrectionLevel: "M" });
  const scale = 8;
  const margin = 4;
  const dim = (qr.modules.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const col = Math.floor(x / scale) - margin;
      const row = Math.floor(y / scale) - margin;
      const dark = col >= 0 && row >= 0 && col < qr.modules.size && row < qr.modules.size && qr.modules.get(row, col);
      const i = (y * dim + x) * 4;
      const value = dark ? 0x2b : 0xff;
      data[i] = value;
      data[i + 1] = dark ? 0x21 : 0xff;
      data[i + 2] = dark ? 0x18 : 0xff;
      data[i + 3] = 255;
    }
  }
  assert.equal(decodeQrImage(data, dim, dim), text);
});

test("the phone shell uses dynamic viewport, safe areas, and 16px inputs", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const layout = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/manifest.webmanifest"), "utf8")) as {
    display: string;
    orientation: string;
    icons: { sizes: string }[];
  };
  assert.equal(css.includes("100vh"), false);
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /safe-area-inset-right/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(layout, /black-translucent/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /apple-mobile-web-app-capable/);
  assert.match(layout, /appleWebApp:\s*\{[^}]*capable:\s*true/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "180x180"));
});
