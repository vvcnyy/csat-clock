import { useEffect, useMemo, useState } from "react";
import { COUNTDOWN_SECONDS, secondsNow, type ListeningTiming, type Session } from "./exam-types";
import {
  customEvents,
  eventsForSubject,
  formatClockTime,
  getBellSeconds,
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

  const regularSubject = getSubject(session?.subjectId ?? selectedSubjectId);
  const customStartSeconds = session?.customStartSeconds ?? 0;
  const customDurationMinutes = session?.customDurationMinutes ?? 1;
  const customEndSeconds =
    customStartSeconds + customDurationMinutes * 60;
  const customSubject = {
    id: "custom" as const,
    period: "자유 응시",
    name: `${customDurationMinutes}분 시험`,
    start: formatClockTime(customStartSeconds),
    end: formatClockTime(customEndSeconds),
  };
  const selectedSubject =
    session?.mode === "custom" ? customSubject : regularSubject;
  const subjectEvents = useMemo(
    () => {
      if (session?.mode === "custom") {
        return customEvents(customStartSeconds, customDurationMinutes);
      }
      return session?.subjectId ? eventsForSubject(session.subjectId) : [];
    },
    [
      customDurationMinutes,
      customStartSeconds,
      session?.mode,
      session?.subjectId,
    ],
  );

  const countdown = session?.countdownUntil
    ? Math.max(0, Math.ceil((session.countdownUntil - nowMs) / 1000))
    : 0;

  const virtualSeconds = useMemo(() => {
    if (!session || session.mode === "sync") return secondsNow();
    const firstEvent = subjectEvents[0]
      ? getBellSeconds(subjectEvents[0])
      : toSeconds(selectedSubject.start);
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
    if (session.mode !== "sync") return selectedSubject;
    return (
      subjects.find(
        (subject) =>
          virtualSeconds >= toSeconds(subject.start) &&
          virtualSeconds <= toSeconds(subject.end),
      ) ?? null
    );
  }, [selectedSubject, session, virtualSeconds]);

  const examStartSeconds =
    session?.mode === "custom"
      ? customStartSeconds
      : toSeconds(selectedSubject.start);
  const examEndSeconds =
    session?.mode === "custom"
      ? customEndSeconds
      : toSeconds(selectedSubject.end);
  const examInProgress = Boolean(
    session &&
      session.mode !== "sync" &&
      virtualSeconds >= examStartSeconds &&
      virtualSeconds < examEndSeconds,
  ) || Boolean(
    session?.mode === "sync" &&
      activeSubject &&
      virtualSeconds >= toSeconds(activeSubject.start) &&
      virtualSeconds < toSeconds(activeSubject.end),
  );

  const skipTargets = useMemo(() => {
    if (!session || session.mode !== "subject") return null;
    const start = toSeconds(selectedSubject.start);
    const listeningAt = toSeconds(
      listeningTiming === "before" ? "13:07:00" : "13:10:00",
    );
    const cutoff = session.subjectId === "english" ? listeningAt : start;
    if (virtualSeconds >= cutoff) return null;
    const futureBells = subjectEvents
      .map(getBellSeconds)
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
    examEndSeconds,
    examInProgress,
    examStartSeconds,
    nowMs,
    selectedSubject,
    skipTargets,
    subjectEvents,
    virtualSeconds,
  };
}
