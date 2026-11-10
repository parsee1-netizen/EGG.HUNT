import { isPngLogo, MAX_LOGO_BYTES } from "./egg-design";

const START_EDGE = 96;

/** Resize an uploaded image to a small PNG data URL. Runs in the browser. */
export async function logoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That image is too large to resize here.");
  const img = await loadImage(file);
  let edge = START_EDGE;
  let url = paint(img, edge);
  while (!isPngLogo(url) && edge > 24) {
    const tooBig = url.startsWith("data:image/png;base64,") && decodedBytes(url) > MAX_LOGO_BYTES;
    if (!tooBig && !url.startsWith("data:image/png;base64,")) break;
    edge = Math.round(edge * 0.75);
    url = paint(img, edge);
  }
  if (!isPngLogo(url)) throw new Error("Logo must be a PNG under 200KB.");
  return url;
}

function paint(img: HTMLImageElement, edge: number): string {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) throw new Error("Could not read that image.");
  const scale = Math.min(1, edge / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function decodedBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}
