import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "./ui/button";

export interface AudioDebugLog {
  id: number;
  time: string;
  message: string;
}

export function AudioDebugPanel({
  logs,
  onClear,
}: {
  logs: AudioDebugLog[];
  onClear: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [logs.length]);

  return (
    <aside className="audio-debug-panel" aria-label="오디오 디버그 로그">
      <div className="audio-debug-heading">
        <strong>오디오 로그</strong>
        <Button variant="ghost" size="icon" onClick={onClear} aria-label="오디오 로그 지우기">
          <Trash2 size={15} />
        </Button>
      </div>
      <div className="audio-debug-list">
        {logs.length === 0 ? (
          <p className="audio-debug-empty">로그 대기 중…</p>
        ) : logs.map((log) => (
          <div className="audio-debug-row" key={log.id}>
            <time>{log.time}</time>
            <span>{log.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </aside>
  );
}
