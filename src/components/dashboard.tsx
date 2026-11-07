"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LottoDraw } from "@/lib/lotto";
import { average, numberStats, oddEvenStats, rangeStats, sumOf } from "@/lib/analysis";
import Ball from "./ball";
import AiAnalysis from "./ai-analysis";
import {
  Card,
  FrequencyChart,
  NumberChips,
  OddEvenDistChart,
  OddEvenSplit,
  RangeChart,
  RecentHeatmap,
  RecentTable,
  SumTrendChart,
} from "./charts";

const WINDOWS = [
  { value: 0, label: "전체" },
  { value: 100, label: "최근 100회" },
  { value: 50, label: "최근 50회" },
  { value: 20, label: "최근 20회" },
] as const;

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export default function Dashboard({ draws, updatedAt }: { draws: LottoDraw[]; updatedAt: string | null }) {
  const [windowSize, setWindowSize] = useState<number>(0);
  const [includeBonus, setIncludeBonus] = useState(false);

  const scoped = useMemo(() => (windowSize ? draws.slice(0, windowSize) : draws), [draws, windowSize]);
  const stats = useMemo(() => numberStats(scoped, includeBonus), [scoped, includeBonus]);
  const allStats = useMemo(() => numberStats(draws, false), [draws]);
  const oddEven = useMemo(() => oddEvenStats(scoped), [scoped]);
  const ranges = useMemo(() => rangeStats(scoped), [scoped]);
  const overallAvgSum = useMemo(() => average(draws.map(sumOf)), [draws]);

  if (draws.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface p-12 text-center">
        <p className="text-ink-2">아직 수집된 당첨번호가 없습니다.</p>
        <Link
          href="/draws"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          당첨번호 수집하러 가기
        </Link>
      </div>
    );
  }

  const latest = draws[0];
  const recent10 = draws.slice(0, 10);
  const byCount = [...stats].sort((a, b) => b.count - a.count || a.n - b.n);
  const byGap = [...allStats].sort((a, b) => (b.gap ?? Infinity) - (a.gap ?? Infinity) || a.n - b.n);
  const avgOdd = oddEven.odd / (scoped.length || 1);
  const first = scoped[scoped.length - 1];

  return (
    <div className="space-y-6">
      {/* 최신 회차 */}
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-ink-3">최신 회차</div>
          <div className="text-xl font-bold">
            제 {latest.round}회 <span className="text-sm font-normal text-ink-2">{latest.date} 추첨</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {latest.numbers.map((n) => (
            <Ball key={n} n={n} size="lg" />
          ))}
          <span className="px-1 text-xl text-ink-3">+</span>
          <Ball n={latest.bonus} size="lg" />
        </div>
      </section>

      {/* 필터: 차트 위 한 줄 */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="분석 범위" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              role="radio"
              aria-checked={windowSize === w.value}
              onClick={() => setWindowSize(w.value)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                windowSize === w.value ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-grid"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={includeBonus}
            onChange={(e) => setIncludeBonus(e.target.checked)}
            className="h-4 w-4 accent-[var(--series-1)]"
          />
          빈도에 보너스 번호 포함
        </label>
        <span className="text-xs text-ink-3 sm:ml-auto">
          {first.round}회 ~ {latest.round}회 기준
          {updatedAt && ` · 마지막 수집 ${new Date(updatedAt).toLocaleDateString("ko-KR")}`}
        </span>
      </div>

      {/* 요약 지표 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="분석 회차" value={`${scoped.length.toLocaleString()}회`} sub={`${first.date} ~ ${latest.date}`} />
        <StatTile
          label="가장 많이 나온 번호"
          value={`${byCount[0].n}번`}
          sub={`${byCount[0].count}회 출현 (${(byCount[0].share * 100).toFixed(2)}%)`}
        />
        <StatTile
          label="가장 적게 나온 번호"
          value={`${byCount[44].n}번`}
          sub={`${byCount[44].count}회 출현 (${(byCount[44].share * 100).toFixed(2)}%)`}
        />
        <StatTile
          label="회차당 평균 홀수"
          value={`${avgOdd.toFixed(2)}개`}
          sub={`홀 ${((oddEven.odd / (oddEven.odd + oddEven.even)) * 100).toFixed(1)}% · 짝 ${(
            (oddEven.even / (oddEven.odd + oddEven.even)) *
            100
          ).toFixed(1)}%`}
        />
      </div>

      {/* 번호별 출현 빈도 */}
      <Card
        title="번호별 출현 빈도"
        subtitle={`1~45번이 ${scoped.length.toLocaleString()}회 동안 몇 번 나왔는지${includeBonus ? " (보너스 포함)" : ""}. 막대에 마우스를 올리면 자세히 보입니다.`}
      >
        <FrequencyChart stats={stats} />
        <div className="mt-6 grid gap-6 border-t border-line pt-5 md:grid-cols-3">
          <NumberChips title="많이 나온 번호 TOP 6" items={byCount.slice(0, 6)} render={(s) => `${s.count}회`} />
          <NumberChips
            title="적게 나온 번호 6개"
            items={byCount.slice(-6).reverse()}
            render={(s) => `${s.count}회`}
          />
          <NumberChips
            title="오래 안 나온 번호 (전체 기준)"
            items={byGap.slice(0, 6)}
            render={(s) => (s.gap === null ? "미출현" : `${s.gap}회 전`)}
          />
        </div>
      </Card>

      {/* 홀짝 · 구간 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="홀짝 비율" subtitle="전체 당첨번호의 홀/짝 비율과, 회차별 홀수 개수 분포">
          <OddEvenSplit odd={oddEven.odd} even={oddEven.even} />
          <OddEvenDistChart dist={oddEven.dist} />
        </Card>
        <Card
          title="구간 분포"
          subtitle="당첨번호가 각 번호대에 들어간 비율. 41~45는 번호가 5개뿐이라 기대 비율이 절반입니다."
        >
          <RangeChart ranges={ranges} />
          <p className="mt-4 text-xs text-ink-3">
            괄호 안 숫자는 기대 비율과의 차이(%p)입니다. 구간 패턴은 아래 최근 10회차 표에서 회차별로 볼 수 있습니다.
          </p>
        </Card>
      </div>

      {/* 최근 10회차 트렌드 */}
      <Card title="최근 10회차 출현 패턴" subtitle="행은 회차(위가 최신), 열은 1~45번. 맨 아래는 10회 동안의 출현 횟수입니다.">
        <RecentHeatmap draws={recent10} />
      </Card>
      <Card title="최근 10회차 번호 합계" subtitle="당첨번호 6개를 더한 값의 흐름 (점에 마우스를 올리면 번호가 보입니다)">
        <SumTrendChart draws={recent10} overallAvg={overallAvgSum} />
      </Card>
      <Card title="최근 10회차 상세" subtitle="홀짝, 합계, 구간별 개수, 연속번호 여부">
        <RecentTable draws={recent10} />
      </Card>

      {/* AI 분석 */}
      <AiAnalysis />
    </div>
  );
}
