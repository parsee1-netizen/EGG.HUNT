"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EggArt } from "@/components/EggArt";
import { api, toast } from "@/lib/client";
import type { EggDesign } from "@/lib/egg-design";
import { formatUsd } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [eggDesign, setEggDesign] = useState<EggDesign | null>(null);

  useEffect(() => {
    api<{ dashboard: DashboardStats; eggDesign: EggDesign | null }>("/api/dashboard")
      .then((data) => {
        setStats(data.dashboard);
        setEggDesign(data.eggDesign ?? null);
      })
      .catch((err: Error) => toast(err.message));
  }, []);

  return (
    <div className="screen">
      <h1>{stats?.businessName ?? "Dashboard"}</h1>
      <p className="sub">{stats?.headline ?? "Loading campaign…"}</p>
      <Link href="/business/design" className="card design-link">
        <EggArt design={eggDesign} size={54} classicBand={!eggDesign} label="Your egg" />
        <span className="design-copy">
          <b>Design your egg</b>
          <span>Colors, pattern, and a badge players see when they find your eggs.</span>
        </span>
        <span className="chev">›</span>
      </Link>
      <div className="stats">
        <div className="stat">
          <b>{stats?.live ?? "—"}</b>
          <span>Eggs live</span>
        </div>
        <div className="stat">
          <b>{stats?.found ?? "—"}</b>
          <span>Eggs found</span>
        </div>
        <div className="stat">
          <b>{stats?.redeemed ?? "—"}</b>
          <span>Redeemed</span>
        </div>
        <div className="stat">
          <b>{stats ? formatUsd(stats.spendCents) : "—"}</b>
          <span>Spend so far</span>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <b>Cost per visit: {stats?.costPerVisitCents != null ? formatUsd(stats.costPerVisitCents) : "—"}</b>
        <p className="sub" style={{ margin: "4px 0 0" }}>
          {stats ? `${stats.redeemed} redemptions from ${formatUsd(stats.spendCents)} in eggs` : "Loading…"}
        </p>
      </div>
      <Link className="btn ghost" href="/business/scan">
        Scan a customer&apos;s code
      </Link>
      <Link className="btn" href="/business/hide">
        + Hide more eggs
      </Link>
    </div>
  );
}
