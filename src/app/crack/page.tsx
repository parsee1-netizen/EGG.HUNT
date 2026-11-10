"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Celebration from "@/components/Celebration";
import { EggArt } from "@/components/EggArt";
import { api } from "@/lib/client";
import { haptic, playChime, playCrack, playFlourish } from "@/lib/sound";
import type { Claim } from "@/lib/types";

type Phase = "hold" | "crack" | "celebrate";

export default function CrackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const claimId = params.get("claim");
  const [claim, setClaim] = useState<Claim | null>(null);
  const [phase, setPhase] = useState<Phase>("hold");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    setPhase("hold");
    setClaim(null);
    setError("");
    if (!claimId) {
      setError("That egg got away.");
      return;
    }
    api<{ claim: Claim }>(`/api/claims/${claimId}`)
      .then((data) => {
        if (!cancel) setClaim(data.claim);
      })
      .catch((err: Error) => {
        if (!cancel) setError(err.message);
      });
    return () => {
      cancel = true;
    };
  }, [claimId]);

  useEffect(() => {
    if (!claim) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const crackAt = reduce ? 40 : 320;
    const chimeAt = reduce ? 180 : 840;
    const celebrateAt = reduce ? 320 : 1340;

    const crackTimer = window.setTimeout(() => {
      if (!reduce) setPhase("crack");
      playCrack();
      haptic([10, 28, 14]);
    }, crackAt);
    const chimeTimer = window.setTimeout(() => playChime(), chimeAt);
    const celebrateTimer = window.setTimeout(() => {
      setPhase("celebrate");
      playFlourish();
      haptic([8, 46, 12]);
    }, celebrateAt);

    return () => {
      window.clearTimeout(crackTimer);
      window.clearTimeout(chimeTimer);
      window.clearTimeout(celebrateTimer);
    };
  }, [claim]);

  return (
    <div className="screen crack-screen">
      <div className="crackwrap" data-phase={phase} aria-live="polite">
        {phase === "celebrate" && claim ? (
          <Celebration claim={claim} />
        ) : (
          <>
            <h1>You caught an egg!</h1>
            <div className={phase === "crack" ? "crack-egg cracked" : "crack-egg"}>
              <div className="crack-piece t">
                <EggArt design={claim?.design ?? null} size={150} classicBand={!claim?.design} />
              </div>
              <div className="crack-piece b">
                <EggArt design={claim?.design ?? null} size={150} classicBand={!claim?.design} />
              </div>
            </div>
            {!claim && !error ? <p className="sub">Cracking it open…</p> : null}
            {error ? <p className="sub">{error}</p> : null}
          </>
        )}
      </div>
      <button type="button" className="btn" disabled={!claim} onClick={() => router.push("/wallet")}>
        Add to wallet
      </button>
    </div>
  );
}
