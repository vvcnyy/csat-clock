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
import {
  formatAudioError,
  getAudioErrorCode,
  getAudioErrorDetails,
} from "./audio-errors";
import { trackGoogleAnalyticsEvent } from "./google-analytics";

type AudioUnlockStatus = "not_required" | "required" | "pending" | "active" | "failed";

const audioUnlockScope = import.meta.env.VITE_AUDIO_UNLOCK_SCOPE?.trim().toLowerCase();
const applePlatform =
  /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ||
  /iPhone|iPad|iPod|Mac/i.test(navigator.platform) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const audioUnlockEnabled = audioUnlockScope === "all" || applePlatform;

const createSilentWavUrl = () => {
  const sampleRate = 8000;
  const sampleCount = 800;
  const buffer = new ArrayBuffer(44 + sampleCount);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount, true);
  writeText(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount, true);
  for (let index = 44; index < buffer.byteLength; index += 1) {
    view.setUint8(index, 128);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
};

const analyticsExamDetails = (session: Session) => ({
  exam_mode: session.mode,
  subject:
    session.mode === "subject"
      ? session.subjectId ?? "unknown"
      : session.mode === "custom"
        ? "custom"
        : "all",
});

const durationBucket = (minutes: number) =>
  minutes <= 30 ? "1-30" : minutes <= 60 ? "31-60" : minutes <= 90 ? "61-90" : "91+";

const progressDetails = (current: number, start: number, end: number) => {
  const total = Math.max(1, end - start);
  const elapsed = Math.max(0, Math.min(total, current - start));
  return {
    progress_percent: Math.round((elapsed / total) * 1000) / 10,
    progress_elapsed_seconds: Math.round(elapsed),
    progress_remaining_seconds: Math.round(Math.max(0, end - current)),
  };
};

