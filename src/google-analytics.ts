type GtagCommand = "config" | "event" | "js";

type Gtag = (
  command: GtagCommand,
  targetOrDate: string | Date,
  parameters?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: Gtag;
  }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const appVersion = __APP_VERSION__;

interface NetworkInformationLike {
  effectiveType?: string;
}

const networkDetails = () => ({
  connection_type:
    (navigator as Navigator & { connection?: NetworkInformationLike }).connection
      ?.effectiveType ?? "unknown",
  online: navigator.onLine,
});

export type AnalyticsParameters = Record<
  string,
  string | number | boolean | undefined
>;

export function initializeGoogleAnalytics() {
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;
  if (document.querySelector("script[data-google-analytics]")) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  } as Gtag;

  const script = document.createElement("script");
  script.async = true;
  script.dataset.googleAnalytics = measurementId;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: true,
    page_title: document.title,
    page_location: window.location.href,
  });

  trackGoogleAnalyticsEvent("capability_check", {
    wake_lock_supported: "wakeLock" in navigator,
    fullscreen_supported: Boolean(document.documentElement.requestFullscreen),
    indexeddb_supported: "indexedDB" in window,
    mp3_support:
      document.createElement("audio").canPlayType("audio/mpeg") || "no",
    ...networkDetails(),
  });

  const handleNetworkChange = () =>
    trackGoogleAnalyticsEvent("network_status_change", networkDetails());
  window.addEventListener("online", handleNetworkChange);
  window.addEventListener("offline", handleNetworkChange);
  initializeWebVitals();
}

export function trackGoogleAnalyticsEvent(
  eventName: string,
  parameters: AnalyticsParameters = {},
) {
  if (!measurementId || !window.gtag) return;

  const definedParameters: Record<string, string | number | boolean> = {};
  const allParameters = {
    app_version: appVersion,
    ...networkDetails(),
    ...parameters,
  };
  for (const key of Object.keys(allParameters)) {
    const value = allParameters[key as keyof typeof allParameters];
    if (value !== undefined) definedParameters[key] = value;
  }
  window.gtag("event", eventName, definedParameters);
}

function initializeWebVitals() {
  if (!("PerformanceObserver" in window)) return;

  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  let cls = 0;
  let lcp = 0;
  let inp = 0;
  let sent = false;
  const observers: PerformanceObserver[] = [];

  const observe = (
    type: string,
    callback: PerformanceObserverCallback,
    options: PerformanceObserverInit = { type, buffered: true },
  ) => {
    if (!supported.includes(type)) return;
    try {
      const observer = new PerformanceObserver(callback);
      observer.observe(options);
      observers.push(observer);
    } catch {
      // 일부 구형 브라우저는 supportedEntryTypes와 실제 구현이 다르다.
    }
  };

  observe("largest-contentful-paint", (list) => {
    const entries = list.getEntries();
    const entry = entries[entries.length - 1];
    if (entry) lcp = entry.startTime;
  });
  observe("layout-shift", (list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & {
        value?: number;
        hadRecentInput?: boolean;
      };
      if (!shift.hadRecentInput) cls += shift.value ?? 0;
    }
  });
  observe(
    "event",
    (list) => {
      for (const entry of list.getEntries()) inp = Math.max(inp, entry.duration);
    },
    { type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit,
  );

  const send = () => {
    if (sent) return;
    sent = true;
    if (lcp) {
      trackGoogleAnalyticsEvent("web_vital", {
        metric_name: "LCP",
        metric_value: Math.round(lcp),
      });
    }
    trackGoogleAnalyticsEvent("web_vital", {
      metric_name: "CLS",
      metric_value: Math.round(cls * 1000) / 1000,
    });
    if (inp) {
      trackGoogleAnalyticsEvent("web_vital", {
        metric_name: "INP",
        metric_value: Math.round(inp),
      });
    }
    for (const observer of observers) observer.disconnect();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
  }, { once: true });
  window.addEventListener("pagehide", send, { once: true });
}
