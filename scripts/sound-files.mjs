import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function readSoundFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mp3"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const body = readFileSync(join(directory, entry.name));
      return { file: entry.name, body, hash: createHash("sha256").update(body).digest("hex") };
    });
}
