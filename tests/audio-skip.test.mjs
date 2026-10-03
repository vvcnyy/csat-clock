import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const compile = (code) => ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const ref = (current) => ({ current });
const noop = () => {};

test("skip keeps prefetched bells and seeks existing English listening", () => {
  const session = { mode: "sync", syncWithCurrentTime: false, scheduleStartSeconds: 46500,
    startedAt: Date.now() - 600000, pausedTotal: 0 };
  const audio = { currentTime: 180, readyState: 1, duration: 4200, pause() { stopped = true; } };
  const cached = new Map([["017", "blob:ready"]]);
  let stopped = false;
  const ctx = {
    session, virtualSeconds: 47580,
    bellEvents: [{ id: "017", at: "14:10:00", kind: "warning" }], subjectEvents: [],
    getBellSeconds: () => 51000, selectedSubject: { start: "13:10:00" },
    toSeconds: (s) => s.split(":").map(Number).reduce((a, v) => a * 60 + v),
    trackGoogleAnalyticsEvent: noop, analyticsExamDetails: () => ({}),
    skipTargets: { next: 51000, direct: 51000 }, stopBell: noop,
    clearBellPrefetch: () => cached.clear(), setCurrentBell: noop, setExamCompleted: noop,
    playedEvents: ref(new Set()), previousVirtual: ref(47580), listeningTiming: "before",
    listeningAudio: ref(audio), listeningPlayed: ref(true),
    listeningWasPlayingBeforePause: ref(false), setListeningResumeRequired: noop,
    playListening: () => assert.fail("must reuse audio"),
    setSession: (fn) => fn(session), COUNTDOWN_SECONDS: 5,
    setAudioError: noop, formatAudioError: () => "error",
  };
  const start = source.indexOf("  const skipTo = (targetSeconds: number) => {");
  const end = source.indexOf("\n  const exitExam", start);
  const skip = new Function(...Object.keys(ctx), compile(source.slice(start, end)) +
    "\nreturn skipTo;")(...Object.values(ctx));
  skip(51000);
  assert.equal(audio.currentTime, 3780);
  assert.equal(cached.get("017"), "blob:ready");
  assert.equal(stopped, false);
  audio.duration = 1500;
  skip(51000);
  assert.equal(stopped, true);
  // A pending source must not be re-created or have its metadata callback replaced.
  audio.readyState = 0;
  audio.currentTime = 180;
  const pendingCallback = () => {};
  audio.onloadedmetadata = pendingCallback;
  let sessionChanged = false;
  let notice = "";
  ctx.setSession = () => { sessionChanged = true; };
  ctx.setAudioError = (message) => { notice = message; };
  const skipPending = new Function(...Object.keys(ctx), compile(source.slice(start, end)) +
    "\nreturn skipTo;")(...Object.values(ctx));
  skipPending(51000);
  assert.equal(sessionChanged, false);
  assert.equal(audio.currentTime, 180);
  assert.equal(audio.onloadedmetadata, pendingCallback);
  assert.match(notice, /준비 중/);
});
