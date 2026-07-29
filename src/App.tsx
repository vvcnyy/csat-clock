import { useCallback, useEffect, useRef, useState } from "react";
import { ExamPage } from "./components/ExamPage";
import { LandingPage } from "./components/LandingPage";
import {
  COUNTDOWN_SECONDS,
  EXAM_COMPLETION_DELAY_SECONDS,
  readJson,
  secondsNow,
  SESSION_KEY,
  SETTINGS_KEY,
  type ListeningTiming,
  type CustomStartMode,
  type Mode,
  type Session,
} from "./exam-types";
import { useWakeLock } from "./useWakeLock";
import { useExamTimeline } from "./useExamTimeline";
import { useAudioPreviews } from "./useAudioPreviews";
import { useMediaSessionGuard } from "./useMediaSessionGuard";
import {
  bellEvents,
  getBellSeconds,
  toSeconds,
  type BellEvent,
  type SubjectId,
} from "./schedule";
import { clearEnglishFile, loadEnglishFile, saveEnglishFile } from "./storage";

function App() {
  const savedSettings = readJson<
    Pick<Session, "volume" | "listeningVolume" | "listeningTiming"> & {
      customDurationMinutes?: number;
      customStartMode?: CustomStartMode;
      customStartTime?: string;
    }
  >(SETTINGS_KEY);
  const [mode, setMode] = useState<Mode>("sync");
  const [subjectId, setSubjectId] = useState<SubjectId>("korean");
  const [volume, setVolume] = useState(savedSettings?.volume ?? 0.8);
  const [listeningVolume, setListeningVolume] = useState(
    savedSettings?.listeningVolume ?? 0.8,
  );
  const [listeningTiming, setListeningTiming] = useState<ListeningTiming>(
    savedSettings?.listeningTiming ?? "before",
  );
  const [customDurationMinutes, setCustomDurationMinutes] = useState(
    savedSettings?.customDurationMinutes ?? 60,
  );
  const [customStartMode, setCustomStartMode] = useState<CustomStartMode>(
    savedSettings?.customStartMode ?? "now",
  );
  const [customStartTime, setCustomStartTime] = useState(
    savedSettings?.customStartTime ?? "09:00",
  );
  const [englishFile, setEnglishFile] = useState<File>();
  const [session, setSession] = useState<Session | null>(() => readJson<Session>(SESSION_KEY));
  const wakeLock = useWakeLock(Boolean(session));
  useMediaSessionGuard(Boolean(session));
  const {
    activeSubject,
    countdown,
    examEndSeconds,
    examInProgress,
    selectedSubject,
    skipTargets,
    subjectEvents,
    virtualSeconds,
  } = useExamTimeline(session, subjectId, listeningTiming);
  const [currentBell, setCurrentBell] = useState<BellEvent | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [examCompleted, setExamCompleted] = useState(false);
  const [audioError, setAudioError] = useState("");
  const previousVirtual = useRef<number | null>(null);
  const playedEvents = useRef(new Set<string>());
  const bellAudio = useRef<HTMLAudioElement | undefined>(undefined);
  const prefetchedBells = useRef(new Map<string, string>());
  const pendingBellFetches = useRef(new Set<string>());
  const desiredPrefetchIds = useRef(new Set<string>());
  const currentBellObjectUrl = useRef<string | undefined>(undefined);
  const listeningAudio = useRef<HTMLAudioElement | undefined>(undefined);
  const [listeningResumeRequired, setListeningResumeRequired] = useState(false);
  const listeningPlayed = useRef(false);
  const listeningWasPlayingBeforePause = useRef(false);
  const restoredOnLoad = useRef(Boolean(readJson<Session>(SESSION_KEY)));
  const listeningResumeChecked = useRef(false);
  const controlsTimer = useRef<number | undefined>(undefined);
  const {
    listeningPreviewing,
    previewing,
    stopBellPreview,
    stopListeningPreview,
    testBell,
    testListening,
  } = useAudioPreviews({
    bellVolume: volume,
    englishFile,
    listeningVolume,
    onError: setAudioError,
  });

  useEffect(() => {
    loadEnglishFile().then(setEnglishFile).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        volume,
        listeningVolume,
        listeningTiming,
        customDurationMinutes,
        customStartMode,
        customStartTime,
      }),
    );
    if (listeningAudio.current) listeningAudio.current.volume = listeningVolume;
  }, [
    customDurationMinutes,
    customStartMode,
    customStartTime,
    volume,
    listeningVolume,
    listeningTiming,
  ]);

  const clearBellPrefetch = useCallback(() => {
    desiredPrefetchIds.current.clear();
    for (const url of prefetchedBells.current.values()) {
      URL.revokeObjectURL(url);
    }
    prefetchedBells.current.clear();
  }, []);

  useEffect(() => {
    if (!session) {
      clearBellPrefetch();
      return;
    }

    const candidates = session.mode === "sync" ? bellEvents : subjectEvents;
    const nextBells = candidates
      .filter(
        (bell) =>
          getBellSeconds(bell) >= virtualSeconds &&
          !playedEvents.current.has(bell.id),
      )
      .slice(0, 2);
    const nextIds = new Set(nextBells.map((bell) => bell.id));
    desiredPrefetchIds.current = nextIds;

    for (const [id, url] of prefetchedBells.current) {
      if (!nextIds.has(id)) {
        URL.revokeObjectURL(url);
        prefetchedBells.current.delete(id);
      }
    }

    for (const bell of nextBells) {
      if (
        prefetchedBells.current.has(bell.id) ||
        pendingBellFetches.current.has(bell.id)
      ) {
        continue;
      }

      pendingBellFetches.current.add(bell.id);
      const url = `/sound/${encodeURIComponent(bell.file)}`;
      void fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          if (!desiredPrefetchIds.current.has(bell.id)) return;
          prefetchedBells.current.set(bell.id, URL.createObjectURL(blob));
        })
        .then(
          () => pendingBellFetches.current.delete(bell.id),
          () => pendingBellFetches.current.delete(bell.id),
        );
    }
  }, [
    clearBellPrefetch,
    session,
    subjectEvents,
    virtualSeconds,
  ]);

  const playBell = useCallback(
    (bell: BellEvent) => {
      const prefetchedUrl = prefetchedBells.current.get(bell.id);
      const url =
        prefetchedUrl ?? `/sound/${encodeURIComponent(bell.file)}`;
      prefetchedBells.current.delete(bell.id);
      const audio = bellAudio.current ?? new Audio();
      bellAudio.current = audio;

      audio.pause();
      if (currentBellObjectUrl.current) {
        URL.revokeObjectURL(currentBellObjectUrl.current);
      }
      currentBellObjectUrl.current = prefetchedUrl;
      audio.src = url;
      audio.preload = "auto";
      audio.volume = volume;
      audio.onerror = () => {
        if (currentBellObjectUrl.current === prefetchedUrl && prefetchedUrl) {
          URL.revokeObjectURL(prefetchedUrl);
          currentBellObjectUrl.current = undefined;
        }
        setAudioError(`${bell.label} 음원을 불러오지 못했습니다.`);
      };
      audio.onended = () => {
        if (currentBellObjectUrl.current === prefetchedUrl && prefetchedUrl) {
          URL.revokeObjectURL(prefetchedUrl);
          currentBellObjectUrl.current = undefined;
        }
        setCurrentBell((current) => (current?.id === bell.id ? null : current));
      };
      audio.load();
      setCurrentBell(bell);
      setAudioError("");
      audio.play().catch(() => setAudioError("브라우저에서 소리 재생을 차단했습니다."));
    },
    [volume],
  );

  const playListening = useCallback(async (offsetSeconds = 0) => {
    if (!englishFile || listeningPlayed.current) return;
    listeningPlayed.current = true;
    const url = URL.createObjectURL(englishFile);
    const audio = new Audio(url);
    audio.volume = listeningVolume;
    listeningAudio.current = audio;
    const startPlayback = () => {
      if (Number.isFinite(audio.duration) && offsetSeconds >= audio.duration) {
        URL.revokeObjectURL(url);
        listeningAudio.current = undefined;
        return;
      }
      if (offsetSeconds > 0) {
        audio.currentTime = Math.min(offsetSeconds, Math.max(0, audio.duration - 0.1));
      }
      audio
        .play()
        .then(() => setListeningResumeRequired(false))
        .catch(() => {
          listeningPlayed.current = false;
          if (offsetSeconds > 0) setListeningResumeRequired(true);
        });
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) startPlayback();
    else audio.onloadedmetadata = startPlayback;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (listeningAudio.current === audio) listeningAudio.current = undefined;
      listeningWasPlayingBeforePause.current = false;
    };
  }, [englishFile, listeningVolume]);

  useEffect(() => {
    if (!session || session.pausedAt || countdown > 0) return;

    const candidates = session.mode === "sync" ? bellEvents : subjectEvents;
    const firstEventSeconds = candidates[0]
      ? getBellSeconds(candidates[0])
      : toSeconds(selectedSubject.start);
    const delayUntil = (targetSeconds: number) => {
      if (session.mode === "sync") {
        const now = new Date();
        const target = new Date(now);
        target.setHours(
          Math.floor(targetSeconds / 3600),
          Math.floor((targetSeconds % 3600) / 60),
          targetSeconds % 60,
          0,
        );
        return target.getTime() - now.getTime();
      }
      const targetMs =
        session.startedAt +
        session.pausedTotal +
        COUNTDOWN_SECONDS * 1000 +
        (targetSeconds - firstEventSeconds) * 1000;
      return targetMs - Date.now();
    };

    const timers: number[] = [];
    for (const bell of candidates) {
      if (playedEvents.current.has(bell.id)) continue;
      const delay = delayUntil(getBellSeconds(bell));
      if (delay <= 0) continue;
      timers.push(window.setTimeout(() => {
        if (playedEvents.current.has(bell.id)) return;
        playedEvents.current.add(bell.id);
        playBell(bell);
      }, delay));
    }

    const englishActive =
      session.mode === "sync" || session.subjectId === "english";
    if (englishActive && !listeningPlayed.current) {
      const listeningAt = toSeconds(
        listeningTiming === "before" ? "13:07:00" : "13:10:00",
      );
      const delay = delayUntil(listeningAt);
      if (delay > 0) {
        timers.push(window.setTimeout(() => void playListening(), delay));
      }
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [
    countdown,
    listeningTiming,
    playBell,
    playListening,
    selectedSubject.start,
    session,
    subjectEvents,
  ]);

  useEffect(() => {
    if (
      !restoredOnLoad.current ||
      listeningResumeChecked.current ||
      !session ||
      !englishFile ||
      countdown > 0 ||
      session.pausedAt
    ) {
      return;
    }

    const englishActive =
      session.mode === "sync" || session.subjectId === "english";
    if (!englishActive) {
      listeningResumeChecked.current = true;
      return;
    }

    const listeningAt = toSeconds(
      listeningTiming === "before" ? "13:07:00" : "13:10:00",
    );
    const englishEnd = toSeconds("14:20:00");
    listeningResumeChecked.current = true;
    if (virtualSeconds >= listeningAt && virtualSeconds < englishEnd) {
      void playListening(virtualSeconds - listeningAt);
    }
  }, [
    countdown,
    englishFile,
    listeningTiming,
    playListening,
    session,
    virtualSeconds,
  ]);

  useEffect(() => {
    if (!session || countdown > 0 || session.pausedAt) {
      previousVirtual.current =
        session?.mode !== "sync" && countdown > 0
          ? virtualSeconds - 1
          : virtualSeconds;
      return;
    }

    const previous = previousVirtual.current ?? virtualSeconds;
    const candidates = session.mode === "sync" ? bellEvents : subjectEvents;
    for (const bell of candidates) {
      const at = getBellSeconds(bell);
      if (previous < at && virtualSeconds >= at && !playedEvents.current.has(bell.id)) {
        playedEvents.current.add(bell.id);
        if (virtualSeconds - at <= 5) playBell(bell);
      }
    }

    const englishActive =
      session.mode === "sync" || session.subjectId === "english";
    if (englishActive) {
      const listeningAt = toSeconds(listeningTiming === "before" ? "13:07:00" : "13:10:00");
      if (previous < listeningAt && virtualSeconds >= listeningAt) void playListening();
    }

    previousVirtual.current = virtualSeconds;
  }, [
    countdown,
    listeningTiming,
    playBell,
    playListening,
    session,
    subjectEvents,
    virtualSeconds,
  ]);

  useEffect(() => {
    if (!session || session.mode === "sync" || session.pausedAt || countdown > 0) return;
    if (
      virtualSeconds >=
      examEndSeconds + EXAM_COMPLETION_DELAY_SECONDS
    ) {
      setExamCompleted(true);
      setControlsVisible(true);
    }
  }, [countdown, examEndSeconds, session, virtualSeconds]);

  useEffect(() => {
    if (!session) return;
    const handleVisibility = () => {
      if (
        document.visibilityState !== "visible" ||
        session.pausedAt ||
        !listeningAudio.current ||
        listeningAudio.current.ended
      ) {
        return;
      }
      const listeningAt = toSeconds(
        listeningTiming === "before" ? "13:07:00" : "13:10:00",
      );
      const expected = Math.max(0, virtualSeconds - listeningAt);
      const duration = listeningAudio.current.duration;
      if (
        Number.isFinite(duration) &&
        expected < duration &&
        Math.abs(listeningAudio.current.currentTime - expected) > 2
      ) {
        listeningAudio.current.currentTime = expected;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [listeningTiming, session, virtualSeconds]);

  const chooseEnglishFile = async (file?: File) => {
    if (!file) return;
    setEnglishFile(file);
    try {
      await saveEnglishFile(file);
    } catch {
      setAudioError("듣기 파일은 선택됐지만 새로고침 복원용 저장에 실패했습니다.");
    }
  };

  const removeEnglishFile = async () => {
    stopListeningPreview();
    setEnglishFile(undefined);
    try {
      await clearEnglishFile();
    } catch {
      setAudioError("저장된 듣기 파일을 삭제하지 못했습니다.");
    }
  };

  const begin = () => {
    if (
      mode === "custom" &&
      (!Number.isFinite(customDurationMinutes) || customDurationMinutes <= 0)
    ) {
      setAudioError("시험 시간을 1분 이상 입력해 주세요.");
      return;
    }
    stopBellPreview();
    stopListeningPreview();
    clearBellPrefetch();
    if (bellAudio.current) {
      bellAudio.current.pause();
      try {
        bellAudio.current.currentTime = 0;
      } catch {
        // Metadata가 없는 구형 TV 브라우저에서는 탐색이 실패할 수 있습니다.
      }
    }
    if (currentBellObjectUrl.current) {
      URL.revokeObjectURL(currentBellObjectUrl.current);
      currentBellObjectUrl.current = undefined;
    }
    if (listeningAudio.current) {
      listeningAudio.current.pause();
      listeningAudio.current.currentTime = 0;
      listeningAudio.current = undefined;
    }
    const startedAt = Date.now();
    const safeCustomDuration = Math.max(1, Math.floor(customDurationMinutes || 1));
    const customStartSeconds =
      customStartMode === "now"
        ? secondsNow() + COUNTDOWN_SECONDS
        : toSeconds(`${customStartTime || "09:00"}:00`);
    playedEvents.current.clear();
    listeningPlayed.current = false;
    listeningWasPlayingBeforePause.current = false;
    setListeningResumeRequired(false);
    restoredOnLoad.current = false;
    listeningResumeChecked.current = true;
    previousVirtual.current = null;
    setCurrentBell(null);
    setExamCompleted(false);
    setAudioError("");
    setSession({
      mode,
      subjectId: mode === "subject" ? subjectId : undefined,
      startedAt,
      countdownUntil:
        mode !== "sync" ? startedAt + COUNTDOWN_SECONDS * 1000 : undefined,
      pausedTotal: 0,
      volume,
      listeningVolume,
      listeningTiming,
      customDurationMinutes:
        mode === "custom" ? safeCustomDuration : undefined,
      customStartSeconds:
        mode === "custom" ? customStartSeconds : undefined,
    });
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const togglePause = () => {
    if (!session || session.mode === "sync") return;
    setSession((current) => {
      if (!current) return current;
      if (current.pausedAt) {
        const pauseLength = Date.now() - current.pausedAt;
        if (
          listeningWasPlayingBeforePause.current &&
          listeningAudio.current &&
          !listeningAudio.current.ended
        ) {
          listeningAudio.current.play().catch(() => undefined);
        }
        listeningWasPlayingBeforePause.current = false;
        return {
          ...current,
          pausedAt: undefined,
          pausedTotal: current.pausedTotal + pauseLength,
        };
      }
      bellAudio.current?.pause();
      listeningWasPlayingBeforePause.current = Boolean(
        listeningAudio.current &&
          !listeningAudio.current.paused &&
          !listeningAudio.current.ended,
      );
      listeningAudio.current?.pause();
      return { ...current, pausedAt: Date.now() };
    });
  };

  const skipTo = (targetSeconds: number) => {
    if (!session || session.mode !== "subject") return;
    const firstEvent = toSeconds(subjectEvents[0]?.at ?? selectedSubject.start);
    const clockMs = session.pausedAt ?? Date.now();
    const targetElapsed = Math.max(0, targetSeconds - firstEvent) * 1000;

    bellAudio.current?.pause();
    setCurrentBell(null);
    setExamCompleted(false);
    for (const bell of subjectEvents) {
      if (getBellSeconds(bell) < targetSeconds) playedEvents.current.add(bell.id);
    }
    previousVirtual.current = targetSeconds - 1;

    const listeningAt = toSeconds(
      listeningTiming === "before" ? "13:07:00" : "13:10:00",
    );
    if (
      session.subjectId === "english" &&
      targetSeconds >= listeningAt &&
      !listeningPlayed.current
    ) {
      void playListening(Math.max(0, targetSeconds - listeningAt));
    }

    setSession((current) =>
      current
        ? {
            ...current,
            countdownUntil: undefined,
            startedAt:
              clockMs -
              current.pausedTotal -
              COUNTDOWN_SECONDS * 1000 -
              targetElapsed,
          }
        : current,
    );
  };

  const exitExam = () => {
    stopBellPreview();
    stopListeningPreview();
    clearBellPrefetch();
    bellAudio.current?.pause();
    if (currentBellObjectUrl.current) {
      URL.revokeObjectURL(currentBellObjectUrl.current);
      currentBellObjectUrl.current = undefined;
    }
    listeningAudio.current?.pause();
    setSession(null);
    setCurrentBell(null);
    previousVirtual.current = null;
    playedEvents.current.clear();
    listeningPlayed.current = false;
    listeningWasPlayingBeforePause.current = false;
    setListeningResumeRequired(false);
    restoredOnLoad.current = false;
    listeningResumeChecked.current = false;
    document.exitFullscreen?.().catch(() => undefined);
  };

  const revealControls = () => {
    setControlsVisible(true);
    window.clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => setControlsVisible(false), 2600);
  };

  const resumeListeningFromCurrentTime = () => {
    const listeningAt = toSeconds(
      listeningTiming === "before" ? "13:07:00" : "13:10:00",
    );
    const offset = Math.max(0, virtualSeconds - listeningAt);
    const audio = listeningAudio.current;

    if (!audio) {
      listeningPlayed.current = false;
      void playListening(offset);
      return;
    }

    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(offset, Math.max(0, audio.duration - 0.1));
    }
    listeningPlayed.current = true;
    audio
      .play()
      .then(() => {
        setListeningResumeRequired(false);
        setAudioError("");
      })
      .catch(() => {
        listeningPlayed.current = false;
        setAudioError("영어 듣기를 재생할 수 없습니다. 브라우저의 소리 권한을 확인해 주세요.");
      });
  };

  if (!session) {
    return (
      <LandingPage
        mode={mode}
        subjectId={subjectId}
        volume={volume}
        listeningVolume={listeningVolume}
        listeningTiming={listeningTiming}
        customDurationMinutes={customDurationMinutes}
        customStartMode={customStartMode}
        customStartTime={customStartTime}
        englishFile={englishFile}
        previewing={previewing}
        listeningPreviewing={listeningPreviewing}
        audioError={audioError}
        onModeChange={setMode}
        onSubjectChange={setSubjectId}
        onVolumeChange={setVolume}
        onListeningVolumeChange={setListeningVolume}
        onListeningTimingChange={setListeningTiming}
        onCustomDurationChange={setCustomDurationMinutes}
        onCustomStartModeChange={setCustomStartMode}
        onCustomStartTimeChange={setCustomStartTime}
        onChooseEnglishFile={(file) => void chooseEnglishFile(file)}
        onRemoveEnglishFile={() => void removeEnglishFile()}
        onTestBell={testBell}
        onTestListening={testListening}
        onStart={begin}
      />
    );
  }

  return (
    <ExamPage
      session={session}
      countdown={countdown}
      activeSubject={activeSubject}
      examInProgress={examInProgress}
      virtualSeconds={virtualSeconds}
      currentBell={currentBell}
      controlsVisible={controlsVisible}
      skipTargets={skipTargets}
      listeningTiming={listeningTiming}
      wakeLockStatus={wakeLock.status}
      volume={volume}
      listeningVolume={listeningVolume}
      listeningResumeRequired={listeningResumeRequired}
      examCompleted={examCompleted}
      audioError={audioError}
      onRevealControls={revealControls}
      onSkip={skipTo}
      onTogglePause={togglePause}
      onRequestWakeLock={() => void wakeLock.request()}
      onVolumeChange={(next) => {
        setVolume(next);
        if (bellAudio.current) bellAudio.current.volume = next;
      }}
      onListeningVolumeChange={(next) => {
        setListeningVolume(next);
        if (listeningAudio.current) listeningAudio.current.volume = next;
      }}
      onExit={exitExam}
      onResumeListening={resumeListeningFromCurrentTime}
    />
  );
}

export default App;
