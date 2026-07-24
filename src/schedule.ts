export type SubjectId =
  | "korean"
  | "math"
  | "english"
  | "history"
  | "inquiry1"
  | "inquiry2"
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

const event = (
  id: string,
  at: string,
  subject: SubjectId,
  kind: EventKind,
  label: string,
  file: string,
  syncOnly = false,
): BellEvent => ({ id, at: `${at}:00`, subject, kind, label, file, syncOnly });

// 타종 시각과 음원은 이 배열 한 곳에서 변경합니다.
export const bellEvents: BellEvent[] = [
  event("001", "08:05", "korean", "entry", "1교시 입실 준비", "001 0805 1교시 입실준비.mp3", true),
  event("002", "08:10", "korean", "entry", "1교시 입실 완료", "002 0810 1교시 입실완료.mp3", true),
  event("003", "08:25", "korean", "preliminary", "예비령", "003 0825 1교시 예비령.mp3"),
  event("004", "08:35", "korean", "prepare", "준비령", "004 0835 1교시 준비령.mp3"),
  event("005", "08:40", "korean", "start", "본령", "005 0840 1교시 본령.mp3"),
  event("006", "09:50", "korean", "warning", "종료 10분 전", "006 0950 1교시 종료10분전.mp3"),
  event("007", "10:00", "korean", "end", "종료령", "007 1000 1교시 종료령.mp3"),
  event("008", "10:15", "math", "entry", "2교시 입실", "008 1015 2교시 입실.mp3", true),
  event("009", "10:20", "math", "preliminary", "예비령", "009 1020 2교시 예비령.mp3"),
  event("010", "10:25", "math", "prepare", "준비령", "010 1025 2교시 준비령.mp3"),
  event("011", "10:30", "math", "start", "본령", "011 1030 2교시 본령.mp3"),
  event("012", "12:00", "math", "warning", "종료 10분 전", "012 1200 2교시 종료10분전.mp3"),
  event("013", "12:10", "math", "end", "종료령", "013 1210 2교시 종료령.mp3"),
  event("014", "12:55", "english", "entry", "3교시 입실", "014 1255 3교시 입실.mp3", true),
  event("015", "13:00", "english", "preliminary", "예비령", "015 1300 3교시 예비령.mp3"),
  event("016", "13:05", "english", "prepare", "준비령", "016 1305 3교시 준비령.mp3"),
  event("017", "14:10", "english", "warning", "종료 10분 전", "017 1410 3교시 종료10분전.mp3"),
  event("018", "14:20", "english", "end", "종료령", "018 1420 3교시 종료령.mp3"),
  event("019", "14:35", "history", "entry", "4교시 입실", "019 1435 4교시 입실.mp3", true),
  event("020", "14:40", "history", "preliminary", "예비령", "020 1440 4교시 한국사 예비령.mp3"),
  event("021", "14:45", "history", "prepare", "준비령", "021 1445 4교시 한국사 준비령.mp3"),
  event("022", "14:50", "history", "start", "본령", "022 1450 4교시 한국사 본령.mp3"),
  event("023", "15:15", "history", "warning", "종료 5분 전", "023 1515 4교시 한국사 종료5분전.mp3"),
  event("024", "15:20", "history", "end", "종료령", "024 1520 4교시 한국사 종료령.mp3"),
  event("025", "15:30", "inquiry1", "prepare", "탐구 준비령", "025 1530 4교시 탐구 준비령.mp3"),
  event("026", "15:35", "inquiry1", "start", "탐구 첫째 본령", "026 1535 4교시 탐구 첫째본령.mp3"),
  event("027", "16:00", "inquiry1", "warning", "종료 5분 전", "027 1600 4교시 탐구 첫째종료5분전.mp3"),
  event("028", "16:05", "inquiry1", "end", "탐구 첫째 종료령", "028 1605 4교시 탐구 첫째종료령.mp3"),
  event("029", "16:07", "inquiry2", "start", "탐구 둘째 본령", "029 1607 4교시 탐구 둘째본령.mp3"),
  event("030", "16:32", "inquiry2", "warning", "종료 5분 전", "030 1632 4교시 탐구 둘째종료5분전.mp3"),
  event("031", "16:37", "inquiry2", "end", "탐구 둘째 종료령", "031 1637 4교시 탐구 둘째종료령.mp3"),
  event("032", "16:50", "secondLanguage", "entry", "5교시 입실", "032 1650 5교시 입실.mp3", true),
  event("033", "16:55", "secondLanguage", "preliminary", "예비령", "033 1655 5교시 예비령.mp3"),
  event("034", "17:00", "secondLanguage", "prepare", "준비령", "034 1700 5교시 준비령.mp3"),
  event("035", "17:05", "secondLanguage", "start", "본령", "035 1705 5교시 본령.mp3"),
  event("036", "17:35", "secondLanguage", "warning", "종료 10분 전", "036 1735 5교시 종료10분전.mp3"),
  event("037", "17:45", "secondLanguage", "end", "종료령 · 시험장 종료", "037 1745 5교시 종료령 시험장종료.mp3"),
];

export const toSeconds = (time: string) => {
  const [hour, minute, second] = time.split(":").map(Number);
  return hour * 3600 + minute * 60 + second;
};

export const getSubject = (id: SubjectId) =>
  subjects.find((subject) => subject.id === id)!;

export const eventsForSubject = (id: SubjectId) =>
  bellEvents.filter((item) => item.subject === id && !item.syncOnly);
