"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    if (!claimId) {
      setError("That egg got away.");
      return;
    }
    api<{ claim: Claim }>(`/api/claims/${claimId}`)
      .then((data) => setClaim(data.claim))
      .catch((err: Error) => setError(err.message));
    const id = window.setTimeout(() => setCracked(true), 300);
    return () => window.clearTimeout(id);
  }, [claimId]);

  return (
    <div className="screen">
      <div className="crackwrap">
        <h1>You caught an egg!</h1>
        <div className={cracked ? "egg2 cracked" : "egg2"} id="egg2">
          <div className="half t" />
          <div className="half b" />
        </div>
        <div className={cracked && claim ? "reward show" : "reward"}>
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
