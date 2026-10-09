import type { SubjectId } from "./schedule";

export type Mode = "sync" | "subject" | "custom";
export type ListeningTiming = "before" | "start";
export type CustomStartMode = "now" | "specific";

export interface ExamBookmark {
  id: string;
  clockSeconds: number;
  subjectName: string;
  period: string;
  examElapsedSeconds: number;
  elapsedSeconds: number;
}

export interface ExamCompletion {
  endedAt: number;
  clockSeconds: number;
  reason: "finished" | "manual";
}

export interface Session {
  mode: Mode;
  syncWithCurrentTime?: boolean;
  scheduleStartSeconds?: number;
  subjectId?: SubjectId;
  startedAt: number;
  // Unlike startedAt (the virtual timeline anchor), this never changes on skip.
  actualStartedAt?: number;
  bookmarks?: ExamBookmark[];
  completion?: ExamCompletion;
  countdownUntil?: number;
  pausedAt?: number;
  pausedTotal: number;
  volume: number;
  listeningVolume: number;
  listeningTiming: ListeningTiming;
  startAtMainBell?: boolean;
  customDurationMinutes?: number;
  customStartSeconds?: number;
}

export const SESSION_KEY = "mogo-clock-session";
export const SETTINGS_KEY = "mogo-clock-settings";
export const COUNTDOWN_SECONDS = 5;

export const secondsNow = () => {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
};

export const readJson = <T,>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};
