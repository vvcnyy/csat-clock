import {
  FastForward,
  Maximize,
  Minimize,
  Play,
  SkipForward,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import AnalogClock from "../AnalogClock";
import type { ListeningTiming, Session } from "../exam-types";
import type { BellEvent } from "../schedule";
import type { WakeLockStatus } from "../useWakeLock";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

interface SkipTargets {
  next: number;
  direct: number;
}

interface ExamPageProps {
  session: Session;
  countdown: number;
  activeSubject: {
    period: string;
    name: string;
    start: string;
    end: string;
  } | null;
  examInProgress: boolean;
  virtualSeconds: number;
  currentBell: BellEvent | null;
  controlsVisible: boolean;
  skipTargets: SkipTargets | null;
  listeningTiming: ListeningTiming;
  wakeLockStatus: WakeLockStatus;
  volume: number;
  listeningVolume: number;
  listeningResumeRequired: boolean;
  examCompleted: boolean;
  audioError: string;
  onRevealControls: () => void;
  onSkip: (target: number) => void;
  onTogglePause: () => void;
  onRequestWakeLock: () => void;
  onVolumeChange: (volume: number) => void;
  onListeningVolumeChange: (volume: number) => void;
  onExit: () => void;
  onResumeListening: () => void;
}

export function ExamPage({
  session,
  countdown,
  activeSubject,
  examInProgress,
  virtualSeconds,
  currentBell,
  controlsVisible,
  skipTargets,
  listeningTiming,
  wakeLockStatus,
  volume,
  listeningVolume,
  listeningResumeRequired,
  examCompleted,
  audioError,
  onRevealControls,
  onSkip,
  onTogglePause,
  onRequestWakeLock,
  onVolumeChange,
  onListeningVolumeChange,
  onExit,
  onResumeListening,
}: ExamPageProps) {
  const fullscreenSupported = Boolean(document.documentElement.requestFullscreen);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [displayedBellLabel, setDisplayedBellLabel] = useState(
    currentBell?.label ?? "",
  );
  const [displayedExamTime, setDisplayedExamTime] = useState(
    activeSubject
      ? `${activeSubject.start.slice(0, 5)} ~ ${activeSubject.end.slice(0, 5)}`
      : "",
  );

  useEffect(() => {
    if (currentBell) {
      setDisplayedBellLabel(currentBell.label);
      return;
    }
    const timer = window.setTimeout(() => setDisplayedBellLabel(""), 260);
    return () => window.clearTimeout(timer);
  }, [currentBell]);

  useEffect(() => {
    if (activeSubject) {
      setDisplayedExamTime(
        `${activeSubject.start.slice(0, 5)} ~ ${activeSubject.end.slice(0, 5)}`,
      );
    }
  }, [activeSubject]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  };

  return (
    <main
      className="exam"
      onMouseMove={onRevealControls}
      onTouchStart={onRevealControls}
      onClick={onRevealControls}
    >
      {countdown > 0 ? (
        <div className="countdown" key={countdown}>{countdown}</div>
      ) : (
        <>
          <header className="exam-heading">
            <h1>{activeSubject?.name ?? "시험 외 시간"}</h1>
            <div className="bell-status" aria-live="polite">
              <span
                className={`status-layer bell-label ${currentBell ? "visible" : ""}`}
                aria-hidden={!currentBell}
              >
                {displayedBellLabel}
              </span>
              <span
                className={`status-layer exam-time ${
                  !currentBell && examInProgress ? "visible" : ""
                }`}
                aria-hidden={Boolean(currentBell) || !examInProgress}
              >
                {displayedExamTime}
              </span>
            </div>
          </header>
          <AnalogClock seconds={virtualSeconds} />
          <p className="exam-period">{activeSubject?.period ?? "수능 시간표"}</p>
        </>
      )}

      <div
        className={`exam-controls ${
          (controlsVisible || Boolean(session.pausedAt)) && countdown === 0
            ? "visible"
            : ""
        }`}
      >
        {skipTargets && (
          <div className="skip-controls">
            <Button variant="outline" size="sm" onClick={() => onSkip(skipTargets.next)}>
              <SkipForward size={15} />
              다음 타종
            </Button>
            {skipTargets.next !== skipTargets.direct && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSkip(skipTargets.direct)}
              >
                <FastForward size={15} />
                {session.subjectId === "english"
                  ? listeningTiming === "before"
                    ? "듣기 시작으로"
                    : "시험 시작으로"
                  : "바로 본령"}
              </Button>
            )}
          </div>
        )}

        {session.mode !== "sync" && (
          <Button variant="outline" size="sm" onClick={onTogglePause}>
            {session.pausedAt ? "계속하기" : "일시정지"}
          </Button>
        )}
        {wakeLockStatus !== "active" && wakeLockStatus !== "unsupported" && (
          <Button variant="outline" size="sm" onClick={onRequestWakeLock}>
            <Sun size={14} />
            절전 방지
          </Button>
        )}
        {fullscreenSupported && (
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            {isFullscreen ? "전체화면 종료" : "전체화면"}
          </Button>
        )}
        <ExamVolume label="타종" value={volume} onChange={onVolumeChange} />
        {(session.mode === "sync" || session.subjectId === "english") && (
          <ExamVolume
            label="듣기"
            value={listeningVolume}
            onChange={onListeningVolumeChange}
          />
        )}
        <ExitExamDialog onExit={onExit} />
      </div>

      {session.pausedAt && (
        <div className="paused">
          <div className="paused-content">
            <span>일시정지</span>
            <Button size="lg" onClick={onTogglePause}>
              <Play size={16} fill="currentColor" />
              계속하기
            </Button>
          </div>
        </div>
      )}
      {listeningResumeRequired && !session.pausedAt && (
        <div className="listening-resume">
          <Button size="sm" onClick={onResumeListening}>
            <Play size={14} fill="currentColor" />
            영어 듣기 계속하기
          </Button>
        </div>
      )}
      {wakeLockStatus === "unsupported" && (
        <div className="wake-warning">
          <TriangleAlert size={14} />
          이 브라우저에서는 절전 방지를 지원하지 않습니다. 화면 자동 잠금을 꺼주세요.
        </div>
      )}
      {audioError && <div className="exam-error">{audioError}</div>}
      <ExamCompletedDialog
        open={examCompleted}
        subjectName={activeSubject?.name ?? "시험"}
        onReturn={onExit}
      />
    </main>
  );
}

function ExamVolume({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="compact-volume">
      {label}
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
    </label>
  );
}

function ExitExamDialog({ onExit }: { onExit: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">시험 종료</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>시험을 종료할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            현재 진행 상태가 삭제되고 시작 화면으로 돌아갑니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>계속 응시</AlertDialogCancel>
          <AlertDialogAction onClick={onExit}>시험 종료</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ExamCompletedDialog({
  open,
  subjectName,
  onReturn,
}: {
  open: boolean;
  subjectName: string;
  onReturn: () => void;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>시험이 종료되었습니다</AlertDialogTitle>
          <AlertDialogDescription>
            {subjectName} 시험이 모두 끝났습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onReturn}>
            시작 화면으로 돌아가기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
