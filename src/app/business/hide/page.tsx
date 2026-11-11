"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EggArt } from "@/components/EggArt";
import { EggDesigner } from "@/components/EggDesigner";
import MapView from "@/components/MapView";
import { api, toast } from "@/lib/client";
import { parseEggDesign, sameDesign, type EggDesign } from "@/lib/egg-design";
import { formatUsd } from "@/lib/format";
import { DROP_RADIUS_M, EGG_PRICE_CENTS, MAX_EGGS, MIN_EGGS, prizeOddsPercent } from "@/lib/pricing";
import type { Campaign, RewardType } from "@/lib/types";

interface Config {
  cafeLocation: { lat: number; lng: number };
  cafeName: string;
}

export default function HidePage() {
  const router = useRouter();
  const [step, setStep] = useState<"design" | "place">("design");
  const [config, setConfig] = useState<Config | null>(null);
  const [saved, setSaved] = useState<EggDesign | null>(null);
  const [draft, setDraft] = useState<EggDesign | null>(null);
  const [ready, setReady] = useState(false);
  const [batchOnly, setBatchOnly] = useState(false);
  const [usingBatch, setUsingBatch] = useState(false);
  const [batchDesign, setBatchDesign] = useState<EggDesign | null>(null);
  const [count, setCount] = useState(200);
  const [emptyCount, setEmptyCount] = useState(0);
  const [rewardType, setRewardType] = useState<RewardType>("discount");
  const [detail, setDetail] = useState("Any coffee drink");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<Config>("/api/config"), api<{ design: EggDesign | null }>("/api/design")])
      .then(([nextConfig, nextDesign]) => {
        setConfig(nextConfig);
        setSaved(nextDesign.design);
        setDraft(nextDesign.design);
        setReady(true);
      })
      .catch((err: Error) => toast(err.message));
  }, []);

  const cents = count * EGG_PRICE_CENTS;
  const effective = usingBatch ? batchDesign : saved;

  async function keepEgg() {
    if (draft) {
      try {
        parseEggDesign(draft);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Check the egg design.");
        return;
      }
    }
    if (batchOnly && draft == null && saved != null) {
      toast("The plain egg would change every drop. Turn off “only this batch”, or pick a design.");
      return;
    }
    setBusy(true);
    try {
      if (!batchOnly) {
        const data = await api<{ design: EggDesign | null }>("/api/design", {
          method: "PUT",
          body: JSON.stringify({ design: draft }),
        });
        setSaved(data.design);
        setDraft(data.design);
        setUsingBatch(false);
        setBatchDesign(null);
      } else {
        const override = draft && !sameDesign(draft, saved) ? draft : null;
        setUsingBatch(override != null);
        setBatchDesign(override);
      }
      setStep("place");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not keep that egg.");
    } finally {
      setBusy(false);
    }
  }

  async function continueToPay() {
    setBusy(true);
    try {
      const { campaign } = await api<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          eggCount: count,
          emptyCount,
          rewardType,
          rewardDetail: detail,
          radiusM: DROP_RADIUS_M,
          eggDesign: usingBatch ? batchDesign : null,
        }),
      });
      router.push(`/business/checkout?campaign=${campaign.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not prepare the drop.");
      setBusy(false);
    }
  }

  if (step === "design") {
    return (
      <div className="screen design-screen">
        <div className="design-scroll">
          <h1>Your egg</h1>
          <p className="sub">Choose the egg for this drop before you place it.</p>
          {ready ? <EggDesigner value={draft} onChange={setDraft} /> : <p className="sub">Loading your egg…</p>}
          <label className="check-row">
            <input type="checkbox" checked={batchOnly} onChange={(event) => setBatchOnly(event.target.checked)} />
            <span>Only this batch</span>
          </label>
          <p className="hint">Off saves the egg for every future drop. On uses it just for the eggs you place next.</p>
          <button type="button" className="btn" onClick={() => void keepEgg()} disabled={!ready || busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Hide eggs</h1>
      <p className="sub">Eggs drop within the circle</p>
      <button type="button" className="card design-link" onClick={() => setStep("design")}>
        <EggArt design={effective} size={48} classicBand={!effective} label="Egg for this drop" />
        <span className="design-copy">
          <b>{usingBatch ? "This batch only" : "Your egg"}</b>
          <span>Tap to change the design</span>
        </span>
        <span className="chev">›</span>
      </button>
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
        onChange={(event) => {
          const next = Number(event.target.value);
          setCount(next);
          setEmptyCount((current) => Math.min(current, next));
        }}
        aria-label="Number of eggs"
      />
      <h2>
        Prize odds <span>{prizeOddsPercent(count, emptyCount)}%</span>
      </h2>
      <p className="hint">
        {count - emptyCount} with a reward · {emptyCount} empty
      </p>
      <input
        type="range"
        min={0}
        max={count}
        step={1}
        value={emptyCount}
        onChange={(event) => setEmptyCount(Number(event.target.value))}
        aria-label="Empty eggs in this batch"
      />
      <p className="hint">Empty eggs are still hidden. Opening one shows an empty shell and no wallet reward.</p>
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
      <button type="button" className="btn" onClick={() => void continueToPay()} disabled={busy}>
        {busy ? "Placing eggs…" : "Continue"}
      </button>
    </div>
  );
}
