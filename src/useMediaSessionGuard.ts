import { useEffect } from "react";

const blockedActions: MediaSessionAction[] = [
  "play",
  "pause",
  "stop",
  "seekbackward",
  "seekforward",
  "seekto",
  "previoustrack",
  "nexttrack",
];

export function useMediaSessionGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("mediaSession" in navigator)) return;

    for (const action of blockedActions) {
      try {
        navigator.mediaSession.setActionHandler(action, () => undefined);
      } catch {
      }
    }

    return () => {
      for (const action of blockedActions) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
        }
      }
    };
  }, [enabled]);
}
