"use client";

import { useEffect, useState } from "react";
import { playTap, setSoundEnabled, soundEnabled } from "@/lib/sound";

export default function SoundToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(soundEnabled());
  }, []);

  return (
    <button
      type="button"
      className={on ? `sound-toggle on ${className}`.trim() : `sound-toggle ${className}`.trim()}
      aria-pressed={on}
      aria-label={on ? "Sound on" : "Sound off"}
      data-sound="silent"
      onClick={() => {
        const next = !soundEnabled();
        setSoundEnabled(next);
        setOn(next);
        if (next) playTap();
      }}
    >
      <SpeakerIcon muted={!on} />
    </button>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 10v4h3.2L12 18.2V5.8L7.2 10H4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path
          d="M15.5 9.2a3.4 3.4 0 0 1 0 5.6M17.8 7a6 6 0 0 1 0 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
