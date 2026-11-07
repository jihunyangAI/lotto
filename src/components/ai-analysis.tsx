"use client";

import { useRef, useState } from "react";
import { Card } from "./charts";
import { reportFileName, saveReportPdf } from "@/lib/report-pdf";

const MAX_LENGTH = 500;

const EXAMPLES = [
  "최근 100회에서 많이 나온 번호와 오래 안 나온 번호를 비교해줘",
  "홀짝 비율과 구간 분포의 최근 흐름을 전체 기간과 비교해줘",
  "번호 7과 함께 가장 자주 나온 번호는 뭐야?",
  "통계를 참고한 재미용 번호 조합 3개를 근거와 함께 추천해줘",
];

type Result = { ok: true; html: string; model: string } | { ok: false; error: string };

export default function AiAnalysis() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ html: string; model: string; question: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function savePdf() {
    if (!report || saving) return;
    setSaving(true);
    setPdfError(null);
    try {
      await saveReportPdf(report);
    } catch (err) {
      console.error("[pdf]", err);
      setPdfError("PDF를 만들지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(q = question) {
    const text = q.trim();
    if (!text || loading) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
        signal: controller.current.signal,
      });
      const data = (await res.json()) as Result;
      if (!data.ok) throw new Error(data.error);
      setReport({ html: data.html, model: data.model, question: text });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title="AI 분석"
      subtitle="궁금한 분석을 입력하면 AI(Gemini)가 서버에 저장된 전체 당첨번호 데이터를 보고 답해 드립니다."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="ai-question" className="sr-only">
          분석 요청
        </label>
        <textarea
          id="ai-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="예) 최근 50회 동안 연속번호가 나온 비율은 어느 정도야?"
          className="w-full resize-y rounded-lg border border-line bg-page px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-series-1"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            {loading ? "분석 중…" : "AI 분석 요청"}
          </button>
          <span className="text-xs text-ink-3">Ctrl + Enter로도 보낼 수 있습니다</span>
          <span className="ml-auto text-xs tabular-nums text-ink-3">
            {question.length}/{MAX_LENGTH}
          </span>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuestion(ex);
              submit(ex);
            }}
            className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:bg-grid disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      )}

      {loading && (
        <div aria-live="polite" className="mt-6 space-y-3">
          <p className="text-sm text-ink-3">AI가 {report ? "새 요청을" : "데이터를"} 분석하고 있습니다… (보통 5~20초)</p>
          <div className="h-4 w-1/2 animate-pulse rounded bg-grid" />
          <div className="h-3 w-full animate-pulse rounded bg-grid" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-grid" />
        </div>
      )}

      {report && !loading && (
        <article className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-xs text-ink-3">
            요청: “{report.question}” · 모델 {report.model}
          </p>
          {/* 서버에서 허용 태그만 남기도록 정화한 HTML */}
          <div className="ai-report" dangerouslySetInnerHTML={{ __html: report.html }} />
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={savePdf}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-grid disabled:opacity-40"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
              </svg>
              {saving ? "PDF 만드는 중…" : "PDF 저장"}
            </button>
            <span className="text-xs text-ink-3">{reportFileName()} · A4, 여백 15mm</span>
            {pdfError && <span role="alert" className="text-xs text-rose-600">{pdfError}</span>}
          </div>
        </article>
      )}
    </Card>
  );
}
