"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, toast } from "@/lib/client";
import type { CampaignResults, CampaignSummary } from "@/lib/types";

interface ResultsResponse {
  campaigns: CampaignSummary[];
  selected: CampaignResults;
}

export default function ResultsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initialId = params.get("campaign");
  const paid = params.get("paid");
  const sessionId = params.get("session_id");
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [banner, setBanner] = useState(paid === "1" ? "Eggs are live." : "");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (sessionId) {
          await api("/api/checkout/confirm", { method: "POST", body: JSON.stringify({ sessionId }) });
          if (!cancel) setBanner("Payment received. Eggs are live.");
        }
        const query = selectedId ? `?campaign=${selectedId}` : initialId ? `?campaign=${initialId}` : "";
        const next = await api<ResultsResponse>(`/api/results${query}`);
        if (!cancel) {
          setData(next);
          setSelectedId(next.selected.id);
        }
      } catch (err) {
        if (!cancel) toast(err instanceof Error ? err.message : "Could not load results.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedId, sessionId, initialId]);

  const selected = data?.selected;
  const foundPct = selected && selected.placed ? Math.round((selected.found / selected.placed) * 100) : 0;
  const redeemedPct = selected && selected.found ? Math.round((selected.redeemed / selected.found) * 100) : 0;
  const newPct = selected && selected.redeemed ? Math.round((selected.newCustomers / selected.redeemed) * 100) : 0;

  return (
    <div className="screen">
      <h1>Campaign results</h1>
      <p className="sub">
        {selected ? `${selected.name} · ${selected.daysRunning} days` : "Loading…"}
      </p>
      {banner ? (
        <div className="note ok">
          <b>{banner}</b>
        </div>
      ) : null}
      {data && data.campaigns.length > 1 ? (
        <div className="chips">
          {data.campaigns.map((campaign) => (
            <button key={campaign.id} type="button" className={campaign.id === selected?.id ? "on" : ""} onClick={() => setSelectedId(campaign.id)}>
              {campaign.name}
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <>
          <div className="card">
            <b>Found</b> {selected.found} of {selected.placed}
            <div className="bar">
              <i style={{ width: `${foundPct}%` }} />
            </div>
            <b>Redeemed</b> {selected.redeemed} of {selected.found}
            <div className="bar">
              <i style={{ width: `${redeemedPct}%` }} />
            </div>
            <b>New customers</b> {selected.newCustomers} of {selected.redeemed}
            <div className="bar">
              <i className="alt" style={{ width: `${newPct}%` }} />
            </div>
          </div>
          <div className="card list">
            <div className="row">
              <span>Best day</span>
              <b>{selected.bestDay ?? "—"}</b>
            </div>
            <br />
            <div className="row">
              <span>Top reward</span>
              <b>{selected.topReward ?? selected.rewardTitle}</b>
            </div>
            <br />
            <div className="row">
              <span>Still hidden</span>
              <b>{selected.live}</b>
            </div>
          </div>
        </>
      ) : null}
      <button type="button" className="btn" onClick={() => router.push("/business")}>
        Back to dashboard
      </button>
    </div>
  );
}