function App() {
  const savedSettings = readJson<
    Pick<Session, "volume" | "listeningVolume" | "listeningTiming"> & {
      startAtMainBell?: boolean;
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
  const [startAtMainBell, setStartAtMainBell] = useState(
    savedSettings?.startAtMainBell ?? false,
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
    examStartSeconds,
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
  const [audioUnlockStatus, setAudioUnlockStatus] = useState<AudioUnlockStatus>(
    audioUnlockEnabled ? "required" : "not_required",
  );
  const previousVirtual = useRef<number | null>(null);
  const playedEvents = useRef(new Set<string>());
  const bellAudio = useRef<HTMLAudioElement | undefined>(undefined);
  const audioUnlockPromise = useRef<Promise<boolean> | undefined>(undefined);
  const audioUnlockObjectUrl = useRef<string | undefined>(undefined);
  const beginPending = useRef(false);
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
  const completedTrackedSession = useRef<number | undefined>(undefined);
  const beganTrackedSession = useRef<number | undefined>(undefined);
  const restoreTrackedSession = useRef<number | undefined>(undefined);
  const backgroundStartedAt = useRef<number | undefined>(undefined);
  const backgroundAudioWasPlaying = useRef(false);
  const listeningSource = useRef<"local" | "ebsi" | "restored" | "none">("none");
  const activeSessionStartedAt = useRef(session?.startedAt);
  activeSessionStartedAt.current = session?.startedAt;
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
    loadEnglishFile().then((file) => {
      setEnglishFile(file);
      if (file) listeningSource.current = "restored";
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  useEffect(() => {
    if (!session || restoreTrackedSession.current === session.startedAt) return;
    if (restoredOnLoad.current) {
      restoreTrackedSession.current = session.startedAt;
      beganTrackedSession.current = session.startedAt;
      trackGoogleAnalyticsEvent("exam_restore", {
        ...analyticsExamDetails(session),
        restore_position:
          countdown > 0
            ? "countdown"
            : virtualSeconds >= examEndSeconds
              ? "completed_or_expired"
              : "in_progress",
        ...progressDetails(virtualSeconds, examStartSeconds, examEndSeconds),
      });
    }
  }, [countdown, examEndSeconds, examStartSeconds, session, virtualSeconds]);

  useEffect(() => {
    if (!session || countdown > 0 || beganTrackedSession.current === session.startedAt) return;
    beganTrackedSession.current = session.startedAt;
    trackGoogleAnalyticsEvent("exam_begin", {
      ...analyticsExamDetails(session),
      custom_duration_minutes: session.customDurationMinutes,
      custom_duration_bucket: session.customDurationMinutes
        ? durationBucket(session.customDurationMinutes)
        : undefined,
    });
  }, [countdown, session]);

  useEffect(() => {
    if (!session) return;
    const handleVisibility = () => {
      const details = {
        ...analyticsExamDetails(session),
        ...progressDetails(virtualSeconds, examStartSeconds, examEndSeconds),
      };
      if (document.visibilityState === "hidden") {
        backgroundStartedAt.current = Date.now();
        backgroundAudioWasPlaying.current = Boolean(
          (bellAudio.current && !bellAudio.current.paused) ||
          (listeningAudio.current && !listeningAudio.current.paused),
        );
        trackGoogleAnalyticsEvent("exam_background", {
          ...details,
          was_audio_playing: backgroundAudioWasPlaying.current,
        });
      } else if (backgroundStartedAt.current) {
        trackGoogleAnalyticsEvent("exam_foreground", {
          ...details,
          background_seconds: Math.round((Date.now() - backgroundStartedAt.current) / 1000),
          was_audio_playing: backgroundAudioWasPlaying.current,
        });
        backgroundStartedAt.current = undefined;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [examEndSeconds, examStartSeconds, session, virtualSeconds]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        volume,
        listeningVolume,
        listeningTiming,
        startAtMainBell,
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
    startAtMainBell,
  ]);

  const clearBellPrefetch = useCallback(() => {
    desiredPrefetchIds.current.clear();
    for (const url of prefetchedBells.current.values()) {
      URL.revokeObjectURL(url);
    }
    prefetchedBells.current.clear();
  }, []);

  const unlockBellAudio = useCallback((): Promise<boolean> => {
    if (!audioUnlockEnabled || audioUnlockStatus === "active") {
      return Promise.resolve(true);
    }
    if (audioUnlockPromise.current) return audioUnlockPromise.current;

    setAudioUnlockStatus("pending");
    setAudioError("");
    const audio = bellAudio.current ?? new Audio();
    bellAudio.current = audio;
    audio.pause();
    if (audioUnlockObjectUrl.current) {
      URL.revokeObjectURL(audioUnlockObjectUrl.current);
    }
    const silentUrl = createSilentWavUrl();
    audioUnlockObjectUrl.current = silentUrl;
    audio.muted = false;
    audio.volume = 1;
    audio.preload = "auto";
    audio.src = silentUrl;
    audio.load();
    audio.onended = () => {
      if (audioUnlockObjectUrl.current === silentUrl) {
        URL.revokeObjectURL(silentUrl);
        audioUnlockObjectUrl.current = undefined;
      }
    };
    trackGoogleAnalyticsEvent("audio_unlock_attempt", {
      unlock_scope: audioUnlockScope === "all" ? "all" : "apple",
      restore: Boolean(session),
    });

    let playResult: Promise<void> | undefined;
    try {
      playResult = audio.play();
    } catch (error) {
      playResult = Promise.reject(error);
    }
    const pending = Promise.resolve(playResult).then(
      () => {
        setAudioUnlockStatus("active");
        setAudioError("");
        trackGoogleAnalyticsEvent("audio_unlock_success", {
          unlock_scope: audioUnlockScope === "all" ? "all" : "apple",
          restore: Boolean(session),
        });
        return true;
      },
      (error: unknown) => {
        if (audioUnlockObjectUrl.current === silentUrl) {
          URL.revokeObjectURL(silentUrl);
          audioUnlockObjectUrl.current = undefined;
        }
        setAudioUnlockStatus("failed");
        setAudioError(
          `${formatAudioError("타종 소리 활성화", error, audio.error)} 아래 버튼을 눌러 다시 시도해 주세요.`,
        );
        trackGoogleAnalyticsEvent("audio_unlock_error", {
          unlock_scope: audioUnlockScope === "all" ? "all" : "apple",
          restore: Boolean(session),
          error_code: getAudioErrorCode(error, audio.error),
          ...getAudioErrorDetails(error, audio),
        });
        return false;
      },
    ).finally(() => {
      audioUnlockPromise.current = undefined;
    });
    audioUnlockPromise.current = pending;
    return pending;
  }, [audioUnlockStatus, session]);

  const getBellFile = useCallback(
    (bell: BellEvent) =>
      session?.mode === "subject" && bell.shortFile
        ? bell.shortFile
        : bell.file,
    [session?.mode],
  );

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
      const url = `/sound/${encodeURIComponent(getBellFile(bell))}`;
      const prefetchStartedAt = performance.now();
      let httpStatus: number | undefined;
      void fetch(url)
        .then((response) => {
          httpStatus = response.status;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          if (!desiredPrefetchIds.current.has(bell.id)) return;
          prefetchedBells.current.set(bell.id, URL.createObjectURL(blob));
          trackGoogleAnalyticsEvent("audio_prefetch_success", {
            ...analyticsExamDetails(session),
            bell_kind: bell.kind,
            source_type: "network_blob",
            http_status: httpStatus,
            fetch_duration_ms: Math.round(performance.now() - prefetchStartedAt),
          });
        })
        .then(
          () => pendingBellFetches.current.delete(bell.id),
          (error: unknown) => {
            pendingBellFetches.current.delete(bell.id);
            trackGoogleAnalyticsEvent("audio_prefetch_error", {
              ...analyticsExamDetails(session),
              bell_kind: bell.kind,
              source_type: "network_blob",
              http_status: httpStatus,
              fetch_duration_ms: Math.round(performance.now() - prefetchStartedAt),
              error_name: error instanceof Error ? error.name : "unknown",
            });
          },
        );
    }
  }, [
    clearBellPrefetch,
    getBellFile,
    session,
    subjectEvents,
    virtualSeconds,
  ]);

  const playBell = useCallback(
    (bell: BellEvent, expectedAtMs = Date.now()) => {
      if (audioUnlockEnabled && audioUnlockStatus !== "active") {
        if (audioUnlockStatus !== "pending") setAudioUnlockStatus("required");
        setAudioError(
          "[SND-E01] 예약된 타종 전에 소리를 활성화하지 못했습니다. 타종 소리 활성화 버튼을 눌러 주세요.",
        );
        trackGoogleAnalyticsEvent("audio_unlock_required", {
          ...(session ? analyticsExamDetails(session) : {}),
          bell_kind: bell.kind,
          unlock_scope: audioUnlockScope === "all" ? "all" : "apple",
        });
        return;
      }
      if (audioUnlockObjectUrl.current) {
        URL.revokeObjectURL(audioUnlockObjectUrl.current);
        audioUnlockObjectUrl.current = undefined;
      }
      const prefetchedUrl = prefetchedBells.current.get(bell.id);
      const url =
        prefetchedUrl ?? `/sound/${encodeURIComponent(getBellFile(bell))}`;
      prefetchedBells.current.delete(bell.id);
      const audio = bellAudio.current ?? new Audio();
      bellAudio.current = audio;

      audio.pause();
      if (currentBellObjectUrl.current) {
        URL.revokeObjectURL(currentBellObjectUrl.current);
      }
      currentBellObjectUrl.current = prefetchedUrl;
      let errorReported = false;
      let successReported = false;
      const reportError = (error?: unknown) => {
        if (errorReported) return;
        errorReported = true;
        const errorCode = getAudioErrorCode(error, audio.error);
        if (audioUnlockEnabled && errorCode === "SND-E01") {
          setAudioUnlockStatus("failed");
        }
        trackGoogleAnalyticsEvent("audio_error", {
          ...(session ? analyticsExamDetails(session) : {}),
          error_code: errorCode,
          audio_type: "bell",
          error_context: "playback",
          bell_kind: bell.kind,
          source_type: prefetchedUrl ? "prefetched_blob" : "direct_url",
          ...getAudioErrorDetails(error, audio),
        });
        setAudioError(formatAudioError(bell.label, error, audio.error));
      };
      audio.src = url;
      audio.preload = "auto";
      audio.volume = volume;
      audio.onerror = () => {
        if (currentBellObjectUrl.current === prefetchedUrl && prefetchedUrl) {
          URL.revokeObjectURL(prefetchedUrl);
          currentBellObjectUrl.current = undefined;
        }
        reportError();
      };
      audio.onplaying = () => {
        if (successReported) return;
        successReported = true;
        trackGoogleAnalyticsEvent("audio_play_success", {
          ...(session ? analyticsExamDetails(session) : {}),
          audio_type: "bell",
          error_context: "playback",
          bell_kind: bell.kind,
          source_type: prefetchedUrl ? "prefetched_blob" : "direct_url",
          bell_delay_ms: Math.max(0, Math.round(Date.now() - expectedAtMs)),
        });
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
      trackGoogleAnalyticsEvent("audio_play_attempt", {
        ...(session ? analyticsExamDetails(session) : {}),
        audio_type: "bell",
        error_context: "playback",
        bell_kind: bell.kind,
        source_type: prefetchedUrl ? "prefetched_blob" : "direct_url",
      });
      audio.play().catch((error: unknown) => reportError(error));
    },
    [audioUnlockStatus, getBellFile, session, volume],
  );

  const playListening = useCallback(async (offsetSeconds = 0) => {
    if (!englishFile || listeningPlayed.current) return;
    listeningPlayed.current = true;
    const url = URL.createObjectURL(englishFile);
    const audio = new Audio(url);
    audio.volume = listeningVolume;
    listeningAudio.current = audio;
    trackGoogleAnalyticsEvent("audio_play_attempt", {
      ...(session ? analyticsExamDetails(session) : {}),
      audio_type: "listening",
      error_context: offsetSeconds > 0 ? "resume" : "playback",
      source_type: listeningSource.current,
    });
    let errorReported = false;
    const reportError = (error?: unknown) => {
      if (errorReported) return;
      errorReported = true;
      trackGoogleAnalyticsEvent("audio_error", {
        ...(session ? analyticsExamDetails(session) : {}),
        error_code: getAudioErrorCode(error, audio.error),
        audio_type: "listening",
        error_context: offsetSeconds > 0 ? "resume" : "playback",
        source_type: listeningSource.current,
        ...getAudioErrorDetails(error, audio),
      });
      setAudioError(formatAudioError("영어 듣기", error, audio.error));
    };
    audio.onerror = () => {
      listeningPlayed.current = false;
      reportError();
    };
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
        .then(() => {
          trackGoogleAnalyticsEvent("audio_play_success", {
            ...(session ? analyticsExamDetails(session) : {}),
            audio_type: "listening",
            error_context: offsetSeconds > 0 ? "resume" : "playback",
            source_type: listeningSource.current,
          });
          setListeningResumeRequired(false);
          trackGoogleAnalyticsEvent("listening_start", {
            ...(session ? analyticsExamDetails(session) : {}),
            start_type: offsetSeconds > 0 ? "resume" : "scheduled",
            offset_seconds: Math.floor(offsetSeconds),
          });
        })
        .catch((error: unknown) => {
          listeningPlayed.current = false;
          if (offsetSeconds > 0) setListeningResumeRequired(true);
          reportError(error);
        });
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) startPlayback();
    else audio.onloadedmetadata = startPlayback;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (listeningAudio.current === audio) listeningAudio.current = undefined;
      listeningWasPlayingBeforePause.current = false;
    };
  }, [englishFile, listeningVolume, session]);

  useEffect(() => {
    if (!session || session.pausedAt || countdown > 0) return;

    const candidates = session.mode === "sync" ? bellEvents : subjectEvents;
    const firstEventSeconds =
      session.startAtMainBell && session.mode === "subject"
        ? toSeconds(selectedSubject.start)
        : candidates[0]
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
    const scheduledSessionStartedAt = session.startedAt;
    for (const bell of candidates) {
      if (playedEvents.current.has(bell.id)) continue;
      const delay = delayUntil(getBellSeconds(bell));
      if (delay <= 0) continue;
      const expectedAtMs = Date.now() + delay;
      timers.push(window.setTimeout(() => {
        if (activeSessionStartedAt.current !== scheduledSessionStartedAt) return;
        if (playedEvents.current.has(bell.id)) return;
        playedEvents.current.add(bell.id);
        playBell(bell, expectedAtMs);
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
        timers.push(window.setTimeout(() => {
          if (activeSessionStartedAt.current !== scheduledSessionStartedAt) return;
          void playListening();
        }, delay));
      } else if (
        session.mode === "subject" &&
        session.startAtMainBell &&
        virtualSeconds >= listeningAt
      ) {
        void playListening(virtualSeconds - listeningAt);
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
    virtualSeconds,
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
        if (virtualSeconds - at <= 5) {
          playBell(bell, Date.now() - Math.max(0, virtualSeconds - at) * 1000);
        }
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

  const chooseEnglishFile = async (
    file?: File,
    source: "local" | "ebsi" = "local",
  ) => {
    if (!file) return;
    setEnglishFile(file);
    listeningSource.current = source;
    const extension = file.name.split(".").pop()?.toLowerCase();
    trackGoogleAnalyticsEvent("listening_file_select", {
      listening_source: source,
      file_type: file.type || extension || "unknown",
    });
    try {
      await saveEnglishFile(file);
    } catch (error) {
      trackGoogleAnalyticsEvent("listening_storage_error", {
        listening_source: source,
        storage_action: "save",
        error_name: error instanceof Error ? error.name : "unknown",
      });
      setAudioError("듣기 파일은 선택됐지만 새로고침 복원용 저장에 실패했습니다.");
    }
  };

  const removeEnglishFile = async () => {
    stopListeningPreview();
    setEnglishFile(undefined);
    trackGoogleAnalyticsEvent("listening_file_remove", {
      listening_source: listeningSource.current,
    });
    listeningSource.current = "none";
    try {
      await clearEnglishFile();
    } catch (error) {
      trackGoogleAnalyticsEvent("listening_storage_error", {
        storage_action: "remove",
        error_name: error instanceof Error ? error.name : "unknown",
      });
      setAudioError("저장된 듣기 파일을 삭제하지 못했습니다.");
    }
  };

  const startExam = () => {
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
    if (audioUnlockObjectUrl.current) {
      URL.revokeObjectURL(audioUnlockObjectUrl.current);
      audioUnlockObjectUrl.current = undefined;
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
    completedTrackedSession.current = undefined;
    beganTrackedSession.current = undefined;
    const startParameters = {
      exam_mode: mode,
      subject:
        mode === "subject" ? subjectId : mode === "custom" ? "custom" : "all",
      start_at_main_bell: mode === "subject" && startAtMainBell,
      listening_timing:
        mode === "sync" || (mode === "subject" && subjectId === "english")
          ? listeningTiming
          : "none",
      has_listening_audio: Boolean(englishFile),
      custom_duration_minutes:
        mode === "custom" ? safeCustomDuration : undefined,
      custom_duration_bucket:
        mode === "custom" ? durationBucket(safeCustomDuration) : undefined,
      custom_start_mode: mode === "custom" ? customStartMode : undefined,
    };
    trackGoogleAnalyticsEvent("exam_start_click", startParameters);
    trackGoogleAnalyticsEvent("exam_start", startParameters);
    activeSessionStartedAt.current = startedAt;
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
      startAtMainBell: mode === "subject" ? startAtMainBell : undefined,
      customDurationMinutes:
        mode === "custom" ? safeCustomDuration : undefined,
      customStartSeconds:
        mode === "custom" ? customStartSeconds : undefined,
    });
  };

  const begin = () => {
    if (beginPending.current) return;
    if (
      mode === "custom" &&
      (!Number.isFinite(customDurationMinutes) || customDurationMinutes <= 0)
    ) {
      setAudioError("시험 시간을 1분 이상 입력해 주세요.");
      return;
    }
    document.documentElement.requestFullscreen?.().catch((error) =>
      trackGoogleAnalyticsEvent("fullscreen_failed", {
        fullscreen_action: "automatic_enter",
        error_name: error instanceof Error ? error.name : "unknown",
      }),
    );
    if (!audioUnlockEnabled || audioUnlockStatus === "active") {
      startExam();
      return;
    }

    beginPending.current = true;
    void unlockBellAudio().then((unlocked) => {
      beginPending.current = false;
      if (unlocked) startExam();
    });
  };

  const togglePause = () => {
    if (!session || session.mode === "sync") return;
    trackGoogleAnalyticsEvent(session.pausedAt ? "exam_resume" : "exam_pause", {
      ...analyticsExamDetails(session),
      pause_seconds: session.pausedAt
        ? Math.max(0, Math.round((Date.now() - session.pausedAt) / 1000))
        : undefined,
    });
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
    const targetBell = subjectEvents.find(
      (bell) => getBellSeconds(bell) === targetSeconds,
    );
    trackGoogleAnalyticsEvent("exam_skip", {
      ...analyticsExamDetails(session),
      skip_type:
        skipTargets && targetSeconds === skipTargets.direct
          ? "direct"
          : "next_bell",
      target_kind: targetBell?.kind ?? "exam_start",
    });

    bellAudio.current?.pause();
    if (audioUnlockObjectUrl.current) {
      URL.revokeObjectURL(audioUnlockObjectUrl.current);
      audioUnlockObjectUrl.current = undefined;
    }
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

  const exitExam = useCallback((reason: string) => {
    if (session) {
      trackGoogleAnalyticsEvent("exam_exit", {
        ...analyticsExamDetails(session),
        exit_reason: reason,
        completed: examCompleted || reason !== "user",
        ...progressDetails(virtualSeconds, examStartSeconds, examEndSeconds),
      });
    }
    activeSessionStartedAt.current = undefined;
    stopBellPreview();
    stopListeningPreview();
    clearBellPrefetch();
    bellAudio.current?.pause();
    if (audioUnlockObjectUrl.current) {
      URL.revokeObjectURL(audioUnlockObjectUrl.current);
      audioUnlockObjectUrl.current = undefined;
    }
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
  }, [clearBellPrefetch, examCompleted, examEndSeconds, examStartSeconds, session, stopBellPreview, stopListeningPreview, virtualSeconds]);

  useEffect(() => {
    if (
      !session ||
      session.mode === "sync" ||
      session.pausedAt ||
      countdown > 0 ||
      virtualSeconds < examEndSeconds
    ) {
      return;
    }

    setExamCompleted(true);
    setControlsVisible(true);
    if (completedTrackedSession.current !== session.startedAt) {
      completedTrackedSession.current = session.startedAt;
      trackGoogleAnalyticsEvent("exam_complete", {
        ...analyticsExamDetails(session),
        elapsed_seconds: Math.max(
          0,
          Math.round((Date.now() - session.startedAt - session.pausedTotal) / 1000),
        ),
      });
    }

    const secondsUntilHome =
      examEndSeconds + EXAM_COMPLETION_DELAY_SECONDS - virtualSeconds;
    if (secondsUntilHome <= 0) {
      trackGoogleAnalyticsEvent("completion_auto_return", analyticsExamDetails(session));
      exitExam("auto_after_complete");
      return;
    }

    const timer = window.setTimeout(
      () => {
        trackGoogleAnalyticsEvent("completion_auto_return", analyticsExamDetails(session));
        exitExam("auto_after_complete");
      },
      Math.ceil(secondsUntilHome * 1000),
    );
    return () => window.clearTimeout(timer);
  }, [countdown, examEndSeconds, exitExam, session, virtualSeconds]);

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
    trackGoogleAnalyticsEvent("audio_play_attempt", {
      ...(session ? analyticsExamDetails(session) : {}),
      audio_type: "listening",
      error_context: "manual_resume",
      source_type: listeningSource.current,
    });
    audio
      .play()
      .then(() => {
        trackGoogleAnalyticsEvent("audio_play_success", {
          ...(session ? analyticsExamDetails(session) : {}),
          audio_type: "listening",
          error_context: "manual_resume",
          source_type: listeningSource.current,
        });
        setListeningResumeRequired(false);
        setAudioError("");
        trackGoogleAnalyticsEvent("listening_resume", {
          ...(session ? analyticsExamDetails(session) : {}),
          offset_seconds: Math.floor(offset),
        });
      })
      .catch((error: unknown) => {
        listeningPlayed.current = false;
        trackGoogleAnalyticsEvent("audio_error", {
          ...(session ? analyticsExamDetails(session) : {}),
          error_code: getAudioErrorCode(error, audio.error),
          audio_type: "listening",
          error_context: "manual_resume",
          source_type: listeningSource.current,
          ...getAudioErrorDetails(error, audio),
        });
        setAudioError(formatAudioError("영어 듣기 계속하기", error, audio.error));
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
        startAtMainBell={startAtMainBell}
        customDurationMinutes={customDurationMinutes}
        customStartMode={customStartMode}
        customStartTime={customStartTime}
        englishFile={englishFile}
        previewing={previewing}
        listeningPreviewing={listeningPreviewing}
        audioError={audioError}
        audioUnlockStatus={audioUnlockStatus}
        onModeChange={(next) => {
          trackGoogleAnalyticsEvent("exam_setup_change", { setting_name: "exam_mode", setting_value: next });
          setMode(next);
        }}
        onSubjectChange={(next) => {
          trackGoogleAnalyticsEvent("exam_setup_change", { setting_name: "subject", setting_value: next });
          setSubjectId(next);
        }}
        onVolumeChange={setVolume}
        onListeningVolumeChange={setListeningVolume}
        onListeningTimingChange={(next) => {
          trackGoogleAnalyticsEvent("exam_setup_change", { setting_name: "listening_timing", setting_value: next });
          setListeningTiming(next);
        }}
        onStartAtMainBellChange={(next) => {
          trackGoogleAnalyticsEvent("exam_setup_change", { setting_name: "start_at_main_bell", setting_value: String(next) });
          setStartAtMainBell(next);
        }}
        onCustomDurationChange={setCustomDurationMinutes}
        onCustomStartModeChange={(next) => {
          trackGoogleAnalyticsEvent("exam_setup_change", { setting_name: "custom_start_mode", setting_value: next });
          setCustomStartMode(next);
        }}
        onCustomStartTimeChange={setCustomStartTime}
        onChooseEnglishFile={(file, source) => void chooseEnglishFile(file, source)}
        onRemoveEnglishFile={() => void removeEnglishFile()}
        onTestBell={testBell}
        onTestListening={testListening}
        onStart={begin}
        onUnlockAudio={() => void unlockBellAudio()}
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
      audioUnlockStatus={audioUnlockStatus}
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
      onExit={() => exitExam("user")}
      onCompleteReturn={() => {
        trackGoogleAnalyticsEvent("completion_confirm", analyticsExamDetails(session));
        exitExam("completed_confirm");
      }}
      onResumeListening={resumeListeningFromCurrentTime}
      onUnlockAudio={() => void unlockBellAudio()}
    />
  );
}

export default App;
