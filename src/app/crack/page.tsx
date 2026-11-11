"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EggArt } from "@/components/EggArt";
import { api } from "@/lib/client";
import { daysLeft } from "@/lib/format";
import { playAww, playChime, playCrack, playFlourish } from "@/lib/sound";
import type { Claim, EggDesign, EmptyOpening } from "@/lib/types";

const SPARKS = Array.from({ length: 30 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 30 + (i % 2 ? 0.12 : 0);
  const dist = 78 + (i % 5) * 26;
  return {
    id: i,
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist * 0.82 - 16),
    delay: `${(i % 6) * 0.04}s`,
    size: 4 + (i % 3) * 2,
    color: i % 3 === 1 ? "#f5f1e8" : "#C9A96E",
    gem: i % 4 === 0,
    rot: i % 2 === 0 ? "40deg" : "-28deg",
  };
});

const PUFFS = [
  { x: -18, y: -8, s: 16, d: "0.12s" },
  { x: 14, y: -18, s: 11, d: "0.18s" },
  { x: 2, y: -26, s: 8, d: "0.1s" },
  { x: -6, y: 8, s: 13, d: "0.2s" },
  { x: 22, y: 0, s: 7, d: "0.16s" },
];

const FEATHERS = [
  { x: -30, y: -34, d: "0.14s", r: "-22deg" },
  { x: 26, y: -28, d: "0.2s", r: "16deg" },
];

export default function CrackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const claimId = params.get("claim");
  const emptyId = params.get("empty");
  const [claim, setClaim] = useState<Claim | null>(null);
  const [opening, setOpening] = useState<EmptyOpening | null>(null);
  const [cracked, setCracked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");

  const isEmpty = Boolean(opening);
  const design: EggDesign | null = claim?.design ?? opening?.design ?? null;

  useEffect(() => {
    let cancel = false;
    setCracked(false);
    setRevealed(false);
    setClaim(null);
    setOpening(null);
    setError("");
    if (!claimId && !emptyId) {
      setError("That egg got away.");
      return;
    }
    const load = async () => {
      try {
        if (emptyId) {
          const data = await api<{ opening: EmptyOpening }>(`/api/openings/${emptyId}`);
          if (!cancel) setOpening(data.opening);
        } else if (claimId) {
          const data = await api<{ claim: Claim }>(`/api/claims/${claimId}`);
          if (!cancel) setClaim(data.claim);
        }
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "That egg got away.");
      }
    };
    void load();
    return () => {
      cancel = true;
    };
  }, [claimId, emptyId]);

  const ready = Boolean(claim || opening);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => {
      setCracked(true);
      playCrack();
    }, 320);
    return () => window.clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    if (!cracked) return;
    let flourishId = 0;
    const id = window.setTimeout(() => {
      setRevealed(true);
      if (isEmpty) {
        playAww();
      } else {
        playChime();
        flourishId = window.setTimeout(() => playFlourish(), 420);
      }
    }, 640);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(flourishId);
    };
  }, [cracked, isEmpty]);

  const title = !revealed ? "You caught an egg!" : isEmpty ? "Not this time" : "Congratulations";

  return (
    <div className="screen opening-screen">
      <div className="crackwrap">
        <h1 className={revealed ? "opening-title in" : "opening-title"}>{title}</h1>
        <div className={revealed && !isEmpty ? "flourish show" : "flourish"} aria-hidden="true" />
        <div className={`crack-egg${cracked ? " cracked" : ""}${isEmpty ? " is-empty" : ""}`}>
          {isEmpty ? (
            <>
              <div className="egg-hollow" />
              <div className="puff" aria-hidden="true">
                {PUFFS.map((puff) => (
                  <i
                    key={`${puff.x}-${puff.y}`}
                    style={{
                      ["--x" as string]: `${puff.x}px`,
                      ["--y" as string]: `${puff.y}px`,
                      ["--s" as string]: `${puff.s}px`,
                      animationDelay: puff.d,
                    }}
                  />
                ))}
                {FEATHERS.map((feather) => (
                  <b
                    key={`${feather.x}-${feather.y}`}
                    className="feather"
                    style={{
                      ["--x" as string]: `${feather.x}px`,
                      ["--y" as string]: `${feather.y}px`,
                      ["--r" as string]: feather.r,
                      animationDelay: feather.d,
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
          <div className="crack-piece t">
            <EggArt design={design} size={150} classicBand={!design} />
          </div>
          <div className="crack-piece b">
            <EggArt design={design} size={150} classicBand={!design} />
          </div>
        </div>
        {revealed && !isEmpty ? (
          <div className="spark-burst" aria-hidden="true">
            {SPARKS.map((spark) => (
              <i
                key={spark.id}
                className={spark.gem ? "spark gem" : "spark"}
                style={{
                  ["--x" as string]: `${spark.x}px`,
                  ["--y" as string]: `${spark.y}px`,
                  ["--s" as string]: `${spark.size}px`,
                  ["--c" as string]: spark.color,
                  ["--rot" as string]: spark.rot,
                  animationDelay: spark.delay,
                }}
              />
            ))}
          </div>
        ) : null}
        {isEmpty ? (
          <p className={revealed ? "sub empty-line show" : "sub empty-line"}>Keep hunting, more eggs nearby</p>
        ) : (
          <div className={revealed && claim ? "card prize-card show" : "card prize-card"}>
            {claim ? (
              <>
                <EggArt design={design} size={64} classicBand={!design} />
                <div className="big">{claim.rewardLabel}</div>
                <h2>{claim.rewardDetail}</h2>
                <p className="sub">
                  {claim.businessName}
                  <br />
                  {daysLeft(claim.expiresAt)}
                </p>
              </>
            ) : (
              <p className="sub">{error || "Cracking it open…"}</p>
            )}
          </div>
        )}
        {error && !ready ? <p className="sub">{error}</p> : null}
      </div>
      {emptyId || isEmpty ? (
        <button type="button" className="btn" onClick={() => router.push("/")}>
          Back to the map
        </button>
      ) : (
        <button type="button" className="btn" disabled={!claim} onClick={() => router.push("/wallet")}>
          Add to wallet
        </button>
      )}
    </div>
  );
}
