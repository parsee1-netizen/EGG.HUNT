"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EggArt } from "@/components/EggArt";
import { api, toast } from "@/lib/client";
import { daysLeft, rewardEmoji } from "@/lib/format";
import type { Claim } from "@/lib/types";

export default function WalletPage() {
  const [claims, setClaims] = useState<Claim[] | null>(null);

  useEffect(() => {
    api<{ claims: Claim[] }>("/api/claims")
      .then((data) => setClaims(data.claims))
      .catch((err: Error) => toast(err.message));
  }, []);

  return (
    <div className="screen">
      <h1>Your wallet</h1>
      <p className="sub">Tap a reward to show its one-time code</p>
      {claims === null ? <p className="sub">Loading…</p> : null}
      {claims?.length === 0 ? (
        <div className="card">
          <b>No eggs yet</b>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Catch one from the map. It has to be within 50 m.
          </p>
        </div>
      ) : null}
      {claims?.map((claim) => (
        <Link key={claim.id} href={`/wallet/${claim.id}`} className={`card list wallet-link${claim.status === "redeemed" ? " used" : ""}`}>
          <div className="row wallet-row">
            <EggArt design={claim.design ?? null} size={44} classicBand={!claim.design} label="" />
            <div className="wallet-copy">
              <b>
                {rewardEmoji(claim.rewardTitle)} {claim.rewardTitle}
              </b>
              <span>
                {claim.businessName} · {claim.status === "redeemed" ? "Redeemed" : daysLeft(claim.expiresAt)}
              </span>
            </div>
            <span className="chev">›</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
