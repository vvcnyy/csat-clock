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
}

export function trackGoogleAnalyticsEvent(
  eventName: string,
  parameters: AnalyticsParameters = {},
) {
  if (!measurementId || !window.gtag) return;

  const definedParameters = Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => value !== undefined),
  );
  window.gtag("event", eventName, definedParameters);
}
