"use client";

import type { CSSProperties } from "react";
import { daysLeft } from "@/lib/format";
import type { Claim } from "@/lib/types";

type SparkKind = "diamond" | "dot" | "foil";

interface Spark {
  dx: number;
  dy: number;
  delay: number;
  duration: number;
  size: number;
  kind: SparkKind;
  ivory: boolean;
  rot: number;
}

const KINDS: SparkKind[] = ["diamond", "dot", "foil"];

/** Fixed burst so the reveal does not jump between visits. */
const SPARKS: Spark[] = Array.from({ length: 34 }, (_, i) => {
  const angle = ((i * 137.508) * Math.PI) / 180;
  const dist = 46 + (i % 7) * 18;
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist * 0.62 + 6),
    delay: (i % 10) * 0.055,
    duration: 2.7 + (i % 6) * 0.26,
    size: 5 + (i % 4) * 2,
    kind: KINDS[i % 3] ?? "dot",
    ivory: i % 3 === 0,
    rot: (i * 53) % 360,
  };
});

export default function Celebration({ claim }: { claim: Claim }) {
  return (
    <div className="celebration">
      <div className="spark-field" aria-hidden="true">
        {SPARKS.map((spark, index) => (
          <span
            key={index}
            className={`spark ${spark.kind}${spark.ivory ? " ivory" : ""}`}
            style={
              {
                "--dx": `${spark.dx}px`,
                "--dy": `${spark.dy}px`,
                "--delay": `${spark.delay}s`,
                "--dur": `${spark.duration}s`,
                "--size": `${spark.size}px`,
                "--rot": `${spark.rot}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p className="eyebrow">You caught an egg</p>
      <h1 className="congrats">Congratulations</h1>
      <div className="prize-card card">
        <div className="big">{claim.rewardLabel}</div>
        <h2>{claim.rewardDetail}</h2>
        <p className="sub">
          {claim.businessName}
          <br />
          {daysLeft(claim.expiresAt)}
        </p>
      </div>
    </div>
  );
}
