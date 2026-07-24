import type { SubjectId } from "./schedule";

export type Mode = "sync" | "subject";
export type ListeningTiming = "before" | "start";

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
