import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSoundFiles } from "../scripts/sound-files.mjs";
import { readSyncConfig, syncSounds } from "../scripts/sync-sounds.mjs";

const config = {
  R2_SYNC_ENABLED: "true", R2_ACCOUNT_ID: "a".repeat(32), R2_BUCKET: "test",
  R2_ACCESS_KEY_ID: "test", R2_SECRET_ACCESS_KEY: "test",
  VITE_SOUND_BASE_URL: "https://audio.example.com/sound", R2_PREFIX: "sound",
};

test("R2 sync validates configuration and can be disabled without credentials", () => {
  assert.equal(readSyncConfig({}), null);
  assert.equal(readSyncConfig(config).prefix, "sound");
  assert.throws(() => readSyncConfig({ ...config, R2_BUCKET: "" }), /R2_BUCKET/);
  assert.throws(() => readSyncConfig({ ...config, VITE_SOUND_BASE_URL: "https://audio.example.com/other" }), /path matches/);
  assert.throws(() => readSyncConfig({ ...config, VITE_SOUND_BASE_URL: "http://audio.example.com/sound" }), /HTTPS/);
});

test("initial upload, no-op repeat and changed content retain previous objects", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "csat-audio-sync-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "bell.mp3"), "first audio fixture");
  writeFileSync(join(dir, "ignore.txt"), "ignored");
  const objects = new Map();
  const client = {
    async send(command) {
      const input = command.input;
      if (command.constructor.name === "HeadObjectCommand") {
        const value = objects.get(input.Key);
        if (!value) throw Object.assign(new Error("missing"), { name: "NotFound" });
        return { Metadata: value.Metadata, ContentLength: value.Body.length, ContentType: value.ContentType, CacheControl: value.CacheControl };
      }
      assert.equal(command.constructor.name, "PutObjectCommand");
      objects.set(input.Key, input);
      return {};
    },
  };
  const run = () => syncSounds({ client, bucket: "test", prefix: "sound", files: readSoundFiles(dir), log() {} });
  assert.deepEqual(await run(), { uploaded: 1, skipped: 0 });
  const oldKey = [...objects.keys()][0];
  assert.match(oldKey, /^sound\/[a-f0-9]{64}\/bell.mp3$/);
  assert.deepEqual(await run(), { uploaded: 0, skipped: 1 });
  writeFileSync(join(dir, "bell.mp3"), "changed audio fixture");
  assert.deepEqual(await run(), { uploaded: 1, skipped: 0 });
  assert.equal(objects.size, 2);
  assert(objects.has(oldKey));
});

test("R2 permission errors stop deployment without attempting uploads", async () => {
  let requests = 0;
  await assert.rejects(syncSounds({
    client: { async send() { requests++; throw Object.assign(new Error("denied"), { name: "AccessDenied" }); } },
    bucket: "test", prefix: "sound", files: [{ file: "bell.mp3", body: Buffer.from("a"), hash: "hash" }], log() {},
  }), /denied/);
  assert.equal(requests, 1);
});
