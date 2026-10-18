"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import { api, toast } from "@/lib/client";
import { formatUsd } from "@/lib/format";
import { DROP_RADIUS_M, EGG_PRICE_CENTS, MAX_EGGS, MIN_EGGS } from "@/lib/pricing";
import type { Campaign, RewardType } from "@/lib/types";

interface Config {
  cafeLocation: { lat: number; lng: number };
  cafeName: string;
}

export default function HidePage() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [count, setCount] = useState(200);
  const [rewardType, setRewardType] = useState<RewardType>("discount");
  const [detail, setDetail] = useState("Any coffee drink");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Config>("/api/config").then(setConfig).catch((err: Error) => toast(err.message));
  }, []);

  const cents = count * EGG_PRICE_CENTS;

  async function continueToPay() {
    setBusy(true);
    try {
      const { campaign } = await api<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ eggCount: count, rewardType, rewardDetail: detail, radiusM: DROP_RADIUS_M }),
      });
      router.push(`/business/checkout?campaign=${campaign.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not prepare the drop.");
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h1>Hide eggs</h1>
      <p className="sub">Eggs drop within the circle</p>
      {config ? (
        <div className="map-wrap">
          <MapView
            center={config.cafeLocation}
            zoom={15}
            height={230}
            eggs={[]}
            businesses={[{ id: "cafe", name: config.cafeName, ...config.cafeLocation }]}
            circle={{ ...config.cafeLocation, radiusM: DROP_RADIUS_M }}
          />
          <div className="radius-tag">{DROP_RADIUS_M} m radius</div>
        </div>
      ) : (
        <div className="map map-loading" style={{ height: 230 }}>
          Loading map…
        </div>
      )}
      <h2>
        How many? <span>{count}</span>
      </h2>
      <input
        type="range"
        min={MIN_EGGS}
        max={MAX_EGGS}
        step={10}
        value={count}
        onChange={(event) => setCount(Number(event.target.value))}
        aria-label="Number of eggs"
      />
      <h2>Reward inside</h2>
      <div className="seg">
        <button type="button" className={rewardType === "discount" ? "on" : ""} onClick={() => { setRewardType("discount"); setDetail("Any coffee drink"); }}>
          % Discount
        </button>
        <button type="button" className={rewardType === "gift_card" ? "on" : ""} onClick={() => { setRewardType("gift_card"); setDetail("In-store credit"); }}>
          $ Gift card
        </button>
      </div>
      <h2>{rewardType === "discount" ? "15% off what?" : "Gift card note"}</h2>
      <input className="field" value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={80} />
      <div className="card cost" style={{ marginTop: 12 }}>
        <span>
          {count} × {formatUsd(EGG_PRICE_CENTS)}
        </span>
        <b>{formatUsd(cents)}</b>
      </div>
      <button type="button" className="btn" onClick={continueToPay} disabled={busy}>
        {busy ? "Placing eggs…" : "Continue"}
      </button>
    </div>
  );
}
