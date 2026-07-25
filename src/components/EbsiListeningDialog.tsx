import { useMemo, useState } from "react";
import { Download, Headphones, Loader2, Search } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const LIST_ENDPOINT =
  "https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax";
const DOWNLOAD_ROOT = "https://wdown.ebsi.co.kr/W61001/01exam";
const FIRST_YEAR = 2006;

const gradeOptions = [
  { value: "D300", label: "고3 · N수", subjectId: "80003" },
  { value: "D200", label: "고2", subjectId: "120013" },
  { value: "D100", label: "고1", subjectId: "17014" },
] as const;

interface EbsiPaper {
  id: string;
  title: string;
  year: string;
  month: string;
  audioPath: string;
}

interface EbsiListeningDialogProps {
  onChoose: (file: File) => void | Promise<void>;
}

function parsePapers(document: Document): EbsiPaper[] {
  return Array.from(document.querySelectorAll(".qus_box.eng"))
    .map((row): EbsiPaper | null => {
      const button = Array.from(
        row.querySelectorAll<HTMLButtonElement>("button"),
      ).find((item) => item.getAttribute("onclick")?.includes("goDownLoadR("));
      const onclick = button?.getAttribute("onclick") ?? "";
      const audioPath = onclick.match(
        /goDownLoadR\(\s*['"]([^'"]+\.mp3)['"]/,
      )?.[1];
      if (!audioPath) return null;

      const flags = row.querySelectorAll(".qus_flag span");
      const year = flags.item(0)?.textContent?.trim() ?? "";
      const month = flags.item(1)?.textContent?.trim() ?? "";
      const title =
        row.querySelector(".qus_tit")?.textContent
          ?.replace(/\s+/g, " ")
          .trim() ?? `${year}년 ${month} 영어`;
      return { id: audioPath, title, year, month, audioPath };
    })
    .filter((paper): paper is EbsiPaper => Boolean(paper));
}

export function EbsiListeningDialog({ onChoose }: EbsiListeningDialogProps) {
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () =>
      Array.from(
        { length: currentYear - FIRST_YEAR + 1 },
        (_, index) => String(currentYear - index),
      ),
    [currentYear],
  );
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState("D300");
  const [fromYear, setFromYear] = useState(
    String(Math.max(FIRST_YEAR, currentYear - 2)),
  );
  const [toYear, setToYear] = useState(String(currentYear));
  const [papers, setPapers] = useState<EbsiPaper[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string>();
  const [error, setError] = useState("");

  const search = async () => {
    setLoading(true);
    setError("");
    setSearched(false);
    setPapers([]);

    try {
      const start = Math.min(Number(fromYear), Number(toYear));
      const end = Math.max(Number(fromYear), Number(toYear));
      const yearList = Array.from(
        { length: end - start + 1 },
        (_, index) => String(end - index),
      );
      const subjectId =
        gradeOptions.find((option) => option.value === grade)?.subjectId ??
        "80003";
      const body = new URLSearchParams({
        targetCd: grade,
        yearList: yearList.join(","),
        monthList: "03,04,05,06,08,09,10,11,12",
        arOrd: "3",
        subjIdList: subjectId,
        sort: "recent",
        paperId: "",
        paperNo: "",
        lvl: "",
        yearAll: "all",
        monthAll: "all",
        korArOrd: "1",
        mathArOrd: "2",
        engArOrd: "3",
        hisArOrd: "4",
        sFormPartEng: subjectId,
        srch1ArOrd: "5",
        srch2ArOrd: "6",
        jobArOrd: "7",
        scndForgnlngArOrd: "8",
      });
      const requestPage = async (page: number) => {
        const pageBody = new URLSearchParams(body);
        pageBody.set("currentPage", String(page));
        const response = await fetch(LIST_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "text/html, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: pageBody,
        });
        if (!response.ok) {
          throw new Error(`목록 요청 실패 (${response.status})`);
        }
        return response.text();
      };

      const firstHtml = await requestPage(1);
      const pageNumbers = Array.from(firstHtml.matchAll(/goPage\((\d+)\)/g))
        .map((match) => Number(match[1]))
        .filter(Number.isFinite);
      const lastPage = Math.max(1, ...pageNumbers);
      const remainingHtml = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, index) =>
          requestPage(index + 2),
        ),
      );
      const parser = new DOMParser();
      const nextPapers = [firstHtml, ...remainingHtml].flatMap((html) =>
        parsePapers(parser.parseFromString(html, "text/html")),
      );

      setPapers(nextPapers);
      setSearched(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "EBSi 기출 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const choosePaper = async (paper: EbsiPaper) => {
    setDownloadingId(paper.id);
    setError("");
    try {
      const response = await fetch(`${DOWNLOAD_ROOT}${paper.audioPath}`);
      if (!response.ok) {
        throw new Error(`음원 요청 실패 (${response.status})`);
      }
      const blob = await response.blob();
      const sourceName =
        paper.audioPath.split("/").pop() ?? "ebsi-listening.mp3";
      const file = new File([blob], sourceName, {
        type: blob.type || "audio/mpeg",
        lastModified: Date.now(),
      });
      await onChoose(file);
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "EBSi 듣기 음원을 불러오지 못했습니다.",
      );
    } finally {
      setDownloadingId(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="ebsi-trigger">
          <Headphones size={16} />
          기출음원 불러오기
        </Button>
      </DialogTrigger>
      <DialogContent className="ebsi-dialog">
        <DialogHeader>
          <DialogTitle>EBSi 기출 듣기 음원</DialogTitle>
          <DialogDescription>
            학년과 검색 연도를 선택한 뒤 사용할 영어 듣기 음원을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="ebsi-dialog-body">
          <div className="ebsi-filters">
            <label>
              <span className="field-label">학년</span>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger aria-label="학년">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((option) => (
                    <SelectItem value={option.value} key={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              <span className="field-label">시작 연도</span>
              <Select value={fromYear} onValueChange={setFromYear}>
                <SelectTrigger aria-label="시작 연도">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem value={year} key={year}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              <span className="field-label">종료 연도</span>
              <Select value={toYear} onValueChange={setToYear}>
                <SelectTrigger aria-label="종료 연도">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem value={year} key={year}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button type="button" onClick={() => void search()} disabled={loading}>
              {loading ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Search size={16} />
              )}
              검색
            </Button>
          </div>

          {error && <p className="error ebsi-error">{error}</p>}

          <div className="ebsi-results" aria-live="polite">
            {loading ? (
              <div className="ebsi-empty">기출 목록을 불러오는 중입니다.</div>
            ) : papers.length > 0 ? (
              papers.map((paper) => (
                <button
                  type="button"
                  className="ebsi-paper"
                  key={paper.id}
                  disabled={Boolean(downloadingId)}
                  onClick={() => void choosePaper(paper)}
                >
                  <span className="ebsi-paper-date">
                    {paper.year} {paper.month}
                  </span>
                  <span className="ebsi-paper-title">{paper.title}</span>
                  {downloadingId === paper.id ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                </button>
              ))
            ) : (
              <div className="ebsi-empty">
                {searched
                  ? "선택한 조건의 듣기 음원이 없습니다."
                  : "조건을 선택하고 검색해 주세요."}
              </div>
            )}
          </div>

          <p className="ebsi-source">
            자료 제공:{" "}
            <a
              href={`https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs?targetCd=${grade}`}
              target="_blank"
              rel="noreferrer"
            >
              EBSi 기출문제
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
