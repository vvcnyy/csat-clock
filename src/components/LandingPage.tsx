import {
  BookOpenCheck,
  Clock3,
  Pause,
  Play,
  TimerReset,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type {
  CustomStartMode,
  ListeningTiming,
  Mode,
} from "../exam-types";
import { subjects, type SubjectId } from "../schedule";
import { ScheduleInfoDialog } from "./ScheduleInfoDialog";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";

interface LandingPageProps {
  mode: Mode;
  subjectId: SubjectId;
  volume: number;
  listeningVolume: number;
  listeningTiming: ListeningTiming;
  customDurationMinutes: number;
  customStartMode: CustomStartMode;
  customStartTime: string;
  englishFile?: File;
  previewing: boolean;
  listeningPreviewing: boolean;
  audioError: string;
  onModeChange: (mode: Mode) => void;
  onSubjectChange: (subject: SubjectId) => void;
  onVolumeChange: (volume: number) => void;
  onListeningVolumeChange: (volume: number) => void;
  onListeningTimingChange: (timing: ListeningTiming) => void;
  onCustomDurationChange: (minutes: number) => void;
  onCustomStartModeChange: (mode: CustomStartMode) => void;
  onCustomStartTimeChange: (time: string) => void;
  onChooseEnglishFile: (file?: File) => void;
  onRemoveEnglishFile: () => void;
  onTestBell: () => void;
  onTestListening: () => void;
  onStart: () => void;
}

export function LandingPage({
  mode,
  subjectId,
  volume,
  listeningVolume,
  listeningTiming,
  customDurationMinutes,
  customStartMode,
  customStartTime,
  englishFile,
  previewing,
  listeningPreviewing,
  audioError,
  onModeChange,
  onSubjectChange,
  onVolumeChange,
  onListeningVolumeChange,
  onListeningTimingChange,
  onCustomDurationChange,
  onCustomStartModeChange,
  onCustomStartTimeChange,
  onChooseEnglishFile,
  onRemoveEnglishFile,
  onTestBell,
  onTestListening,
  onStart,
}: LandingPageProps) {
  const englishNeeded =
    mode === "sync" || (mode === "subject" && subjectId === "english");
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const startLabel =
    mode === "sync"
      ? "시간 동기화 시작"
      : mode === "subject"
        ? `${selectedSubject?.name ?? "과목"} 시험 시작`
        : `${customDurationMinutes || 0}분 시험 시작`;

  return (
    <main className="landing">
      <Card className="setup-card">
        <CardHeader>
          <img
            className="brand-mark"
            src="/favicon.png"
            alt=""
            width={44}
            height={44}
          />
          <div>
            <CardTitle>수능시계</CardTitle>
            <CardDescription>수능 시간표와 실제 타종으로 연습합니다.</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <div className="field">
            <span className="field-label">응시 방식</span>
            <div className="mode-tabs" role="tablist" aria-label="응시 방식">
              <button
                className={`mode-tab ${mode === "sync" ? "active" : ""}`}
                onClick={() => onModeChange("sync")}
                role="tab"
                aria-selected={mode === "sync"}
              >
                <Clock3 size={17} />
                <span>시간 동기화</span>
              </button>
              <button
                className={`mode-tab ${mode === "subject" ? "active" : ""}`}
                onClick={() => onModeChange("subject")}
                role="tab"
                aria-selected={mode === "subject"}
              >
                <BookOpenCheck size={17} />
                <span>과목 선택</span>
              </button>
              <button
                className={`mode-tab ${mode === "custom" ? "active" : ""}`}
                onClick={() => onModeChange("custom")}
                role="tab"
                aria-selected={mode === "custom"}
              >
                <TimerReset size={17} />
                <span>자유 설정</span>
              </button>
            </div>
            <p className="mode-description">
              {mode === "sync"
                ? "현재 시각을 기준으로 전체 수능 시간표와 타종을 재현합니다."
                : mode === "subject"
                  ? "원하는 수능 과목 하나를 실제 시험 시간과 타종으로 응시합니다."
                  : "시험 시간을 직접 정합니다."}
            </p>
          </div>

          {mode === "subject" && (
            <div className="field">
              <span className="field-label">응시 과목</span>
              <Select
                value={subjectId}
                onValueChange={(value) => onSubjectChange(value as SubjectId)}
              >
                <SelectTrigger aria-label="응시 과목">
                  <SelectValue className="ui-select-value" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem value={subject.id} key={subject.id}>
                      {subject.period} · {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "custom" && (
            <div className="custom-settings">
              <div className="field">
                <label className="field-label" htmlFor="custom-duration">
                  시험 시간
                </label>
                <div className="duration-input">
                  <input
                    id="custom-duration"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={customDurationMinutes}
                    onChange={(event) =>
                      onCustomDurationChange(Number(event.target.value))
                    }
                  />
                  <span>분</span>
                </div>
                <p className="field-help">
                  15분 이상 설정하면 종료 10분 전 타종이 추가됩니다.
                </p>
              </div>
              <div className="field custom-start-field">
                <span className="field-label">시계 시작 시각</span>
                <div className="mode-grid">
                  <button
                    className={`mode-option compact ${
                      customStartMode === "now" ? "active" : ""
                    }`}
                    onClick={() => onCustomStartModeChange("now")}
                  >
                    현재 시각부터
                  </button>
                  <button
                    className={`mode-option compact ${
                      customStartMode === "specific" ? "active" : ""
                    }`}
                    onClick={() => onCustomStartModeChange("specific")}
                  >
                    특정 시각부터
                  </button>
                </div>
                {customStartMode === "specific" && (
                  <input
                    className="time-input"
                    type="time"
                    value={customStartTime}
                    onChange={(event) => onCustomStartTimeChange(event.target.value)}
                    aria-label="시계 시작 시각"
                  />
                )}
              </div>
            </div>
          )}

          {englishNeeded && (
            <div className="english-settings">
              <div className="field">
                <span className="field-label">영어 듣기 시작</span>
                <div className="mode-grid">
                  <button
                    className={`mode-option compact ${listeningTiming === "before" ? "active" : ""}`}
                    onClick={() => onListeningTimingChange("before")}
                  >
                    시험 3분 전
                  </button>
                  <button
                    className={`mode-option compact ${listeningTiming === "start" ? "active" : ""}`}
                    onClick={() => onListeningTimingChange("start")}
                  >
                    시험 시작 시
                  </button>
                </div>
              </div>
              <div className="field english-file-field">
                <span className="field-label">영어 듣기 음원</span>
                <div className="file-row">
                  <label className="file-picker">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(event) => onChooseEnglishFile(event.target.files?.[0])}
                    />
                    <Upload size={16} />
                    <span>{englishFile?.name ?? "듣기 파일 선택"}</span>
                  </label>
                  {englishFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="듣기 파일 선택 해제"
                      title="파일 선택 해제"
                      onClick={onRemoveEnglishFile}
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              </div>
              <div className="listening-volume">
                <VolumeControl
                  label="영어 듣기 음량"
                  value={listeningVolume}
                  onChange={onListeningVolumeChange}
                  onTest={onTestListening}
                  testing={listeningPreviewing}
                  testDisabled={!englishFile}
                />
              </div>
            </div>
          )}

          <div className="field volume-field">
            <VolumeControl
              label="타종 음량"
              value={volume}
              onChange={onVolumeChange}
              onTest={onTestBell}
              testing={previewing}
            />
          </div>
          {audioError && <p className="error">{audioError}</p>}
        </CardContent>

        <CardFooter>
          <Button size="lg" onClick={onStart}>
            {startLabel}
          </Button>
        </CardFooter>
      </Card>

      <ScheduleInfoDialog />
      <footer className="copyright">
        © 2026 vvcnyy. 개인 학습용 서비스이며, 업로드한 음원의 저작권과
        이용 책임은 사용자에게 있습니다.
        <br/>
        이용 문의 : me@vvcnyy.me
      </footer>
    </main>
  );
}

interface VolumeControlProps {
  label: string;
  value: number;
  testing: boolean;
  testDisabled?: boolean;
  onChange: (value: number) => void;
  onTest: () => void;
}

function VolumeControl({
  label,
  value,
  testing,
  testDisabled,
  onChange,
  onTest,
}: VolumeControlProps) {
  return (
    <>
      <div className="field-heading">
        <span className="field-label">{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="volume-controls">
        {value === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[value]}
          onValueChange={([next]) => onChange(next)}
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testDisabled}
          onClick={onTest}
        >
          {testing ? <Pause size={14} /> : <Play size={14} />}
          {testing ? "정지" : "확인"}
        </Button>
      </div>
    </>
  );
}
