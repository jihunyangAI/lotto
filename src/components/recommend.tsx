"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LottoDraw } from "@/lib/lotto";
import { describeCombo, randomPick } from "@/lib/combo";
import Ball from "./ball";
import LottoMachine from "./lotto-machine";

const MAX_CONDITION = 300;

const CONDITION_EXAMPLES = [
  "최근 20회에 많이 나온 번호 위주로, 홀짝 3:3",
  "7과 17을 꼭 넣고 40번대는 빼줘",
  "오래 안 나온 번호 중심, 연속번호 하나 포함",
  "합계 120~150 사이, 각 구간에서 하나 이상",
];

type AiResult = {
  numbers: number[];
  summary: string;
  reasons: string[];
  conditionNote: string | null;
  strategy?: string;
  model: string;
};

type ApiResponse = ({ ok: true } & AiResult) | { ok: false; error: string };

async function requestAi(body: { mode: "auto" } | { mode: "prompt"; condition: string }): Promise<AiResult> {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ApiResponse;
  if (!data.ok) throw new Error(data.error);
  return data;
}

/* ---------------- 공통 표시 ---------------- */

function ModeCard({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <div className="text-xs font-medium text-ink-3">{step}</div>
      <h2 className="mt-0.5 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-3">{description}</p>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function ActionButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** 추첨기 애니메이션 → 공 6개가 모두 나오면 결과(children) 공개 */
function DrawStage({
  numbers,
  loading = false,
  hint,
  loadingText,
  children,
}: {
  numbers: number[] | null;
  loading?: boolean;
  hint: string;
  loadingText?: string;
  children?: ReactNode;
}) {
  const [doneFor, setDoneFor] = useState<number[] | null>(null);
  const revealed = !loading && numbers !== null && doneFor === numbers;
  return (
    <div className="mt-5">
      <LottoMachine numbers={loading ? null : numbers} mixing={loading} onDone={setDoneFor} />
      {!revealed && (
        <p className="mt-2 text-center text-xs text-ink-3">
          {loading ? (loadingText ?? "공을 섞으며 AI 응답을 기다리는 중…") : numbers ? "추첨 중…" : hint}
        </p>
      )}
      {revealed && children}
    </div>
  );
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
      {message}
    </p>
  );
}

function ComboView({ numbers, draws, children }: { numbers: number[]; draws: LottoDraw[]; children?: ReactNode }) {
  const facts = useMemo(() => describeCombo(numbers, draws), [numbers, draws]);
  const best = facts.bestMatch;
  return (
    <div className="mt-5">
      <div className="flex flex-wrap justify-center gap-1.5" aria-label={`추천 번호 ${numbers.join(", ")}`}>
        {numbers.map((n, i) => (
          <span key={`${numbers.join("-")}-${n}`} className="animate-[pop_.35s_ease-out_both]" style={{ animationDelay: `${i * 70}ms` }}>
            <Ball n={n} size="lg" />
          </span>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-page px-4 py-3 text-xs">
        <Fact label="홀 : 짝" value={`${facts.odd} : ${facts.even}`} />
        <Fact label="번호 합계" value={String(facts.sum)} />
        <Fact label="구간 분포" value={facts.ranges.join("-")} title="1~10 · 11~20 · 21~30 · 31~40 · 41~45" />
        <Fact label="연속번호" value={facts.consecutive ? "있음" : "없음"} />
        <div className="col-span-2 border-t border-line pt-1.5 text-ink-2">
          {facts.exactMatch !== null ? (
            <b className="text-ink">과거 제{facts.exactMatch}회 1등 번호와 똑같은 조합입니다!</b>
          ) : (
            <>
              과거 1등 번호와 최대 <b className="text-ink">{best.count}개</b> 일치
              {best.count > 0 && (
                <span className="text-ink-3">
                  {" "}
                  (제{best.rounds.slice(0, 3).join(", ")}회{best.rounds.length > 3 ? ` 외 ${best.rounds.length - 3}회` : ""})
                </span>
              )}
            </>
          )}
        </div>
      </dl>
      {children}
    </div>
  );
}

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex justify-between gap-2" title={title}>
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Reasons({ result }: { result: AiResult }) {
  return (
    <div className="mt-4 text-sm">
      {result.conditionNote && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          지키지 못한 조건: {result.conditionNote}
        </p>
      )}
      {result.strategy && (
        <p className="mb-2 inline-block rounded-full bg-grid px-2.5 py-0.5 text-[11px] text-ink-2">추천 관점: {result.strategy}</p>
      )}
      {result.summary && <p className="font-medium">{result.summary}</p>}
      {result.reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          {result.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-3">모델 {result.model} · 통계 참고용 재미 추천이며 모든 조합의 당첨 확률은 같습니다.</p>
    </div>
  );
}

/* ---------------- 모드 1: 랜덤 ---------------- */

function RandomMode({ draws }: { draws: LottoDraw[] }) {
  const [numbers, setNumbers] = useState<number[] | null>(null);
  const [history, setHistory] = useState<number[][]>([]);

  function pick() {
    // 이전 결과는 기록으로 옮기고 새 번호로 추첨 시작 (새 번호는 추첨이 끝나야 공개)
    if (numbers) setHistory((h) => [numbers, ...h].slice(0, 4));
    setNumbers(randomPick());
  }

  return (
    <ModeCard step="모드 1" title="랜덤 추천" description="1~45에서 중복 없이 6개를 무작위로 뽑습니다. 통계는 쓰지 않습니다.">
      <ActionButton onClick={pick}>{numbers ? "다시 뽑기" : "랜덤 추천"}</ActionButton>
      <DrawStage numbers={numbers} hint="버튼을 누르면 추첨이 시작됩니다">
        {numbers && <ComboView numbers={numbers} draws={draws} />}
      </DrawStage>
      {history.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-xs text-ink-3">이전에 뽑은 번호</div>
          <ul className="space-y-1.5">
            {history.map((h, i) => (
              <li key={i} className="flex gap-1">
                {h.map((n) => (
                  <Ball key={n} n={n} size="sm" />
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModeCard>
  );
}

/* ---------------- 모드 2: AI 자동 ---------------- */

function AutoMode({ draws }: { draws: LottoDraw[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await requestAi({ mode: "auto" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModeCard step="모드 2" title="AI 자동 추천" description="AI(Gemini)가 역대 당첨 통계를 보고 번호 6개와 추천 근거를 알려 줍니다.">
      <ActionButton onClick={run} disabled={loading}>
        {loading ? "AI가 고르는 중…" : result ? "다른 조합 추천받기" : "AI 자동 추천"}
      </ActionButton>
      <ErrorText message={error} />
      <DrawStage
        numbers={result?.numbers ?? null}
        loading={loading}
        hint="버튼을 누르면 AI가 고른 번호로 추첨합니다"
        loadingText="공을 섞으며 AI가 당첨 통계를 살펴보는 중… (보통 3~10초)"
      >
        {result && (
          <ComboView numbers={result.numbers} draws={draws}>
            <Reasons result={result} />
          </ComboView>
        )}
      </DrawStage>
    </ModeCard>
  );
}

/* ---------------- 모드 3: 프롬프트 기반 AI ---------------- */

function PromptMode({ draws }: { draws: LottoDraw[] }) {
  const [condition, setCondition] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(AiResult & { condition: string }) | null>(null);

  async function run(text = condition) {
    const c = text.trim();
    if (!c || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult({ ...(await requestAi({ mode: "prompt", condition: c })), condition: c });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModeCard step="모드 3" title="조건 입력 AI 추천" description="원하는 조건을 적으면 AI가 당첨 데이터를 참고해 조건에 맞는 번호 6개를 골라 줍니다.">
      <label htmlFor="rec-condition" className="sr-only">
        추천 조건
      </label>
      <textarea
        id="rec-condition"
        value={condition}
        onChange={(e) => setCondition(e.target.value.slice(0, MAX_CONDITION))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            run();
          }
        }}
        rows={3}
        placeholder="예) 3과 27은 꼭 넣고, 홀수 4개 짝수 2개로"
        className="w-full resize-y rounded-lg border border-line bg-page px-3 py-2 text-sm outline-none focus:border-series-1"
      />
      <div className="mb-3 mt-1 text-right text-[11px] tabular-nums text-ink-3">
        {condition.length}/{MAX_CONDITION}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CONDITION_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading}
            onClick={() => setCondition(ex)}
            className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 hover:bg-grid disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>
      <ActionButton onClick={() => run()} disabled={loading || !condition.trim()}>
        {loading ? "AI가 고르는 중…" : "조건으로 AI 추천"}
      </ActionButton>
      <ErrorText message={error} />
      <DrawStage
        numbers={result?.numbers ?? null}
        loading={loading}
        hint="조건을 입력하고 버튼을 누르세요"
        loadingText="공을 섞으며 조건에 맞는 번호를 찾는 중…"
      >
        {result && (
          <ComboView numbers={result.numbers} draws={draws}>
            <p className="mt-3 text-xs text-ink-3">입력 조건: “{result.condition}”</p>
            <Reasons result={result} />
          </ComboView>
        )}
      </DrawStage>
    </ModeCard>
  );
}

export default function Recommend({ draws }: { draws: LottoDraw[] }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <RandomMode draws={draws} />
      <AutoMode draws={draws} />
      <PromptMode draws={draws} />
    </div>
  );
}
