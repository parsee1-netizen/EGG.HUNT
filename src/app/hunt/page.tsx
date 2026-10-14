"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";
import { formatDistance } from "@/lib/format";
import { CATCH_RADIUS_M } from "@/lib/geo";
import { usePlayerFix } from "@/lib/use-position";
import type { Claim, NearbyEgg } from "@/lib/types";

export default function HuntPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [demo, setDemo] = useState<{ lat: number; lng: number } | null>(null);
  const { fix } = usePlayerFix(demo);
  const [eggs, setEggs] = useState<NearbyEgg[]>([]);
  const [camOn, setCamOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ demoLocation: { lat: number; lng: number } }>("/api/config")
      .then((config) => setDemo(config.demoLocation))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let cancel = false;
    (async () => {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
        if (!cancel) setCamOn(true);
      } catch {
        if (!cancel) setCamOn(false);
      }
    })();
    return () => {
      cancel = true;
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, []);

  useEffect(() => {
    if (!fix) return;
    api<{ eggs: NearbyEgg[] }>(`/api/nearby?lat=${fix.lat}&lng=${fix.lng}&radius=1000`)
      .then((data) => setEggs(data.eggs))
      .catch((err: Error) => toast(err.message));
  }, [fix]);

  const visible = eggs.filter((egg) => egg.distanceM <= CATCH_RADIUS_M);
  const target = visible[0];
  const nearest = eggs[0];

  async function catchEgg() {
    if (!target || !fix || busy) return;
    setBusy(true);
    try {
      const { claim } = await api<{ claim: Claim }>("/api/claims", {
        method: "POST",
        body: JSON.stringify({ eggId: target.id, lat: fix.lat, lng: fix.lng }),
      });
      router.push(`/crack?claim=${claim.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not catch that egg.");
      setBusy(false);
    }
  }

  const pill = !fix
    ? "Finding you…"
    : target
      ? "Egg spotted! Tap to catch"
      : nearest
        ? `Nearest egg is ${formatDistance(nearest.distanceM)} away — get within ${CATCH_RADIUS_M} m`
        : "No eggs left nearby";

  return (
    <div className="screen bleed">
      <div className="cam" aria-hidden>
        <div className="bld" style={{ left: "4%", width: "28%", height: "30%" }} />
        <div className="bld" style={{ left: "36%", width: "22%", height: "22%", background: "#c98f6e" }} />
        <div className="bld" style={{ left: "62%", width: "34%", height: "34%", background: "#9f8a75" }} />
      </div>
      <video ref={videoRef} className="ar-video" style={{ opacity: camOn ? 1 : 0 }} autoPlay playsInline muted />
      <div className={camOn ? "live on" : "live"}>{camOn ? "Live camera" : "Camera off"}</div>
      {target ? <div className="reticle" /> : null}
      {target ? (
        <button type="button" className="float" onClick={catchEgg} disabled={busy} aria-label="Catch egg">
          <div className="e" />
        </button>
      ) : null}
      <div className="arui">
        <div className="pill">{pill}</div>
        <button type="button" className="btn ghost" onClick={() => router.push("/")}>
          ← Back to map
        </button>
      </div>
    </div>
  );
}
