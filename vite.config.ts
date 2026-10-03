import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readSoundFiles } from "./scripts/sound-files.mjs";

declare const process: { env: Record<string, string | undefined> };

export default defineConfig(({ command }) => {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const deployEnvironment = process.env.DEPLOY_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim() || (command === "build" ? "production" : "development");
  const buildVersion =
    command === "build"
      ? `build-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`
      : "local";

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(commitSha?.slice(0, 7) || buildVersion),
      __DEPLOY_ENV__: JSON.stringify(deployEnvironment),
      __SOUND_HASHES__: JSON.stringify(Object.fromEntries(
        readSoundFiles(fileURLToPath(new URL("./public/sound", import.meta.url)))
          .map(({ file, hash }) => [file, hash]),
      )),
    },
  };
});
