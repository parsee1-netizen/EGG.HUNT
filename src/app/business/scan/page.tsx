"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { api } from "@/lib/client";
import type { Claim } from "@/lib/types";

type Outcome =
  | { kind: "ok"; claim: Claim }
  | { kind: "bad"; message: string }
  | null;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const lastScan = useRef("");

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let stream: MediaStream | null = null;
    let cancel = false;
    let frame = 0;

    const tick = () => {
      if (cancel) return;
      if (video.readyState >= 2 && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (found?.data && found.data !== lastScan.current) {
            lastScan.current = found.data;
            setCode(found.data);
            void redeem(found.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }
        if (cancel) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play().catch(() => {});
        if (!cancel) {
          setCamOn(true);
          frame = requestAnimationFrame(tick);
        }
      } catch {
        if (!cancel) setCamOn(false);
      }
    })();

    return () => {
      cancel = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function redeem(value: string) {
    const tokenOrCode = value.trim();
    if (!tokenOrCode || busy) return;
    setBusy(true);
    try {
      const result = await api<{ claim: Claim }>("/api/redeem", {
        method: "POST",
        body: JSON.stringify({ tokenOrCode }),
      });
      setOutcome({ kind: "ok", claim: result.claim });
    } catch (err) {
      setOutcome({ kind: "bad", message: err instanceof Error ? err.message : "Could not redeem." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h1>Scan to redeem</h1>
      <p className="sub">Point at the customer&apos;s QR, or type the code</p>
      <div className="scan-box">
        <video ref={videoRef} style={{ opacity: camOn ? 1 : 0 }} autoPlay playsInline muted />
        <div className={camOn ? "live on" : "live"}>{camOn ? "Live camera" : "Camera off"}</div>
      </div>
      <canvas ref={canvasRef} hidden />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void redeem(code);
        }}
      >
        <input
          className="field"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="EGG-4F7K-22"
          aria-label="Reward code"
          autoCapitalize="characters"
        />
        <button type="submit" className="btn" disabled={busy || !code.trim()}>
          {busy ? "Checking…" : "Redeem code"}
        </button>
      </form>
      {outcome?.kind === "ok" ? (
        <div className="note ok">
          <b>Redeemed · {outcome.claim.rewardLabel}</b>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            {outcome.claim.rewardDetail}. Give this to the customer. Code {outcome.claim.code} is now used.
          </p>
        </div>
      ) : null}
      {outcome?.kind === "bad" ? (
        <div className="note bad">
          <b>Not redeemed</b>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            {outcome.message}
          </p>
        </div>
      ) : null}
    </div>
  );
}
