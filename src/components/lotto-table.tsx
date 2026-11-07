"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LottoDraw } from "@/lib/lotto";
import Ball from "./ball";

const PAGE_SIZE = 20;

function formatPrize(won: number) {
  if (won <= 0) return "-";
  const eok = Math.floor(won / 1e8);
  const man = Math.floor((won % 1e8) / 1e4);
  const parts = [];
  if (eok) parts.push(`${eok.toLocaleString()}억`);
  if (man) parts.push(`${man.toLocaleString()}만`);
  return `${parts.join(" ") || won.toLocaleString()}원`;
}

type CrawlResponse =
  | { ok: true; fetched: number; added: number[]; skipped: number; invalid: number; total: number }
  | { ok: false; error: string };

export default function LottoTable({ draws, updatedAt }: { draws: LottoDraw[]; updatedAt: string | null }) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [crawling, setCrawling] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim();
    let list = draws;
    if (q) {
      // 숫자만 입력: 회차 또는 해당 번호를 포함한 회차 검색
      const n = Number(q);
      list = Number.isInteger(n)
        ? draws.filter((d) => d.round === n || d.numbers.includes(n) || d.bonus === n)
        : draws.filter((d) => d.date.includes(q));
    }
    return order === "desc" ? list : [...list].reverse();
  }, [draws, query, order]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  async function handleCrawl() {
    setCrawling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/crawl", { method: "POST" });
      const data = (await res.json()) as CrawlResponse;
      if (!data.ok) throw new Error(data.error);
      const addedText =
        data.added.length === 0
          ? "새로 추가된 회차가 없습니다"
          : `${data.added.length}개 회차 추가 (${data.added[0]}~${data.added[data.added.length - 1]}회)`;
      setMessage({
        type: "ok",
        text: `수집 ${data.fetched}건 · ${addedText} · 기존 회차 ${data.skipped}건 건너뜀 · 총 ${data.total}회차`,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setMessage({ type: "error", text: `크롤링 실패: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setCrawling(false);
    }
  }

  const busy = crawling || isRefreshing;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={handleCrawl}
          disabled={busy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {busy ? "수집 중…" : "새 회차 수집"}
        </button>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="회차 · 번호 · 날짜(2025-01) 검색"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <select
          value={order}
          onChange={(e) => {
            setOrder(e.target.value as "desc" | "asc");
            setPage(1);
          }}
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        >
          <option value="desc">최신순</option>
          <option value="asc">과거순</option>
        </select>
      </div>

      <p className="mb-3 text-sm text-zinc-500">
        저장된 회차 {draws.length.toLocaleString()}개
        {updatedAt && ` · 마지막 수집 ${new Date(updatedAt).toLocaleString("ko-KR")}`}
      </p>

      {message && (
        <p
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          }`}
        >
          {message.text}
        </p>
      )}

      {draws.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          저장된 데이터가 없습니다. <b>새 회차 수집</b> 버튼을 눌러 크롤링을 시작하세요.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">회차</th>
                  <th className="px-4 py-3 font-medium">추첨일</th>
                  <th className="px-4 py-3 font-medium">당첨번호</th>
                  <th className="px-4 py-3 font-medium">보너스</th>
                  <th className="px-4 py-3 text-right font-medium">1등 당첨금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((d) => (
                  <tr key={d.round} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-2 font-semibold tabular-nums">{d.round}회</td>
                    <td className="px-4 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">{d.date}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {d.numbers.map((n) => (
                          <Ball key={n} n={n} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Ball n={d.bonus} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPrize(d.prize)}
                      {d.winners > 0 && <span className="ml-1 text-xs text-zinc-500">({d.winners}명)</span>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
            <button
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
              className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            >
              이전
            </button>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
              {current} / {totalPages}
            </span>
            <button
              onClick={() => setPage(current + 1)}
              disabled={current >= totalPages}
              className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            >
              다음
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
