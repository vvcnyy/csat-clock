import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readSoundFiles } from "./sound-files.mjs";

export function readSyncConfig(env) {
  if (env.R2_SYNC_ENABLED !== "true") return null;
  for (const name of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "VITE_SOUND_BASE_URL"]) {
    if (!env[name]?.trim()) throw new Error(`Missing configuration: ${name}`);
  }
  const prefix = (env.R2_PREFIX || "sound").replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)) throw new Error("Invalid R2_PREFIX");
  const base = new URL(env.VITE_SOUND_BASE_URL.trim());
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash ||
      base.pathname.replace(/^\/+|\/+$/g, "") !== prefix) {
    throw new Error("VITE_SOUND_BASE_URL must be an HTTPS CDN URL whose path matches R2_PREFIX");
  }
  if (!/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID.trim())) throw new Error("Invalid R2_ACCOUNT_ID");
  return {
    bucket: env.R2_BUCKET.trim(), prefix,
    endpoint: `https://${env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID.trim(), secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim() },
  };
}

export async function syncSounds({ client, bucket, prefix, files, log = console.log }) {
  if (!files.length) throw new Error("No local MP3 files found");
  let uploaded = 0;
  let skipped = 0;
  for (const { file, body, hash } of files) {
    const Key = `${prefix}/${hash}/${file}`;
    let remote;
    try {
      remote = await client.send(new HeadObjectCommand({ Bucket: bucket, Key }), { abortSignal: AbortSignal.timeout(30_000) });
    } catch (error) {
      // Permission, network and bucket errors must not be mistaken for missing objects.
      if (error?.name !== "NotFound" && error?.name !== "NoSuchKey") throw error;
    }
    if (remote?.Metadata?.sha256 === hash && remote.ContentLength === body.length &&
        remote.ContentType === "audio/mpeg" && remote.CacheControl === "public, max-age=31536000, immutable") {
      skipped += 1;
      continue;
    }
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key, Body: body,
      ContentType: "audio/mpeg",
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: { sha256: hash },
    }), { abortSignal: AbortSignal.timeout(60_000) });
    uploaded += 1;
    log(`Uploaded ${file}`);
  }
  log(`Audio sync complete: ${uploaded} uploaded, ${skipped} unchanged`);
  return { uploaded, skipped };
}

async function main() {
  const config = readSyncConfig(process.env);
  if (!config) {
    console.log("Audio sync disabled; no R2 requests made");
    return;
  }
  const client = new S3Client({
    region: "auto", endpoint: config.endpoint, credentials: config.credentials,
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  try {
    await syncSounds({ ...config, client, files: readSoundFiles(fileURLToPath(new URL("../public/sound", import.meta.url))) });
  } finally {
    client.destroy();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Avoid dumping SDK request details or credentials into deployment logs.
    console.error(`Audio sync failed (${error?.name || "Error"}). Check R2 configuration, bucket and permissions.`);
    process.exitCode = 1;
  });
}
