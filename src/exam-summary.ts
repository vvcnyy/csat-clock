import { COUNTDOWN_SECONDS, type ExamCompletion, type Session } from "./exam-types";

export function getSessionTiming(session: Session, nowMs: number) {
  const end = session.completion?.endedAt ?? nowMs;
  const start = session.actualStartedAt ?? session.startedAt + (
    session.mode !== "sync" || session.syncWithCurrentTime === false
      ? COUNTDOWN_SECONDS * 1000 : 0
  );
  const elapsedMs = Math.max(0, end - start);
  const pausedMs = Math.min(elapsedMs, Math.max(0, session.pausedTotal) + (
    session.pausedAt ? Math.max(0, end - Math.max(start, session.pausedAt)) : 0
  ));
  return {
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    pausedSeconds: Math.floor(pausedMs / 1000),
    runningSeconds: Math.floor((elapsedMs - pausedMs) / 1000),
  };
}

export function createExamCompletion(
  session: Session,
  nowMs: number,
  clockSeconds: number,
  examEndSeconds: number,
  reason: ExamCompletion["reason"],
): ExamCompletion {
  return {
    // A background tab may observe completion late. Exclude that extra time.
    endedAt: reason === "finished"
      ? Math.max(session.actualStartedAt ?? session.startedAt,
        nowMs - Math.max(0, clockSeconds - examEndSeconds) * 1000)
      : nowMs,
    clockSeconds: reason === "finished" ? examEndSeconds : clockSeconds,
    reason,
  };
}

export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours ? `${hours}시간 ` : ""}${minutes}분 ${total % 60}초`;
}
