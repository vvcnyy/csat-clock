export type SubjectId =
  | "korean"
  | "math"
  | "english"
  | "history"
  | "inquiry1"
  | "inquiry2"
  | "inquiryBoth"
  | "secondLanguage";

export type EventKind =
  | "entry"
  | "preliminary"
  | "prepare"
  | "start"
  | "warning"
  | "end";

export interface BellEvent {
  id: string;
  at: string;
  subject: SubjectId;
  kind: EventKind;
  label: string;
  file: string;
  syncOnly?: boolean;
  atSeconds?: number;
  shortFile?: string;
}

export interface Subject {
  id: SubjectId;
  period: string;
  name: string;
  start: string;
  end: string;
}

export const subjects: Subject[] = [
  { id: "korean", period: "1교시", name: "국어", start: "08:40:00", end: "10:00:00" },
  { id: "math", period: "2교시", name: "수학", start: "10:30:00", end: "12:10:00" },
  { id: "english", period: "3교시", name: "영어", start: "13:10:00", end: "14:20:00" },
  { id: "history", period: "4교시", name: "한국사", start: "14:50:00", end: "15:20:00" },
  { id: "inquiry1", period: "4교시", name: "탐구 1", start: "15:35:00", end: "16:05:00" },
  { id: "inquiry2", period: "4교시", name: "탐구 2", start: "16:07:00", end: "16:37:00" },
  { id: "secondLanguage", period: "5교시", name: "제2외국어/한문", start: "17:05:00", end: "17:45:00" },
];

export const subjectChoices: Subject[] = [
  ...subjects.slice(0, 5),
  subjects[5],
  { id: "inquiryBoth", period: "4교시", name: "탐구 1·2 연속", start: "15:35:00", end: "16:37:00" },
  subjects[6],
];

const event = (
  id: string,
  at: string,
  subject: SubjectId,
  kind: EventKind,
  label: string,
  file: string,
  syncOnly = false,
  shortFile?: string,
): BellEvent => ({ id, at: `${at}:00`, subject, kind, label, file, syncOnly, shortFile });

// 타종 시각과 음원은 이 배열 한 곳에서 변경합니다.
export const bellEvents: BellEvent[] = [
  event("001", "08:05", "korean", "entry", "1교시 입실 준비", "001_korean_entry_prepare.mp3", true),
  event("002", "08:10", "korean", "entry", "1교시 입실 완료", "002_korean_entry_complete.mp3", true),
  event("003", "08:25", "korean", "preliminary", "예비령", "003_korean_preliminary.mp3"),
  event("004", "08:35", "korean", "prepare", "준비령", "004_korean_prepare.mp3"),
  event("005", "08:40", "korean", "start", "본령", "005_korean_start.mp3"),
  event("006", "09:50", "korean", "warning", "종료 10분 전", "006_korean_10min_warning.mp3"),
  event("007", "10:00", "korean", "end", "종료령", "007_korean_end.mp3", false, "007_korean_end_short.mp3"),
  event("008", "10:15", "math", "entry", "2교시 입실", "008_math_entry.mp3", true),
  event("009", "10:20", "math", "preliminary", "예비령", "009_math_preliminary.mp3"),
  event("010", "10:25", "math", "prepare", "준비령", "010_math_prepare.mp3"),
  event("011", "10:30", "math", "start", "본령", "011_math_start.mp3"),
  event("012", "12:00", "math", "warning", "종료 10분 전", "012_math_10min_warning.mp3"),
  event("013", "12:10", "math", "end", "종료령", "013_math_end.mp3", false, "013_math_end_short.mp3"),
  event("014", "12:55", "english", "entry", "3교시 입실", "014_english_entry.mp3", true),
  event("015", "13:00", "english", "preliminary", "예비령", "015_english_preliminary.mp3"),
  event("016", "13:05", "english", "prepare", "준비령", "016_english_prepare.mp3"),
  event("017", "14:10", "english", "warning", "종료 10분 전", "017_english_10min_warning.mp3"),
  event("018", "14:20", "english", "end", "종료령", "018_english_end.mp3", false, "018_english_end_short.mp3"),
  event("019", "14:35", "history", "entry", "4교시 입실", "019_history_entry.mp3", true),
  event("020", "14:40", "history", "preliminary", "예비령", "020_history_preliminary.mp3"),
  event("021", "14:45", "history", "prepare", "준비령", "021_history_prepare.mp3"),
  event("022", "14:50", "history", "start", "본령", "022_history_start.mp3"),
  event("023", "15:15", "history", "warning", "종료 5분 전", "023_history_5min_warning.mp3"),
  event("024", "15:20", "history", "end", "종료령", "024_history_end.mp3", false, "024_history_end_short.mp3"),
  event("025", "15:30", "inquiry1", "prepare", "탐구 준비령", "025_inquiry_prepare.mp3"),
  event("026", "15:35", "inquiry1", "start", "탐구 첫째 본령", "026_inquiry1_start.mp3"),
  event("027", "16:00", "inquiry1", "warning", "종료 5분 전", "027_inquiry1_5min_warning.mp3"),
  event("028", "16:05", "inquiry1", "end", "탐구 첫째 종료령", "028_inquiry1_end.mp3", false, "028_inquiry1_end_short.mp3"),
  event("029", "16:07", "inquiry2", "start", "탐구 둘째 본령", "029_inquiry2_start.mp3"),
  event("030", "16:32", "inquiry2", "warning", "종료 5분 전", "030_inquiry2_5min_warning.mp3"),
  event("031", "16:37", "inquiry2", "end", "탐구 둘째 종료령", "031_inquiry2_end.mp3", false, "031_inquiry2_end_short.mp3"),
  event("032", "16:50", "secondLanguage", "entry", "5교시 입실", "032_second_language_entry.mp3", true),
  event("033", "16:55", "secondLanguage", "preliminary", "예비령", "033_second_language_preliminary.mp3"),
  event("034", "17:00", "secondLanguage", "prepare", "준비령", "034_second_language_prepare.mp3"),
  event("035", "17:05", "secondLanguage", "start", "본령", "035_second_language_start.mp3"),
  event("036", "17:35", "secondLanguage", "warning", "종료 10분 전", "036_second_language_10min_warning.mp3"),
  event("037", "17:45", "secondLanguage", "end", "종료령 · 시험장 종료", "037_second_language_end_final.mp3", false, "037_second_language_end_final_short.mp3"),
];

