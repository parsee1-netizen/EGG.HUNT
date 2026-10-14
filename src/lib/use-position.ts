"use client";

import { useCallback, useEffect, useState } from "react";

export interface PlayerFix {
  lat: number;
  lng: number;
  source: "gps" | "demo";
}

const KEY = "eggdrop-fix";

export function usePlayerFix(demo: { lat: number; lng: number } | null) {
  const [fix, setFix] = useState<PlayerFix | null>(null);
  const [gpsError, setGpsError] = useState("");

  const useDemo = useCallback(() => {
    if (!demo) return;
    sessionStorage.setItem(KEY, "demo");
    setGpsError("");
    setFix({ lat: demo.lat, lng: demo.lng, source: "demo" });
  }, [demo]);

  const useGps = useCallback(() => {
    sessionStorage.setItem(KEY, "gps");
    if (!navigator.geolocation) {
      setGpsError("This browser has no geolocation.");
      if (demo) setFix({ lat: demo.lat, lng: demo.lng, source: "demo" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsError("");
        setFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" });
      },
      (err) => {
        setGpsError(err.message || "Location denied");
        sessionStorage.setItem(KEY, "demo");
        if (demo) setFix({ lat: demo.lat, lng: demo.lng, source: "demo" });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
    );
  }, [demo]);

  useEffect(() => {
    if (!demo) return;
    const saved = sessionStorage.getItem(KEY);
    if (saved === "gps") useGps();
    else setFix({ lat: demo.lat, lng: demo.lng, source: "demo" });
  }, [demo, useGps]);

  useEffect(() => {
    if (fix?.source !== "gps" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [fix?.source]);

  return { fix, gpsError, useDemo, useGps };
}
