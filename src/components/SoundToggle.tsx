"use client";

import { useSound } from "@/lib/use-sound";

export default function SoundToggle({ className = "" }: { className?: string }) {
  const { enabled, setEnabled } = useSound();
  const label = enabled ? "Sound on" : "Sound off";
  const classes = ["sound-toggle", enabled ? "on" : "", className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      onClick={() => setEnabled(!enabled)}
    >
      <SpeakerIcon muted={!enabled} />
    </button>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M4 9.25h3.15L11.75 5v14l-4.6-4.25H4z" />
      {muted ? (
        <path
          d="M15.2 9.4 20 14.2M20 9.4l-4.8 4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M15.3 8.7a4 4 0 0 1 0 6.6M17.5 6.5a7 7 0 0 1 0 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
