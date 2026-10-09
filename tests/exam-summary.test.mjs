import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compile = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText).toString("base64");
const read = (name) => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const types = compile(read("exam-types.ts"));
const { getSessionTiming, createExamCompletion, formatDuration } = await import(compile(
  read("exam-summary.ts").replace('"./exam-types"', JSON.stringify(types)),
));
const base = { mode: "subject", startedAt: 100000, actualStartedAt: 105000, pausedTotal: 0 };

test("elapsed time includes pauses and excludes the countdown", () => {
  assert.deepEqual(getSessionTiming({ ...base, pausedTotal: 20000 }, 185000), {
    elapsedSeconds: 80, pausedSeconds: 20, runningSeconds: 60,
  });
  assert.deepEqual(getSessionTiming(base, 103000), {
    elapsedSeconds: 0, pausedSeconds: 0, runningSeconds: 0,
  });
});

test("skipping the virtual clock does not inflate actual elapsed time", () => {
  assert.equal(getSessionTiming({ ...base, startedAt: -2000000 }, 165000).elapsedSeconds, 60);
});

test("ending while paused counts the current pause and freezes the summary", () => {
  const session = { ...base, pausedTotal: 10000, pausedAt: 155000 };
  const completion = createExamCompletion(session, 185000, 32430, 36000, "manual");
  assert.equal(completion.clockSeconds, 32430);
  const saved = JSON.parse(JSON.stringify({ ...session, completion }));
  assert.deepEqual(getSessionTiming(saved, 900000), {
    elapsedSeconds: 80, pausedSeconds: 40, runningSeconds: 40,
  });
});

test("a late completion tick excludes time spent waiting on the result screen", () => {
  const completion = createExamCompletion(base, 190000, 36025, 36000, "finished");
  assert.equal(completion.endedAt, 165000);
  assert.equal(completion.clockSeconds, 36000);
  assert.equal(getSessionTiming({ ...base, completion }, 990000).elapsedSeconds, 60);
});

test("legacy sessions use their existing start and pause data", () => {
  assert.equal(getSessionTiming({ ...base, actualStartedAt: undefined }, 165000).elapsedSeconds, 60);
  assert.equal(getSessionTiming({ ...base, mode: "sync", actualStartedAt: undefined }, 165000).elapsedSeconds, 65);
});

test("duration formatting supports long schedules and clamps negative values", () => {
  assert.equal(formatDuration(3661), "1시간 1분 1초");
  assert.equal(formatDuration(-5), "0분 0초");
});
