import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/audio-lifecycle.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { unloadAudio, createPlaybackLifetime } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function fakeAudio() {
  return {
    src: "previous-end.mp3", muted: false, volume: 0.8,
    onplaying() {}, onended() {}, onerror() {}, onloadedmetadata() {},
    pause() { this.paused = true; },
    removeAttribute(name) { if (name === "src") this.src = null; },
    getAttribute(name) { return name === "src" ? this.src : null; },
    load() {
      assert.equal(this.src, null, "detach before flushing the pipeline");
      assert.equal(this.muted, true);
      assert.equal(this.onended, null);
      assert.equal(this.onerror, null);
      this.loaded = true;
    },
  };
}

test("ending an exam leaves no previous source to seek/replay during countdown", () => {
  const audio = fakeAudio();
  unloadAudio(audio);
  assert.equal(audio.src, null);
  assert.equal(audio.loaded, true);
  audio.paused = false;
  audio.onplaying();
  assert.equal(audio.paused, true, "late idle playback is stopped");
  audio.volume = 0.2;
  audio.src = "next-start.mp3";
  audio.muted = false;
  audio.paused = false;
  assert.equal(audio.volume, 0.2);
});

test("late old play rejection/event cannot mutate a newer playback", async () => {
  const lifetime = createPlaybackLifetime();
  const oldIsCurrent = lifetime.capture();
  let rejectOld;
  let errors = 0;
  const pending = new Promise((_, reject) => { rejectOld = reject; })
    .catch(() => { if (oldIsCurrent()) errors += 1; });
  lifetime.invalidate();
  const nextIsCurrent = lifetime.capture();
  rejectOld(new Error("interrupted by new exam"));
  await pending;
  assert.equal(errors, 0);
  assert.equal(oldIsCurrent(), false);
  assert.equal(nextIsCurrent(), true);
  lifetime.invalidate();
  assert.equal(nextIsCurrent(), false);
});

test("20 consecutive exams reuse one element without retaining source or volume", () => {
  const audio = fakeAudio();
  const lifetime = createPlaybackLifetime();
  for (let exam = 0; exam < 20; exam += 1) {
    const oldIsCurrent = lifetime.capture();
    const oldEnded = () => { if (oldIsCurrent()) audio.src = null; };
    lifetime.invalidate();
    unloadAudio(audio);
    unloadAudio(audio); // fullscreen/start boundary may both request cleanup
    assert.equal(audio.src, null, "countdown must have no playable old source");
    const volume = exam % 2 ? 0.1 : 0.9;
    audio.src = "next-start.mp3";
    audio.volume = volume;
    audio.muted = false;
    oldEnded();
    assert.equal(audio.src, "next-start.mp3", "old callback must not stop new playback");
    assert.equal(audio.volume, volume);
  }
});
