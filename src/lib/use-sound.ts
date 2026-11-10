"use client";

import { useEffect } from "react";
import { playTap, unlockAudio } from "./sound";

const CONTROL = "button, a, [role='button'], input, select, summary, label";

function audibleControl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(CONTROL);
  if (!(control instanceof HTMLElement)) return null;
  if (control.closest("[data-sound='silent']")) return null;
  if (control.getAttribute("aria-disabled") === "true") return null;
  if (control instanceof HTMLButtonElement && control.disabled) return null;
  if (control instanceof HTMLInputElement && control.disabled) return null;
  if (control instanceof HTMLInputElement) {
    const type = control.type;
    if (type === "text" || type === "email" || type === "password" || type === "search" || type === "number" || type === "file" || type === "url") {
      return null;
    }
  }
  if (control instanceof HTMLLabelElement) {
    const field = control.querySelector("input, textarea, select");
    if (field instanceof HTMLInputElement) {
      const type = field.type;
      if (type !== "checkbox" && type !== "radio" && type !== "range" && type !== "color") return null;
    }
    if (field instanceof HTMLTextAreaElement) return null;
  }
  return control;
}

/**
 * One listener for the whole app. Buttons, tabs, links, and switches share
 * the tap; nothing in a screen imports its own audio element.
 */
export function useInterfaceSounds(): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      unlockAudio();
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!audibleControl(event.target)) return;
      playTap();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.repeat) return;
      const control = audibleControl(event.target);
      if (!control) return;
      if (control instanceof HTMLInputElement && (control.type === "range" || control.type === "color")) return;
      unlockAudio();
      playTap();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
}
