"use client";

import { useEffect, useState } from "react";
import { EggDesigner } from "@/components/EggDesigner";
import { api, toast } from "@/lib/client";
import { parseEggDesign, type EggDesign } from "@/lib/egg-design";

export default function DesignPage() {
  const [design, setDesign] = useState<EggDesign | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ design: EggDesign | null }>("/api/design")
      .then((data) => {
        setDesign(data.design);
        setLoaded(true);
      })
      .catch((err: Error) => toast(err.message));
  }, []);

  async function save() {
    if (design) {
      try {
        parseEggDesign(design);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Check the egg design.");
        return;
      }
    }
    setBusy(true);
    try {
      const data = await api<{ design: EggDesign | null }>("/api/design", {
        method: "PUT",
        body: JSON.stringify({ design }),
      });
      setDesign(data.design);
      toast(data.design ? "Egg design saved." : "Players will see the plain egg.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the egg.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen design-screen">
      <div className="design-scroll">
        <h1>Design your egg</h1>
        <p className="sub">Players see this egg in the hunt, on the map, and in their wallet.</p>
        {loaded ? <EggDesigner value={design} onChange={setDesign} /> : <p className="sub">Loading your egg…</p>}
        <button type="button" className="btn" onClick={() => void save()} disabled={!loaded || busy}>
          {busy ? "Saving…" : "Save design"}
        </button>
      </div>
    </div>
  );
}
