"use client";

import { EggArt } from "@/components/EggArt";
import {
  CLASSIC_EGG,
  EGG_EMOJIS,
  EGG_PALETTE,
  EGG_PATTERNS,
  EGG_PRESETS,
  clipBadgeText,
  sameDesign,
  type EggBadge,
  type EggDesign,
  type EggPattern,
} from "@/lib/egg-design";
import { logoFromFile } from "@/lib/logo-file";
import { toast } from "@/lib/client";

const PATTERN_LABEL: Record<EggPattern, string> = {
  solid: "Solid",
  stripes: "Stripes",
  zigzag: "Zigzag",
  polka: "Polka",
  spots: "Spots",
  gradient: "Gradient",
};

export function EggDesigner({ value, onChange }: { value: EggDesign | null; onChange: (next: EggDesign | null) => void }) {
  const shown = value ?? CLASSIC_EGG;
  const shineOn = value != null && shown.shine;

  function edit(next: EggDesign) {
    onChange(next);
  }

  function patch(partial: Partial<EggDesign> & { badge?: EggBadge }) {
    edit({
      baseColor: partial.baseColor ?? shown.baseColor,
      secondColor: partial.secondColor ?? shown.secondColor,
      pattern: partial.pattern ?? shown.pattern,
      shine: partial.shine ?? shown.shine,
      badge: partial.badge ?? shown.badge,
    });
  }

  async function onLogo(file: File | undefined, input: HTMLInputElement) {
    input.value = "";
    if (!file) return;
    try {
      const logo = await logoFromFile(file);
      patch({ badge: { kind: "logo", logo } });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not use that image.");
    }
  }

  return (
    <div className="designer">
      <div className="egg-stage">
        <div className="egg-bob">
          <EggArt design={value} size={132} classicBand={value == null} label="Egg preview" />
        </div>
      </div>
      <div className="chips" role="group" aria-label="Egg presets">
        <button type="button" className={value == null ? "on" : ""} aria-pressed={value == null} onClick={() => onChange(null)}>
          Plain
        </button>
        {EGG_PRESETS.map((preset) => {
          const on = value != null && sameDesign(value, preset.design);
          return (
            <button key={preset.id} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => onChange(preset.design)}>
              {preset.name}
            </button>
          );
        })}
      </div>
      <p className="hint">{value == null ? "Plain egg, until you pick colors or a preset." : "Preview updates as you tap."}</p>

      <Palette label="Base color" value={shown.baseColor} onPick={(hex) => patch({ baseColor: hex })} />
      <Palette label="Second color" value={shown.secondColor} onPick={(hex) => patch({ secondColor: hex })} />

      <p className="lbl">Pattern</p>
      <div className="choice-grid" role="group" aria-label="Pattern">
        {EGG_PATTERNS.map((pattern) => {
          const on = shown.pattern === pattern && value != null;
          return (
            <button key={pattern} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => patch({ pattern })}>
              {PATTERN_LABEL[pattern]}
            </button>
          );
        })}
      </div>

      <div className="shine-row">
        <b>Shine</b>
        <button type="button" className={shineOn ? "switch on" : "switch"} aria-pressed={shineOn} onClick={() => patch({ shine: !shineOn })}>
          {shineOn ? "On" : "Off"}
        </button>
      </div>

      <p className="lbl">Center badge</p>
      <div className="seg" role="group" aria-label="Badge">
        <button type="button" className={shown.badge.kind === "none" && value != null ? "on" : ""} onClick={() => patch({ badge: { kind: "none" } })}>
          None
        </button>
        <button
          type="button"
          className={shown.badge.kind === "emoji" && value != null ? "on" : ""}
          onClick={() => patch({ badge: { kind: "emoji", emoji: shown.badge.emoji || "☕" } })}
        >
          Emoji
        </button>
        <button
          type="button"
          className={shown.badge.kind === "text" && value != null ? "on" : ""}
          onClick={() => patch({ badge: { kind: "text", text: shown.badge.text || "CAFE" } })}
        >
          Text
        </button>
        <label className={shown.badge.kind === "logo" && value != null ? "on" : ""}>
          Logo
          <input
            className="file-input"
            type="file"
            accept="image/*"
            aria-label="Upload logo image"
            onChange={(event) => void onLogo(event.target.files?.[0], event.target)}
          />
        </label>
      </div>

      {value?.badge.kind === "emoji" ? (
        <div className="emoji-grid" role="group" aria-label="Emoji">
          {EGG_EMOJIS.map((emoji) => {
            const on = value.badge.emoji === emoji;
            return (
              <button key={emoji} type="button" className={on ? "on" : ""} aria-label={emoji} aria-pressed={on} onClick={() => patch({ badge: { kind: "emoji", emoji } })}>
                {emoji}
              </button>
            );
          })}
        </div>
      ) : null}

      {value?.badge.kind === "text" ? (
        <label className="badge-text">
          <span className="sr">Badge text</span>
          <input
            className="field"
            value={value.badge.text ?? ""}
            maxLength={8}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="CAFE"
            aria-label="Badge text, 8 characters max"
            onChange={(event) => patch({ badge: { kind: "text", text: clipBadgeText(event.target.value) } })}
          />
          <span className="hint">{Array.from(value.badge.text ?? "").length}/8</span>
        </label>
      ) : null}

      {value?.badge.kind === "logo" ? (
        <div className="logo-row">
          <label className="btn ghost slim file-label">
            Replace logo
            <input
              className="file-input"
              type="file"
              accept="image/*"
              aria-label="Replace logo image"
              onChange={(event) => void onLogo(event.target.files?.[0], event.target)}
            />
          </label>
          <button type="button" className="btn ghost slim" onClick={() => patch({ badge: { kind: "none" } })}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Palette({ label, value, onPick }: { label: string; value: string; onPick: (hex: string) => void }) {
  const current = value.toUpperCase();
  return (
    <>
      <p className="lbl">{label}</p>
      <div className="swatches" role="group" aria-label={label}>
        {EGG_PALETTE.map((hex) => {
          const on = current === hex;
          return (
            <button key={hex} type="button" className={on ? "on" : ""} style={{ background: hex }} aria-label={hex} aria-pressed={on} onClick={() => onPick(hex)} />
          );
        })}
        <label className="color-label">
          <span className="sr">Custom {label}</span>
          <input type="color" value={current.toLowerCase()} aria-label={`Custom ${label}`} onChange={(event) => onPick(event.target.value.toUpperCase())} />
        </label>
      </div>
    </>
  );
}
