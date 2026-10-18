"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { attachRearCamera, cameraPreflight, classifyCameraError, type CameraPhase } from "@/lib/camera";

export function useRearCamera(videoRef: RefObject<HTMLVideoElement | null>) {
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);

  const stop = useCallback(() => {
    generation.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, [videoRef]);

  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    const video = videoRef.current;
    const blocked = cameraPreflight(window.isSecureContext, Boolean(navigator.mediaDevices?.getUserMedia));
    if (!video || blocked) {
      if (blocked) setPhase(blocked);
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const token = ++generation.current;
    setPhase("starting");
    void attachRearCamera(video)
      .then((stream) => {
        if (generation.current !== token) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setPhase("live");
      })
      .catch((err: unknown) => {
        if (generation.current !== token) return;
        setPhase(classifyCameraError(err, window.isSecureContext));
      });
  }, [videoRef]);

  return { phase, start, stop };
}
