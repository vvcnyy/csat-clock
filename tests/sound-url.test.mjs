import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("sound URLs use the same encoded filename for local and CDN sources", async () => {
  const source = readFileSync(new URL("../src/sound-url.ts", import.meta.url), "utf8");
  for (const [base, expected] of [
    [undefined, "/sound"],
    ["", "/sound"],
    ["/sound/", "/sound"],
    [" https://audio.example.com/v1/ ", "https://audio.example.com/v1"],
  ]) {
    const compiled = ts.transpileModule(
      source.replace("import.meta.env.VITE_SOUND_BASE_URL", JSON.stringify(base) ?? "undefined")
        .replaceAll("__SOUND_HASHES__", '( {"005_korean_start.mp3":"testhash", "종료 령.mp3":"secondhash"} )'),
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } },
    ).outputText;
    const { getSoundUrl } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
    const remote = expected.startsWith("https:");
    assert.equal(getSoundUrl("005_korean_start.mp3"), `${expected}/${remote ? "testhash/" : ""}005_korean_start.mp3`);
    assert.equal(getSoundUrl("종료 령.mp3"), `${expected}/${remote ? "secondhash/" : ""}${encodeURIComponent("종료 령.mp3")}`);
  }
});
