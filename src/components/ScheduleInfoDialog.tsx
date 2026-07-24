import { Info } from "lucide-react";
import { bellEvents, getSubject } from "../schedule";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

const timetableRows = [
  ["1교시 국어", "08:40–10:00"],
  ["휴식", "10:00–10:20"],
  ["2교시 수학", "10:30–12:10"],
  ["점심시간", "12:10–13:00"],
  ["3교시 영어", "13:10–14:20"],
  ["휴식", "14:20–14:40"],
  ["4교시 한국사", "14:50–15:20"],
  ["한국사 회수·탐구 배부", "15:20–15:35"],
  ["탐구 1", "15:35–16:05"],
  ["탐구 회수", "16:05–16:07"],
  ["탐구 2", "16:07–16:37"],
  ["휴식", "16:37–16:55"],
  ["5교시 제2외국어/한문", "17:05–17:45"],
] as const;

export function ScheduleInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="schedule-trigger" variant="ghost" size="sm">
          <Info size={15} />
          수능 시간표 및 타종 안내
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>수능 시간표 및 타종</DialogTitle>
          <DialogDescription>
            현재 시각 동기화 모드에서 아래 시각에 맞춰 시험과 타종이 진행됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="schedule-dialog-body">
          <section>
            <h2>시험 시간표</h2>
            <div className="schedule-list">
              {timetableRows.map(([label, time]) => (
                <div className="schedule-row" key={`${label}-${time}`}>
                  <span>{label}</span>
                  <time>{time}</time>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2>타종 시각</h2>
            <div className="bell-list">
              {bellEvents.map((bell) => (
                <div className="bell-row" key={bell.id}>
                  <time>{bell.at.slice(0, 5)}</time>
                  <span>{bell.label}</span>
                  <small>{getSubject(bell.subject).name}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
