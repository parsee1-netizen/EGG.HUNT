"use client";

import { useCallback, useEffect, useState } from "react";

export interface PlayerFix {
  lat: number;
  lng: number;
  source: "gps" | "demo";
}

const KEY = "eggdrop-fix";

export function describeGpsError(err: { code?: number }): string {
  if (err.code === 1) {
    return "Location is off. EggDrop is using the demo spot by the cafe. On iPhone, allow Location for Safari, then tap Try GPS again.";
  }
  if (err.code === 3) {
    return "GPS took too long. Still using the demo spot by the cafe. Tap Try GPS again when you have a clearer sky.";
  }
  return "Couldn't read your location. Still using the demo spot by the cafe.";
}

async function geolocationAlreadyGranted(): Promise<boolean> {
  const permissions = navigator.permissions;
  if (!permissions?.query) return false;
  try {
    const status = await permissions.query({ name: "geolocation" });
    return status.state === "granted";
  } catch {
    return false;
  }
}

function readGps(demo: { lat: number; lng: number }, onFix: (fix: PlayerFix) => void, onError: (message: string) => void) {
  if (!navigator.geolocation) {
    onError("This browser can't share location. The demo spot by the cafe stays on.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      sessionStorage.setItem(KEY, "gps");
      onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" });
    },
    (err) => {
      sessionStorage.setItem(KEY, "demo");
      onError(describeGpsError(err));
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
  );
}

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
    if (!demo) return;
    setGpsError("");
    readGps(demo, (next) => {
      setGpsError("");
      setFix(next);
    }, (message) => {
      setGpsError(message);
      setFix({ lat: demo.lat, lng: demo.lng, source: "demo" });
    });
  }, [demo]);

  useEffect(() => {
    if (!demo) return;
    let cancel = false;
    const applyDemo = () => {
      if (!cancel) setFix({ lat: demo.lat, lng: demo.lng, source: "demo" });
    };
    if (sessionStorage.getItem(KEY) !== "gps") {
      applyDemo();
      return;
    }
    void geolocationAlreadyGranted().then((granted) => {
      if (cancel) return;
      if (!granted) {
        applyDemo();
        return;
      }
      readGps(
        demo,
        (next) => {
          if (!cancel) {
            setGpsError("");
            setFix(next);
          }
        },
        (message) => {
          if (cancel) return;
          setGpsError(message);
          applyDemo();
        },
      );
    });
    return () => {
      cancel = true;
    };
  }, [demo]);

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
