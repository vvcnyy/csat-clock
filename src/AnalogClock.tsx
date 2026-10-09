import type { ExamBookmark } from "./exam-types";
import { formatClockTime } from "./schedule";

interface AnalogClockProps {
  seconds: number;
  endMarkerMinute?: number | null;
  bookmarks?: ExamBookmark[];
}

export default function AnalogClock({ seconds, endMarkerMinute, bookmarks = [] }: AnalogClockProps) {
  const wholeSeconds = Math.floor(seconds);
  const second = wholeSeconds % 60;
  const minute = (wholeSeconds / 60) % 60;
  const hour = (wholeSeconds / 3600) % 12;
  const bookmarkGroups = new Map<number, { bookmark: ExamBookmark; number: number }[]>();
  bookmarks.forEach((bookmark, index) => {
    const minute = Math.floor(bookmark.clockSeconds / 60) % 60;
    const group = bookmarkGroups.get(minute) ?? [];
    group.push({ bookmark, number: index + 1 });
    bookmarkGroups.set(minute, group);
  });

  return (
    <div
      className="clock"
      role="img"
      aria-label={`아날로그 시계, ${formatClockTime(seconds)}${endMarkerMinute != null ? `, ${endMarkerMinute}분 위치에 종료령 표시` : ""}${bookmarks.length ? `, 북마크 ${bookmarks.length}개` : ""}`}
    >
      {Array.from({ length: 60 }, (_, index) => (
        <span
          className={`tick${index % 5 === 0 ? " tick-major" : ""}${
            endMarkerMinute === index ? " tick-end" : ""
          }`}
          key={index}
          style={{ transform: `rotate(${index * 6}deg)` }}
        />
      ))}
      {Array.from({ length: 12 }, (_, index) => (
        <span
          className="clock-number"
          key={index}
          style={{
            left: `${50 + 39 * Math.sin((index * Math.PI) / 6)}%`,
            top: `${50 - 39 * Math.cos((index * Math.PI) / 6)}%`,
          }}
        >
          {index === 0 ? 12 : index}
        </span>
      ))}
      <span className="hand hour" style={{ transform: `rotate(${hour * 30}deg)` }} />
      <span className="hand minute" style={{ transform: `rotate(${minute * 6}deg)` }} />
      <span className="hand second" style={{ transform: `rotate(${second * 6}deg)` }} />
      <span className="clock-pin" />
      {Array.from(bookmarkGroups, ([minute, group], index) => {
        const angle = (minute / 60) * 2 * Math.PI;
        const radius = index % 2 === 0 ? 46 : 54;
        return (
          <span
            className="clock-bookmark"
            key={minute}
            title={group.map(({ bookmark, number }) => `북마크 ${number} · ${bookmark.subjectName} · ${formatClockTime(bookmark.clockSeconds)}`).join("\n")}
            style={{ left: `${50 + radius * Math.sin(angle)}%`, top: `${50 - radius * Math.cos(angle)}%` }}
          >
            {group[0].number}{group.length > 1 && <sup>+{group.length - 1}</sup>}
          </span>
        );
      })}
    </div>
  );
}
