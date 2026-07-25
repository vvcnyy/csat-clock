import type { SubjectId } from "./schedule";

export type Mode = "sync" | "subject" | "custom";
export type ListeningTiming = "before" | "start";
export type CustomStartMode = "now" | "specific";

export interface Session {
  mode: Mode;
  subjectId?: SubjectId;
  startedAt: number;
  countdownUntil?: number;
  pausedAt?: number;
  pausedTotal: number;
  volume: number;
  listeningVolume: number;
  listeningTiming: ListeningTiming;
  customDurationMinutes?: number;
  customStartSeconds?: number;
}

export const SESSION_KEY = "mogo-clock-session";
export const SETTINGS_KEY = "mogo-clock-settings";
export const COUNTDOWN_SECONDS = 5;
export const EXAM_COMPLETION_DELAY_SECONDS = 5 * 60;

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
