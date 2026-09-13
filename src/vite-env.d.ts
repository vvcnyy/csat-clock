/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_AUDIO_UNLOCK_SCOPE?: "apple" | "all";
  readonly VITE_AUDIO_DEBUG?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
