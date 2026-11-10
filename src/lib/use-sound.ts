"use client";

import { useCallback, useEffect, useState } from "react";
import { readSoundEnabled, setSoundEnabled, subscribeSound } from "@/lib/sound";

export function useSound() {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    setEnabledState(readSoundEnabled());
    return subscribeSound(setEnabledState);
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setSoundEnabled(on);
  }, []);

  return { enabled, setEnabled };
}
