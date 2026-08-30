import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { env: Record<string, string | undefined> };

export default defineConfig(({ command }) => {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const buildVersion =
    command === "build"
      ? `build-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`
      : "local";

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(commitSha?.slice(0, 7) || buildVersion),
    },
  };
});
