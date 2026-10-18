export type CameraPhase = "idle" | "starting" | "live" | "denied" | "unavailable" | "insecure";

export function cameraPreflight(isSecureContext: boolean, hasGetUserMedia: boolean): CameraPhase | null {
  if (!isSecureContext) return "insecure";
  if (!hasGetUserMedia) return "unavailable";
  return null;
}

export function classifyCameraError(err: unknown, isSecureContext: boolean): Exclude<CameraPhase, "idle" | "starting" | "live"> {
  if (!isSecureContext) return "insecure";
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
  if (name === "SecurityError") return "insecure";
  return "unavailable";
}

export function cameraStatusLabel(phase: CameraPhase): string {
  switch (phase) {
    case "live":
      return "Live camera";
    case "starting":
      return "Starting camera…";
    case "denied":
      return "Camera blocked";
    case "insecure":
      return "Needs HTTPS";
    default:
      return "Camera off";
  }
}

export function cameraHelp(phase: CameraPhase, where: "hunt" | "scan"): string {
  switch (phase) {
    case "idle":
      return where === "hunt"
        ? "Tap to start the rear camera. It stays off until you do."
        : "Tap to start the rear camera, or type the code below.";
    case "starting":
      return "Starting the camera…";
    case "denied":
      return "Camera access is off. On iPhone, allow Camera for Safari, or for EggDrop if you added it to the Home Screen, then try again.";
    case "insecure":
      return "The camera needs HTTPS. Open an https tunnel or a Vercel preview, then try again.";
    case "unavailable":
      return where === "hunt"
        ? "No camera is available. You can still tap an egg on the street."
        : "No camera is available. Type the code below.";
    default:
      return "";
  }
}

export function cameraActionLabel(phase: CameraPhase): string {
  if (phase === "starting") return "Starting…";
  if (phase === "idle") return "Start camera";
  return "Try camera again";
}

/** Attach the rear camera. Call this from a tap — iOS Safari drops the prompt otherwise. */
export async function attachRearCamera(video: HTMLVideoElement): Promise<MediaStream> {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "");

  const tries: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const constraints of tries) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      return stream;
    } catch (err) {
      last = err;
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") throw err;
    }
  }
  throw last instanceof Error ? last : new Error("Camera unavailable");
}
