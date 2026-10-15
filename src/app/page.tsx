"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import { api, toast } from "@/lib/client";
import { formatDistance } from "@/lib/format";
import { CATCH_RADIUS_M } from "@/lib/geo";
import { usePlayerFix } from "@/lib/use-position";
import type { NearbyEgg } from "@/lib/types";

interface NearbyResponse {
  eggs: NearbyEgg[];
  businesses: { id: string; name: string; lat: number; lng: number }[];
}

interface Config {
  demoLocation: { lat: number; lng: number };
  catchRadiusM: number;
}

export default function MapPage() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const { fix, gpsError, useDemo, useGps } = usePlayerFix(config?.demoLocation ?? null);
  const [eggs, setEggs] = useState<NearbyEgg[]>([]);
  const [businesses, setBusinesses] = useState<NearbyResponse["businesses"]>([]);

  useEffect(() => {
    api<Config>("/api/config").then(setConfig).catch((err: Error) => toast(err.message));
  }, []);

  useEffect(() => {
    if (!fix) return;
    const radius = 1000;
    api<NearbyResponse>(`/api/nearby?lat=${fix.lat}&lng=${fix.lng}&radius=${radius}`)
      .then((data) => {
        setEggs(data.eggs);
        setBusinesses(data.businesses);
      })
      .catch((err: Error) => toast(err.message));
  }, [fix]);

  const nearby = eggs.filter((egg) => egg.distanceM <= 400);
  const nearest = eggs[0];
  const labeled = new Set(eggs.slice(0, 4).map((egg) => egg.id));

  return (
    <div className="screen">
      <h1>Eggs near you</h1>
      <p className="sub">
        {fix ? `${nearby.length} eggs within 400 m` : "Finding eggs…"}
      </p>
      <div className="loc-row">
        <p>{fix?.source === "gps" ? "Live GPS" : "Demo spot by the cafe"}</p>
        {fix?.source === "gps" ? (
          <button type="button" className="btn ghost slim" onClick={useDemo}>
            Demo spot
          </button>
        ) : (
          <button type="button" className="btn ghost slim" onClick={useGps}>
            {gpsError ? "Try GPS again" : "Use my GPS"}
          </button>
        )}
      </div>
      {gpsError ? (
        <div className="note" role="status">
          <b>Still on the demo spot</b>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            {gpsError}
          </p>
        </div>
      ) : null}
      {fix ? (
        <MapView
          center={fix}
          zoom={16}
          player={fix}
          businesses={businesses}
          eggs={eggs.map((egg) => ({
            id: egg.id,
            lat: egg.lat,
            lng: egg.lng,
            label: labeled.has(egg.id) ? `${formatDistance(egg.distanceM)} · ${shortName(egg.businessName)}` : undefined,
          }))}
          onEgg={(id) => {
            const egg = eggs.find((item) => item.id === id);
            if (!egg) return;
            if (egg.distanceM <= (config?.catchRadiusM ?? CATCH_RADIUS_M)) router.push("/hunt");
            else toast(`Get within ${config?.catchRadiusM ?? CATCH_RADIUS_M} m. This egg is ${formatDistance(egg.distanceM)} away.`);
          }}
        />
      ) : (
        <div className="map map-loading">Loading map…</div>
      )}
      <button
        type="button"
        className="btn"
        disabled={!nearest}
        onClick={() => router.push("/hunt")}
      >
        {nearest ? `📷 Hunt nearest egg · ${formatDistance(nearest.distanceM)}` : "No eggs nearby"}
      </button>
    </div>
  );
}

function shortName(name: string) {
  if (name.startsWith("Bean There")) return "Cafe";
  return name.split(" ")[0];
}
