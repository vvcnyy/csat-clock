import AnalogClock from "../AnalogClock";
import type { Session } from "../exam-types";
import { formatDuration, getSessionTiming } from "../exam-summary";
import { formatClockTime, subjects, toSeconds } from "../schedule";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface Props {
  open: boolean;
  session: Session;
  examStartSeconds: number;
  examEndSeconds: number;
  selectedSubject: { name: string; period: string; start: string; end: string };
  onReturn: () => void;
}

export function ExamCompletedDialog({ open, session, examStartSeconds, examEndSeconds, selectedSubject, onReturn }: Props) {
  const completion = session.completion;
  if (!completion) return null;
  const bookmarks = session.bookmarks ?? [];
  const timing = getSessionTiming(session, completion.endedAt);
  const fullSchedule = session.mode === "sync";
  const subjectName = fullSchedule ? "전체 시험" : selectedSubject.name;
  const examDurationSeconds = fullSchedule
    ? subjects.reduce((total, subject) => total + Math.max(0, toSeconds(subject.end) - Math.max(examStartSeconds, toSeconds(subject.start))), 0)
    : examEndSeconds - examStartSeconds;
  const elapsedTime = [
    Math.floor(timing.elapsedSeconds / 3600),
    String(Math.floor(timing.elapsedSeconds / 60) % 60).padStart(2, "0"),
    String(timing.elapsedSeconds % 60).padStart(2, "0"),
  ].join(":");

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="exam-completed-dialog">
        <div className="exam-summary">
          <AlertDialogHeader className="exam-summary-heading">
            <div className="summary-title-row">
              <AlertDialogTitle>시험 종료</AlertDialogTitle>
              {completion.reason === "manual" && <Badge variant="outline">중도 종료</Badge>}
            </div>
            <AlertDialogDescription>
              {subjectName} · {formatClockTime(examStartSeconds, false)}–{formatClockTime(examEndSeconds, false)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Separator />

          <div className="exam-summary-body" data-has-bookmarks={bookmarks.length > 0}>
            <section className="exam-summary-clock" aria-label="종료 시각과 북마크 시계">
              <AnalogClock seconds={completion.clockSeconds} bookmarks={bookmarks} />
              <p className="summary-clock-time"><span>종료</span><time>{formatClockTime(completion.clockSeconds)}</time></p>
            </section>

            <div className="exam-summary-details">
              <Card className="summary-info-card">
                <CardContent>
                  <dl className="exam-summary-stats">
                    <div>
                      <dt>시험 시간</dt>
                      <dd>{Math.round(examDurationSeconds / 60)}<span>분</span></dd>
                    </div>
                    <div>
                      <dt>소요 시간 <span>일시정지 포함</span></dt>
                      <dd aria-label={formatDuration(timing.elapsedSeconds)}>{elapsedTime}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {bookmarks.length > 0 && (
                <Card className="summary-bookmarks">
                  <CardHeader>
                    <CardTitle as="h2" id="summary-bookmarks-title">북마크</CardTitle>
                    <Badge variant="secondary">{bookmarks.length}개</Badge>
                  </CardHeader>
                  <CardContent>
                    <Table aria-labelledby="summary-bookmarks-title">
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col" className="bookmark-index">번호</TableHead>
                          {fullSchedule && <TableHead scope="col">과목</TableHead>}
                          <TableHead scope="col" className="bookmark-time">시각</TableHead>
                          <TableHead scope="col" className="bookmark-elapsed">경과</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookmarks.map((bookmark, index) => (
                          <TableRow key={bookmark.id}>
                            <TableCell className="bookmark-index">{index + 1}</TableCell>
                            {fullSchedule && <TableCell>{bookmark.subjectName}</TableCell>}
                            <TableCell className="bookmark-time"><time>{formatClockTime(bookmark.clockSeconds)}</time></TableCell>
                            <TableCell className="bookmark-elapsed">
                              {formatDuration(bookmark.examElapsedSeconds)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Separator />
          <footer className="exam-summary-footer">
            <Button onClick={onReturn}>나가기</Button>
          </footer>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
