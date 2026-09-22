import { useCallback, useEffect, useRef, useState } from "react";
import { trackGoogleAnalyticsEvent } from "./google-analytics";

export type WakeLockStatus = "inactive" | "active" | "unsupported" | "failed";

export function useWakeLock(enabled: boolean) {
  const supported = "wakeLock" in navigator;
  const sentinel = useRef<WakeLockSentinel | undefined>(undefined);
  const unsupportedReported = useRef(false);
  const [status, setStatus] = useState<WakeLockStatus>(
    supported ? "inactive" : "unsupported",
  );

  const request = useCallback(async () => {
    if (!enabled || document.visibilityState !== "visible") return;
    const wakeLock = navigator.wakeLock;
    if (!wakeLock) {
      setStatus("unsupported");
      if (!unsupportedReported.current) {
        unsupportedReported.current = true;
        trackGoogleAnalyticsEvent("wake_lock_unsupported");
      }
      return;
    }
    if (sentinel.current && !sentinel.current.released) {
      setStatus("active");
      return;
    }
    try {
      const next = await wakeLock.request("screen");
      sentinel.current = next;
      setStatus("active");
      trackGoogleAnalyticsEvent("wake_lock_success");
      next.addEventListener("release", () => {
        if (sentinel.current === next) {
          sentinel.current = undefined;
          setStatus(enabled ? "inactive" : "inactive");
          trackGoogleAnalyticsEvent("wake_lock_released");
        }
      });
    } catch (error) {
      setStatus("failed");
      trackGoogleAnalyticsEvent("wake_lock_failed", {
        error_name: error instanceof Error ? error.name : "unknown",
      });
    }
  }, [enabled]);

  useEffect(() => {
    if (!supported && !unsupportedReported.current) {
      unsupportedReported.current = true;
      trackGoogleAnalyticsEvent("wake_lock_unsupported");
    }
    if (!enabled) {
      const current = sentinel.current;
      sentinel.current = undefined;
      if (current && !current.released) void current.release();
      setStatus(supported ? "inactive" : "unsupported");
      return;
    }

    void request();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, request, supported]);

  useEffect(
    () => () => {
      const current = sentinel.current;
      sentinel.current = undefined;
      if (current && !current.released) void current.release();
    },
    [],
  );

  return { status, request };
}
