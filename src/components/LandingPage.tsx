import { Check, Pause, Play, Upload, Volume2, VolumeX, X } from "lucide-react";
import type { ListeningTiming, Mode } from "../exam-types";
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
  englishFile?: File;
  previewing: boolean;
  listeningPreviewing: boolean;
  audioError: string;
  onModeChange: (mode: Mode) => void;
  onSubjectChange: (subject: SubjectId) => void;
  onVolumeChange: (volume: number) => void;
  onListeningVolumeChange: (volume: number) => void;
  onListeningTimingChange: (timing: ListeningTiming) => void;
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
  englishFile,
  previewing,
  listeningPreviewing,
  audioError,
  onModeChange,
  onSubjectChange,
  onVolumeChange,
  onListeningVolumeChange,
  onListeningTimingChange,
  onChooseEnglishFile,
  onRemoveEnglishFile,
  onTestBell,
  onTestListening,
  onStart,
}: LandingPageProps) {
  const englishNeeded =
    mode === "sync" || (mode === "subject" && subjectId === "english");

  return (
    <main className="landing">
      <Card className="setup-card">
        <CardHeader>
          <div className="brand-mark">M</div>
          <div>
            <CardTitle>모고시계</CardTitle>
            <CardDescription>수능 시간표와 실제 타종으로 연습합니다.</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <div className="field">
            <span className="field-label">응시 모드</span>
            <div className="mode-grid">
              <button
                className={`mode-option ${mode === "sync" ? "active" : ""}`}
                onClick={() => onModeChange("sync")}
              >
                <span>현재 시각 동기화 (전체 응시)</span>
                {mode === "sync" && <Check size={16} />}
              </button>
              <button
                className={`mode-option ${mode === "subject" ? "active" : ""}`}
                onClick={() => onModeChange("subject")}
              >
                <span>과목별 응시</span>
                {mode === "subject" && <Check size={16} />}
              </button>
            </div>
            <p className="field-help">
              {mode === "sync"
                ? "날짜와 관계없이 현재 시각의 수능 일정에 맞춥니다."
                : "선택 과목을 5초 카운트다운 후 독립적으로 시작합니다."}
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
            {mode === "sync" ? "동기화 시작" : "시험 시작"}
          </Button>
        </CardFooter>
      </Card>

      <ScheduleInfoDialog />
      <footer className="copyright">
        © 2026 Mogo Clock. 개인 학습용 서비스이며, 업로드한 음원의 저작권과
        이용 책임은 사용자에게 있습니다.
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
