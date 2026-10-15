import jsQR from "jsqr";

/** Decode one camera frame with jsQR. Frames are scaled down so iOS Safari can keep up. */
export function readQrFromFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, maxWidth = 480): string | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = ctx.canvas;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return decodeQrImage(image.data, width, height);
}

export function decodeQrImage(data: Uint8ClampedArray, width: number, height: number): string | null {
  const found = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  return found?.data || null;
}