export const toSeconds = (time: string) => {
  const [hour, minute, second] = time.split(":").map(Number);
  return hour * 3600 + minute * 60 + second;
};

export const getBellSeconds = (event: BellEvent) =>
  event.atSeconds ?? toSeconds(event.at);

export const formatClockTime = (totalSeconds: number, includeSeconds = true) => {
  const normalized = ((Math.floor(totalSeconds) % 86400) + 86400) % 86400;
  const hour = Math.floor(normalized / 3600);
  const minute = Math.floor((normalized % 3600) / 60);
  const second = normalized % 60;
  const base = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return includeSeconds
    ? `${base}:${String(second).padStart(2, "0")}`
    : base;
};

export const customEvents = (
  startSeconds: number,
  durationMinutes: number,
): BellEvent[] => {
  const endSeconds = startSeconds + durationMinutes * 60;
  const events: BellEvent[] = [
    {
      id: "038",
      at: formatClockTime(startSeconds),
      atSeconds: startSeconds,
      subject: "korean",
      kind: "start",
      label: "본령",
      file: "038_custom_start.mp3",
    },
  ];
  if (durationMinutes >= 15) {
    const warningSeconds = endSeconds - 10 * 60;
    events.push({
      id: "039",
      at: formatClockTime(warningSeconds),
      atSeconds: warningSeconds,
      subject: "korean",
      kind: "warning",
      label: "종료 10분 전",
      file: "039_custom_10min_warning.mp3",
    });
  }
  events.push({
    id: "040",
    at: formatClockTime(endSeconds),
    atSeconds: endSeconds,
    subject: "korean",
    kind: "end",
    label: "종료령",
    file: "040_custom_end.mp3",
  });
  return events;
};

export const getSubject = (id: SubjectId) =>
  id === "inquiryBoth"
    ? subjectChoices.find((subject) => subject.id === id)!
    : subjects.find((subject) => subject.id === id)!;

export const eventsForSubject = (id: SubjectId) =>
  bellEvents.filter(
    (item) =>
      !item.syncOnly &&
      (id === "inquiryBoth"
        ? item.subject === "inquiry1" || item.subject === "inquiry2"
        : item.subject === id),
  );
