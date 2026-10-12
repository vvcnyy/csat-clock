import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compile = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText).toString("base64");
const read = (name) => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const schedule = compile(read("schedule.ts"));
const { scheduleSubjectChoices } = await import(schedule);
const types = compile(read("exam-types.ts"));
const hookSource = read("useExamTimeline.ts")
  .replace('import { useEffect, useMemo, useState } from "react";',
    'const useEffect = () => {}; const useMemo = (fn) => fn(); const useState = (value) => [value];')
  .replace('"./exam-types"', JSON.stringify(types))
  .replace('"./schedule"', JSON.stringify(schedule));
const { useExamTimeline } = await import(compile(hookSource));
const base = { mode: "sync", startedAt: Date.now(), pausedTotal: 0, volume: 1, listeningVolume: 1, listeningTiming: "before" };

test("unsynced full schedule uses selected bell, countdown and elapsed time after restore", () => {
  const startedAt = Date.now() - 65_000;
  const session = { ...base, startedAt, syncWithCurrentTime: false, scheduleStartSeconds: 30300 };
  const result = useExamTimeline(JSON.parse(JSON.stringify(session)), "korean", "before");
  assert.ok(result.virtualSeconds >= 30360 && result.virtualSeconds < 30362);
  assert.equal(result.examEndSeconds, 63900);
  const countdown = useExamTimeline({ ...session, startedAt: Date.now(), countdownUntil: Date.now() + 5000 }, "korean", "before");
  assert.equal(countdown.virtualSeconds, 30300);
  assert.equal(countdown.countdown, 5);
});

test("unsynced full schedule pauses and follows the active subject across periods", () => {
  const session = { ...base, startedAt: 100000, pausedAt: 165000, pausedTotal: 10000,
    syncWithCurrentTime: false, scheduleStartSeconds: 37800 };
  const result = useExamTimeline(session, "korean", "before");
  assert.equal(result.virtualSeconds, 37850);
  assert.equal(result.activeSubject.id, "math");
  assert.equal(result.examInProgress, true);
});

test("old sync sessions remain wall-clock synced", () => {
  const result = useExamTimeline({ ...base, startedAt: 0 }, "korean", "before");
  const now = new Date();
  const expected = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  assert.ok(Math.abs(result.virtualSeconds - expected) <= 1);
  assert.equal(result.skipTargets, null);
});

test("full schedule offers seven subjects, separating history and both inquiries", () => {
  assert.deepEqual(scheduleSubjectChoices.map((choice) => choice.name), ["국어", "수학", "영어", "한국사", "탐구 1", "탐구 2", "제2외국어/한문"]);
  assert.deepEqual(scheduleSubjectChoices.map((choice) => choice.bell.id), ["001", "008", "014", "019", "025", "029", "032"]);
});

test("next bell advances one announcement and disappears after the final bell", () => {
  const at = (seconds) => useExamTimeline({ ...base, startedAt: 100000, pausedAt: 105000,
    syncWithCurrentTime: false, scheduleStartSeconds: seconds }, "korean", "before");
  assert.deepEqual(at(29100).skipTargets, { next: 29400, direct: 29400 });
  assert.deepEqual(at(36000).skipTargets, { next: 36900, direct: 36900 });
  assert.equal(at(63900).skipTargets, null);
});

test("restored completed sessions keep the end clock and bookmark records", () => {
  const session = JSON.parse(JSON.stringify({ ...base,
    completion: { endedAt: 165000, clockSeconds: 63900, reason: "finished" },
    bookmarks: [{ id: "mark-1", clockSeconds: 63810, subjectName: "제2외국어/한문" }],
  }));
  const result = useExamTimeline(session, "korean", "before");
  assert.equal(result.virtualSeconds, 63900);
  assert.equal(result.examInProgress, false);
  assert.equal(session.bookmarks[0].clockSeconds, 63810);
});
