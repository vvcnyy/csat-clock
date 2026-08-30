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

export function initializeGoogleAnalytics() {
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;
  if (document.querySelector("script[data-google-analytics]")) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args) => window.dataLayer.push(args);

  const script = document.createElement("script");
  script.async = true;
  script.dataset.googleAnalytics = measurementId;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    page_title: document.title,
    page_location: window.location.href,
  });
}
