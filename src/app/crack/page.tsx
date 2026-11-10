"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EggArt } from "@/components/EggArt";
import { api } from "@/lib/client";
import { daysLeft } from "@/lib/format";
import type { Claim } from "@/lib/types";

export default function CrackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const claimId = params.get("claim");
  const [claim, setClaim] = useState<Claim | null>(null);
  const [cracked, setCracked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCracked(false);
    setClaim(null);
    if (!claimId) {
      setError("That egg got away.");
      return;
    }
    setError("");
    api<{ claim: Claim }>(`/api/claims/${claimId}`)
      .then((data) => setClaim(data.claim))
      .catch((err: Error) => setError(err.message));
  }, [claimId]);

  useEffect(() => {
    if (!claim) return;
    const id = window.setTimeout(() => setCracked(true), 320);
    return () => window.clearTimeout(id);
  }, [claim]);

  return (
    <div className="screen">
      <div className="crackwrap">
        <h1>You caught an egg!</h1>
        <div className={cracked ? "crack-egg cracked" : "crack-egg"}>
          <div className="crack-piece t">
            <EggArt design={claim?.design ?? null} size={150} classicBand={!claim?.design} />
          </div>
          <div className="crack-piece b">
            <EggArt design={claim?.design ?? null} size={150} classicBand={!claim?.design} />
          </div>
        </div>
        <div className={cracked || error ? "reward show" : "reward"}>
          {claim ? (
            <>
              <div className="big">{claim.rewardLabel}</div>
              <h2>{claim.rewardDetail}</h2>
              <p className="sub">
                {claim.businessName}
                <br />
                {daysLeft(claim.expiresAt)}
              </p>
            </>
          ) : (
            <p className="sub">{error || "Cracking it open…"}</p>
          )}
        </div>
      </div>
      <button type="button" className="btn" disabled={!claim} onClick={() => router.push("/wallet")}>
        Add to wallet
      </button>
    </div>
  );
}
