"use client";

import { useId } from "react";
import type { EggDesign } from "@/lib/egg-design";
import { eggMarkup } from "@/lib/egg-svg";

export function EggArt({
  design,
  size = 120,
  classicBand = false,
  detail = "full",
  label,
}: {
  design: EggDesign | null;
  size?: number;
  classicBand?: boolean;
  detail?: "full" | "mini";
  label?: string;
}) {
  const id = useId().replace(/[^A-Za-z0-9]/g, "");
  const html = eggMarkup(design, { id, classicBand, detail, label });
  return (
    <span
      className="egg-art"
      style={{ width: size, height: Math.round(size * 1.24) }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
