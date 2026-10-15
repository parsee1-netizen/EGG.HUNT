"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, toast } from "@/lib/client";
import type { Claim } from "@/lib/types";

export default function QrPage() {
  const params = useParams<{ claimId: string }>();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [claim, setClaim] = useState<Claim | null>(null);

  useEffect(() => {
    api<{ claim: Claim }>(`/api/claims/${params.claimId}`)
      .then((data) => setClaim(data.claim))
      .catch((err: Error) => toast(err.message));
  }, [params.claimId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !claim) return;
    QRCode.toCanvas(canvas, claim.token, {
      width: 240,
      margin: 1,
      color: { dark: "#2B2118", light: "#ffffff" },
    }).catch(() => toast("Could not draw the QR code."));
  }, [claim]);

  return (
    <div className="screen">
      <h1>{claim?.rewardTitle ?? "Reward"}</h1>
      <p className="sub">{claim?.businessName ?? "Loading…"}</p>
      {claim?.status === "redeemed" ? (
        <div className="note bad">
          <b>Already redeemed</b>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            This code was used and cannot be scanned again.
          </p>
        </div>
      ) : null}
      <div className="card" style={{ textAlign: "center" }}>
        <canvas ref={canvasRef} width={240} height={240} />
        <div className="tag">{claim?.code ?? "····"}</div>
        <p className="sub" style={{ margin: "10px 0 0" }}>
          Show this at the counter. The cafe scans it once.
        </p>
      </div>
      <button type="button" className="btn ghost" onClick={() => router.push("/wallet")}>
        Back
      </button>
    </div>
  );
}
