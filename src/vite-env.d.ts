/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_AUDIO_UNLOCK_SCOPE?: "apple" | "all";
  readonly VITE_AUDIO_DEBUG?: "true" | "false";
  readonly VITE_SOUND_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __DEPLOY_ENV__: string;
declare const __SOUND_HASHES__: Record<string, string>;
