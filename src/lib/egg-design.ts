import { StoreError } from "./errors";

export const EGG_PATTERNS = ["solid", "stripes", "zigzag", "polka", "spots", "gradient"] as const;
export type EggPattern = (typeof EGG_PATTERNS)[number];

export const EGG_BADGE_KINDS = ["none", "emoji", "text", "logo"] as const;
export type EggBadgeKind = (typeof EGG_BADGE_KINDS)[number];

export interface EggBadge {
  kind: EggBadgeKind;
  emoji?: string;
  text?: string;
  logo?: string;
}

/** Colors, pattern, and center badge painted on a business's eggs. */
export interface EggDesign {
  baseColor: string;
  secondColor: string;
  pattern: EggPattern;
  shine: boolean;
  badge: EggBadge;
}

export const MAX_BADGE_TEXT = 8;
export const MAX_LOGO_BYTES = 200 * 1024;
const LOGO_PREFIX = "data:image/png;base64,";
const PNG_MAGIC = "iVBORw0KGgo";

export const EGG_PALETTE = [
  "#C9A96E",
  "#F5F1E8",
  "#E8C4B8",
  "#8C7348",
  "#1C1C1E",
  "#0E3B32",
  "#1F6B4A",
  "#0E2744",
  "#3D5A80",
  "#6B2D3C",
  "#A89880",
  "#F7F4EF",
] as const;

export const EGG_EMOJIS = ["☕", "🥐", "🍪", "🌿", "🌸", "⭐", "🎁", "💛", "🍓", "🍋", "🍞", "🐝", "🍀", "💎", "🐣", "🔥", "🍦", "🧀"] as const;

export const CLASSIC_EGG: EggDesign = {
  baseColor: "#F5F1E8",
  secondColor: "#C9A96E",
  pattern: "gradient",
  shine: true,
  badge: { kind: "none" },
};

export const CAFE_EGG: EggDesign = {
  baseColor: "#F5F1E8",
  secondColor: "#C9A96E",
  pattern: "stripes",
  shine: true,
  badge: { kind: "text", text: "CAFE" },
};

export const GARDEN_EGG: EggDesign = {
  baseColor: "#0E3B32",
  secondColor: "#C9A96E",
  pattern: "polka",
  shine: true,
  badge: { kind: "text", text: "LEAF" },
};

export const EGG_PRESETS: { id: string; name: string; design: EggDesign }[] = [
  { id: "pearl", name: "Pearl", design: CLASSIC_EGG },
  { id: "cafe", name: "Cafe", design: CAFE_EGG },
  { id: "emerald", name: "Emerald", design: GARDEN_EGG },
  {
    id: "onyx",
    name: "Onyx",
    design: {
      baseColor: "#1C1C1E",
      secondColor: "#C9A96E",
      pattern: "gradient",
      shine: true,
      badge: { kind: "text", text: "ONYX" },
    },
  },
  {
    id: "sapphire",
    name: "Sapphire",
    design: {
      baseColor: "#0E2744",
      secondColor: "#C9A96E",
      pattern: "gradient",
      shine: true,
      badge: { kind: "text", text: "VIP" },
    },
  },
  {
    id: "rose",
    name: "Rose",
    design: {
      baseColor: "#E8C4B8",
      secondColor: "#6B2D3C",
      pattern: "spots",
      shine: true,
      badge: { kind: "none" },
    },
  },
];

export function clipBadgeText(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, MAX_BADGE_TEXT).join("");
}

export function sameDesign(a: EggDesign | null, b: EggDesign | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Campaign override wins. Null on both sides is the plain EggDrop egg. */
export function resolveEggDesign(businessDesign: EggDesign | null, campaignDesign: EggDesign | null): EggDesign | null {
  return campaignDesign ?? businessDesign;
}

export function isPngLogo(value: string): boolean {
  if (!value.startsWith(LOGO_PREFIX)) return false;
  const maxChars = Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 4;
  if (value.length > LOGO_PREFIX.length + maxChars) return false;
  const b64 = value.slice(LOGO_PREFIX.length);
  if (!b64.startsWith(PNG_MAGIC)) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((b64.length * 3) / 4) - pad;
  return bytes > 32 && bytes <= MAX_LOGO_BYTES;
}

export function coerceEggDesign(value: unknown): EggDesign | null {
  if (value == null || value === "") return null;
  try {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    return parseEggDesign(parsed);
  } catch {
    return null;
  }
}

export function parseEggDesign(input: unknown): EggDesign {
  if (!input || typeof input !== "object") {
    throw new StoreError("bad_design", 400, "Egg design is missing.");
  }
  const raw = input as Record<string, unknown>;
  const pattern = raw.pattern;
  if (typeof pattern !== "string" || !EGG_PATTERNS.includes(pattern as EggPattern)) {
    throw new StoreError("bad_design", 400, "Pick a pattern.");
  }
  if (typeof raw.shine !== "boolean") {
    throw new StoreError("bad_design", 400, "Shine needs to be on or off.");
  }
  return {
    baseColor: normalizeHex(raw.baseColor, "Base color"),
    secondColor: normalizeHex(raw.secondColor, "Second color"),
    pattern: pattern as EggPattern,
    shine: raw.shine,
    badge: parseBadge(raw.badge),
  };
}

function normalizeHex(value: unknown, label: string): string {
  if (typeof value !== "string") throw new StoreError("bad_design", 400, `${label} needs a hex color like #FFC93C.`);
  const hex = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) {
    throw new StoreError("bad_design", 400, `${label} needs a hex color like #FFC93C.`);
  }
  return hex;
}

function parseBadge(input: unknown): EggBadge {
  if (!input || typeof input !== "object") throw new StoreError("bad_design", 400, "Pick a badge.");
  const raw = input as Record<string, unknown>;
  if (raw.kind === "none") return { kind: "none" };
  if (raw.kind === "emoji") {
    const emoji = cleanEmoji(raw.emoji);
    if (!emoji) throw new StoreError("bad_design", 400, "Pick an emoji for the badge.");
    return { kind: "emoji", emoji };
  }
  if (raw.kind === "text") {
    if (typeof raw.text !== "string") throw new StoreError("bad_design", 400, "Add badge text, up to 8 characters.");
    const text = clipBadgeText(raw.text);
    if (Array.from(text).length < 1) throw new StoreError("bad_design", 400, "Add badge text, up to 8 characters.");
    return { kind: "text", text };
  }
  if (raw.kind === "logo") {
    if (typeof raw.logo !== "string" || !isPngLogo(raw.logo)) {
      throw new StoreError("bad_design", 400, "Logo must be a PNG under 200KB.");
    }
    return { kind: "logo", logo: raw.logo };
  }
  throw new StoreError("bad_design", 400, "Pick a badge.");
}

function cleanEmoji(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const chars = Array.from(trimmed);
  if (chars.length < 1 || chars.length > 16) return "";
  if (/[<>&"'`]/.test(trimmed)) return "";
  return trimmed;
}
