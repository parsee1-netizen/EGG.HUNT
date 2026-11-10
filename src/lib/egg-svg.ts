import { isPngLogo, type EggDesign } from "./egg-design";

const EGG_PATH = "M50 5C76 5 94 28 95 54C96 86 76 118 50 119C24 118 4 86 5 54C6 28 24 5 50 5Z";

export interface EggMarkupOptions {
  id: string;
  /** Pink-and-white band from the original hunt egg. Only for the plain egg. */
  classicBand?: boolean;
  detail?: "full" | "mini";
  label?: string;
}

/** Shared egg drawing for the designer, the hunt, map pins, and the wallet. */
export function eggMarkup(design: EggDesign | null, options: EggMarkupOptions): string {
  const id = safeId(options.id);
  const detail = options.detail ?? "full";
  const label = options.label ? xml(options.label) : "";
  const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
  const defs: string[] = [
    `<clipPath id="${id}-shell"><path d="${EGG_PATH}"/></clipPath>`,
    `<linearGradient id="${id}-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.16"/></linearGradient>`,
  ];
  let fill = "#C9A96E";
  if (!design) {
    defs.push(
      `<radialGradient id="${id}-fill" cx="35%" cy="28%" r="78%"><stop offset="0" stop-color="#f5f1e8"/><stop offset="0.55" stop-color="#e7d7b8"/><stop offset="1" stop-color="#c9a96e"/></radialGradient>`,
    );
    fill = `url(#${id}-fill)`;
  } else {
    const painted = patternDef(id, design, detail);
    if (painted.defs) defs.push(painted.defs);
    fill = painted.fill;
  }

  const band =
    !design && options.classicBand
      ? `<pattern id="${id}-band" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="7" height="14" fill="#f5f1e8"/><rect x="7" width="7" height="14" fill="#c9a96e"/></pattern><rect x="0" y="54" width="100" height="12" fill="url(#${id}-band)"/>`
      : "";
  const shine =
    design?.shine && detail === "full"
      ? `<ellipse cx="36" cy="40" rx="13" ry="18" fill="#ffffff" opacity="0.5"/><g class="glitter" fill="#ffffff"><path d="M72 28l1.3 3.4 3.4 1.3-3.4 1.3-1.3 3.4-1.3-3.4-3.4-1.3 3.4-1.3z"/><path d="M22 64l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z"/><circle cx="64" cy="78" r="1.2"/><circle cx="80" cy="52" r="0.9"/></g>`
      : "";
  const shade = detail === "mini" ? "" : `<rect width="100" height="124" fill="url(#${id}-shade)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 124" width="100%" height="100%" ${a11y}><defs>${defs.join("")}</defs><g clip-path="url(#${id}-shell)"><rect width="100" height="124" fill="${fill}"/>${band}${shade}${shine}${design ? badgeMarkup(design, id, detail) : ""}</g><path d="${EGG_PATH}" fill="none" stroke="#2b211833" stroke-width="2.5"/></svg>`;
}

function patternDef(id: string, design: EggDesign, detail: "full" | "mini"): { defs: string; fill: string } {
  const base = design.baseColor;
  const second = design.secondColor;
  const mini = detail === "mini";
  if (design.pattern === "solid") return { defs: "", fill: base };
  if (design.pattern === "gradient") {
    return {
      defs: `<linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="${second}"/></linearGradient>`,
      fill: `url(#${id}-fill)`,
    };
  }
  if (design.pattern === "stripes") {
    const w = mini ? 34 : 16;
    return {
      defs: `<pattern id="${id}-fill" width="${w}" height="${w}" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><rect width="${w}" height="${w}" fill="${base}"/><rect width="${w / 2}" height="${w}" fill="${second}"/></pattern>`,
      fill: `url(#${id}-fill)`,
    };
  }
  if (design.pattern === "zigzag") {
    const tile = mini
      ? `<pattern id="${id}-fill" width="50" height="28" patternUnits="userSpaceOnUse"><rect width="50" height="28" fill="${base}"/><polyline points="0,20 12,6 25,20 38,6 50,20" fill="none" stroke="${second}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/></pattern>`
      : `<pattern id="${id}-fill" width="20" height="14" patternUnits="userSpaceOnUse"><rect width="20" height="14" fill="${base}"/><polyline points="0,10 5,4 10,10 15,4 20,10" fill="none" stroke="${second}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></pattern>`;
    return { defs: tile, fill: `url(#${id}-fill)` };
  }
  if (design.pattern === "polka") {
    const tile = mini
      ? `<pattern id="${id}-fill" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="${base}"/><circle cx="10" cy="10" r="6" fill="${second}"/><circle cx="24" cy="24" r="6" fill="${second}"/></pattern>`
      : `<pattern id="${id}-fill" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="${base}"/><circle cx="5" cy="5" r="3.1" fill="${second}"/><circle cx="14" cy="14" r="3.1" fill="${second}"/></pattern>`;
    return { defs: tile, fill: `url(#${id}-fill)` };
  }
  return {
    defs: `<pattern id="${id}-fill" width="42" height="36" patternUnits="userSpaceOnUse"><rect width="42" height="36" fill="${base}"/><ellipse cx="12" cy="14" rx="8" ry="6" fill="${second}"/><ellipse cx="31" cy="26" rx="6.5" ry="5" fill="${second}" opacity="0.88"/><ellipse cx="30" cy="8" rx="3.4" ry="2.8" fill="${second}" opacity="0.72"/></pattern>`,
    fill: `url(#${id}-fill)`,
  };
}

function badgeMarkup(design: EggDesign, id: string, detail: "full" | "mini"): string {
  const badge = design.badge;
  if (badge.kind === "none") return "";
  if (badge.kind === "emoji" && badge.emoji) {
    const size = detail === "mini" ? 22 : 26;
    const r = detail === "mini" ? 13 : 16;
    return plate(r) + textEl(50, 71, size, "#2B2118", "400", xml(badge.emoji));
  }
  if (badge.kind === "text" && badge.text) {
    const len = Array.from(badge.text).length;
    const font = detail === "mini" ? (len > 4 ? 9 : 12) : len > 6 ? 11 : len > 3 ? 14 : 18;
    const rx = detail === "mini" ? 26 : len > 6 ? 36 : len > 3 ? 32 : 24;
    const ry = detail === "mini" ? 13 : 15;
    return `<ellipse cx="50" cy="70" rx="${rx}" ry="${ry}" fill="#fff8e7" stroke="#2b211826" stroke-width="1"/>${textEl(50, 71, font, "#2B2118", "800", xml(badge.text))}`;
  }
  if (badge.kind === "logo" && badge.logo && isPngLogo(badge.logo)) {
    const r = detail === "mini" ? 12 : 16;
    return `<clipPath id="${id}-logo"><circle cx="50" cy="70" r="${r}"/></clipPath>${plate(r)}<image href="${badge.logo}" xlink:href="${badge.logo}" x="${50 - r}" y="${70 - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id}-logo)" preserveAspectRatio="xMidYMid slice"/>`;
  }
  return "";
}

function plate(r: number): string {
  return `<circle cx="50" cy="70" r="${r}" fill="#fff8e7" stroke="#2b211826" stroke-width="1"/>`;
}

function textEl(x: number, y: number, size: number, fill: string, weight: string, value: string): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="system-ui,Apple Color Emoji,Segoe UI Emoji,sans-serif">${value}</text>`;
}

function safeId(id: string): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "");
  return clean.length > 0 ? clean : "egg";
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}
