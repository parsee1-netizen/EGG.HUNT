"use client";

import { useEffect, useRef, useState } from "react";
import { cameraActionLabel, cameraHelp, cameraStatusLabel } from "@/lib/camera";
import { api } from "@/lib/client";
import { readQrFromFrame } from "@/lib/qr-scan";
import { useRearCamera } from "@/lib/use-camera";
import type { Claim } from "@/lib/types";

type Outcome =
  | { kind: "ok"; claim: Claim }
  | { kind: "bad"; message: string }
  | null;

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useRearCamera(videoRef);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const lastScan = useRef("");
  const busyRef = useRef(false);
  const redeemRef = useRef<(value: string) => Promise<void>>(async () => {});

  async function redeem(value: string) {
    const tokenOrCode = value.trim();
    if (!tokenOrCode || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await api<{ claim: Claim }>("/api/redeem", {
        method: "POST",
        body: JSON.stringify({ tokenOrCode }),
      });
      setOutcome({ kind: "ok", claim: result.claim });
    } catch (err) {
      setOutcome({ kind: "bad", message: err instanceof Error ? err.message : "Could not redeem." });
      lastScan.current = "";
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  redeemRef.current = redeem;

  useEffect(() => {
    if (camera.phase !== "live") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let frame = 0;
    let cancel = false;
    const tick = () => {
      if (cancel) return;
      const found = readQrFromFrame(ctx, video);
      if (found && found !== lastScan.current) {
        lastScan.current = found;
        setCode(found);
        void redeemRef.current(found);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancel = true;
      cancelAnimationFrame(frame);
    };
  }, [camera.phase]);

  const help = cameraHelp(camera.phase, "scan");

  return (
    <div className="screen">
      <h1>Scan to redeem</h1>
      <p className="sub">Point at the customer&apos;s QR, or type the code</p>
      <div className="scan-box">
        <video
          ref={videoRef}
          style={{ opacity: camera.phase === "live" ? 1 : 0 }}
          autoPlay
          playsInline
          muted
          disablePictureInPicture
        />
        <div className={camera.phase === "live" ? "live on" : "live"}>{cameraStatusLabel(camera.phase)}</div>
        {camera.phase !== "live" ? (
          <div className="scan-gate" role="status">
            <p>{help}</p>
            <button type="button" className="btn" onClick={camera.start} disabled={camera.phase === "starting"}>
              {cameraActionLabel(camera.phase)}
            </button>
          </div>
        ) : null}
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
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          inputMode="text"
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
