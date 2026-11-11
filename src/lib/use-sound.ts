"use client";

import { useEffect } from "react";
import { playTap, unlockAudio } from "./sound";

/** One selector for every tappable control, including Next.js links. */
export const TAP_SELECTOR =
  "a, button, [role='button'], [role='tab'], [role='menuitem'], input, label, select, [data-sound]";

const installed = new WeakSet<Document>();

function asElement(target: EventTarget | null): Element | null {
  if (target && typeof (target as Element).closest === "function") return target as Element;
  const parent = (target as Node | null)?.parentElement;
  if (parent && typeof parent.closest === "function") return parent;
  return null;
}

function isSilent(el: Element): boolean {
  const flag = el.getAttribute("data-sound");
  return flag === "silent" || flag === "off";
}

function isDisabled(el: Element): boolean {
  if (el.getAttribute("aria-disabled") === "true") return true;
  return (el as HTMLButtonElement).disabled === true;
}

/** The control a tap should sound for, or null when the tap is not a control. */
export function audibleControl(target: EventTarget | null): Element | null {
  const el = asElement(target);
  if (!el) return null;
  const control = el.closest(TAP_SELECTOR);
  if (!control) return null;
  if (isSilent(control) || control.closest("[data-sound='silent'], [data-sound='off']")) return null;
  if (isDisabled(control)) return null;
  return control;
}

let lastControl: EventTarget | null = null;
let lastAt = 0;

function sameGesture(control: EventTarget): boolean {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (control === lastControl && now - lastAt < 50) return true;
  lastControl = control;
  lastAt = now;
  return false;
}

function onGesture(event: Event): void {
  // Resume on every touch, including ones that are not controls. iOS suspends
  // the context again after a route change, and only a fresh gesture may resume it.
  unlockAudio();
  if (event.type === "pointerdown") {
    const pointer = event as PointerEvent;
    if (pointer.pointerType === "mouse" && pointer.button !== 0) return;
  }
  const control = audibleControl(event.target);
  if (!control || sameGesture(control)) return;
  playTap();
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.repeat) return;
  const control = audibleControl(event.target);
  if (!control || sameGesture(control)) return;
  unlockAudio();
  playTap();
}

/**
 * Document-level listener. pointerdown fires before a Next.js <Link> navigates;
 * touchstart is the iOS user-gesture that is allowed to resume audio.
 * Both events arrive for one tap, so the second is ignored.
 * The listener is not removed on unmount — the shell stays mounted, and
 * tearing it down between routes would drop the next menu tap.
 */
export function installInterfaceSounds(doc: Document = document): void {
  if (installed.has(doc)) return;
  installed.add(doc);
  doc.addEventListener("pointerdown", onGesture, true);
  doc.addEventListener("touchstart", onGesture, { capture: true, passive: true });
  doc.addEventListener("keydown", onKeyDown, true);
}

export function useInterfaceSounds(): void {
  useEffect(() => {
    installInterfaceSounds();
  }, []);
}
