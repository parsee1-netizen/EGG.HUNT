"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { formatUsd } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api<{ dashboard: DashboardStats }>("/api/dashboard")
      .then((data) => setStats(data.dashboard))
      .catch((err: Error) => toast(err.message));
  }, []);

  return (
    <div className="screen">
      <h1>{stats?.businessName ?? "Dashboard"}</h1>
      <p className="sub">{stats?.headline ?? "Loading campaign…"}</p>
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
