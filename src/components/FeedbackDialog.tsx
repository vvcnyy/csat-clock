import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export function FeedbackDialog() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;
    setStatus("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, contact: contact.trim() }),
      });
      if (!response.ok) throw new Error("request failed");
      setMessage("");
      setContact("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Dialog onOpenChange={(open) => { if (open) setStatus("idle"); }}>
      <DialogTrigger asChild>
        <Button className="schedule-trigger" variant="ghost" size="sm">
          <MessageSquare size={15} />
          의견 보내기
        </Button>
      </DialogTrigger>
      <DialogContent className="feedback-dialog-content">
        <DialogHeader>
          <DialogTitle>의견 보내기</DialogTitle>
          <DialogDescription>서비스 사용 중 불편한 점이나 제안사항을 보내주세요.</DialogDescription>
        </DialogHeader>
        <div className="feedback-form">
          <label>
            <span className="feedback-label">의견 <b aria-hidden="true">*</b></span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="내용을 입력해 주세요" rows={6} />
            <span className="feedback-count">{message.length}/2,000</span>
          </label>
          <label>
            <span className="feedback-label">회신받을 연락처 <small>선택</small></span>
            <input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={200} placeholder="이메일 주소" />
          </label>
          {status === "sent" && <p className="feedback-success">의견이 전송되었습니다.</p>}
          {status === "error" && <p className="error">전송에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>}
        </div>
        <div className="ui-dialog-footer">
          <Button onClick={() => void submit()} disabled={!message.trim() || status === "sending"}>
            {status === "sending" ? "전송 중…" : "보내기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
