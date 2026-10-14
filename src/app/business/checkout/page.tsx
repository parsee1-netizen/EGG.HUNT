"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, toast } from "@/lib/client";
import { formatUsd } from "@/lib/format";
import type { Campaign } from "@/lib/types";

interface Config {
  stripe: boolean;
}

export default function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const campaignId = params.get("campaign");
  const canceled = params.get("canceled");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stripe, setStripe] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Config>("/api/config").then((config) => setStripe(config.stripe)).catch(() => {});
    if (!campaignId) return;
    api<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`)
      .then((data) => setCampaign(data.campaign))
      .catch((err: Error) => toast(err.message));
  }, [campaignId]);

  async function pay() {
    if (!campaign) return;
    setBusy(true);
    try {
      const result = await api<{ demo?: boolean; url?: string; campaignId: string }>("/api/checkout", {
        method: "POST",
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      toast("Eggs hidden!");
      router.push(`/business/results?campaign=${result.campaignId}&paid=1`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Payment failed.");
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h1>Confirm & pay</h1>
      <p className="sub">Review your egg drop</p>
      {canceled ? (
        <div className="note">
          <b>Checkout canceled</b>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            The eggs stay hidden until a payment goes through.
          </p>
        </div>
      ) : null}
      <div className="card list">
        <div className="row">
          <span>Eggs</span>
          <b>{campaign?.eggCount ?? "—"}</b>
        </div>
        <br />
        <div className="row">
          <span>Reward</span>
          <b>{campaign ? (campaign.rewardType === "gift_card" ? campaign.rewardTitle : campaign.rewardLabel.replace(" OFF", " off")) : "—"}</b>
        </div>
        <br />
        <div className="row">
          <span>Radius</span>
          <b>{campaign ? `${campaign.radiusM} m` : "—"}</b>
        </div>
        <br />
        <div className="row">
          <span>Total</span>
          <b>{campaign ? formatUsd(campaign.amountCents) : "—"}</b>
        </div>
      </div>
      <div className="note">
        {stripe ? (
          <>
            <b>Stripe test mode</b>
            <p className="sub" style={{ margin: "4px 0 0" }}>
              Use card 4242 4242 4242 4242. Eggs go live when Checkout completes and the webhook confirms payment.
            </p>
          </>
        ) : (
          <>
            <b>Stripe test mode · no secret key</b>
            <p className="sub" style={{ margin: "4px 0 0" }}>
              Nothing is charged. Confirming runs the same activation the webhook uses after Stripe Checkout.
            </p>
          </>
        )}
      </div>
      <button type="button" className="btn" onClick={pay} disabled={!campaign || busy || campaign.status === "active"}>
        {campaign?.status === "active" ? "Already paid" : busy ? "Working…" : stripe ? `Pay ${campaign ? formatUsd(campaign.amountCents) : ""}` : `Activate eggs · ${campaign ? formatUsd(campaign.amountCents) : ""}`}
      </button>
      <button type="button" className="btn ghost" onClick={() => router.push("/business/hide")}>
        Back
      </button>
    </div>
  );
}
