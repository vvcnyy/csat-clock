import { useEffect, useMemo, useState } from "react";
import { COUNTDOWN_SECONDS, secondsNow, type ListeningTiming, type Session } from "./exam-types";
import {
  eventsForSubject,
  getSubject,
  subjects,
  toSeconds,
  type SubjectId,
} from "./schedule";

export function useExamTimeline(
  session: Session | null,
  selectedSubjectId: SubjectId,
  listeningTiming: ListeningTiming,
) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const selectedSubject = getSubject(session?.subjectId ?? selectedSubjectId);
  const subjectEvents = useMemo(
    () => (session?.subjectId ? eventsForSubject(session.subjectId) : []),
    [session?.subjectId],
  );

  const countdown = session?.countdownUntil
    ? Math.max(0, Math.ceil((session.countdownUntil - nowMs) / 1000))
    : 0;

  const virtualSeconds = useMemo(() => {
    if (!session || session.mode === "sync") return secondsNow();
    const firstEvent = toSeconds(subjectEvents[0]?.at ?? selectedSubject.start);
    const clockMs = session.pausedAt ?? nowMs;
    const elapsed = Math.max(
      0,
      clockMs -
        session.startedAt -
        session.pausedTotal -
        COUNTDOWN_SECONDS * 1000,
    );
    return firstEvent + elapsed / 1000;
  }, [nowMs, selectedSubject.start, session, subjectEvents]);

  const activeSubject = useMemo(() => {
    if (!session) return selectedSubject;
    if (session.mode === "subject") return selectedSubject;
    return (
      subjects.find(
        (subject) =>
          virtualSeconds >= toSeconds(subject.start) &&
          virtualSeconds <= toSeconds(subject.end),
      ) ?? null
    );
  }, [selectedSubject, session, virtualSeconds]);

  const skipTargets = useMemo(() => {
    if (!session || session.mode !== "subject") return null;
    const start = toSeconds(selectedSubject.start);
    const listeningAt = toSeconds(
      listeningTiming === "before" ? "13:07:00" : "13:10:00",
    );
    const cutoff = session.subjectId === "english" ? listeningAt : start;
    if (virtualSeconds >= cutoff) return null;
    const futureBells = subjectEvents
      .map((bell) => toSeconds(bell.at))
      .filter((at) => at > virtualSeconds && at <= cutoff);
    const milestones = [...futureBells, cutoff].sort((a, b) => a - b);
    return { next: milestones[0], direct: cutoff };
  }, [
    listeningTiming,
    selectedSubject.start,
    session,
    subjectEvents,
    virtualSeconds,
  ]);

  return {
    activeSubject,
    countdown,
    nowMs,
    selectedSubject,
    skipTargets,
    subjectEvents,
    virtualSeconds,
  };
}
