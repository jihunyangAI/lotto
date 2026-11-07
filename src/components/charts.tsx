"use client";

import { useState, type ReactNode } from "react";
import type { LottoDraw } from "@/lib/lotto";
import {
  NUMBERS,
  hasConsecutive,
  oddCount,
  rangePattern,
  sumOf,
  type NumberStat,
} from "@/lib/analysis";
import Ball from "./ball";

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

/** 0부터 시작하는 보기 좋은 축 최댓값과 눈금 */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return { top: Math.ceil(max / step) * step, step };
}

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tooltip({ leftPct, children }: { leftPct: number; children: ReactNode }) {
  const left = Math.min(90, Math.max(10, leftPct));
  return (
    <div
      role="status"
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: `${left}%` }}
    >
      {children}
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

/* ---------------- 번호별 출현 빈도 ---------------- */

export function FrequencyChart({ stats }: { stats: NumberStat[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...stats.map((s) => s.count));
  const { top, step } = niceScale(max);
  const avg = stats.reduce((a, s) => a + s.count, 0) / stats.length;
  const sorted = [...stats].sort((a, b) => b.count - a.count || a.n - b.n);
  const hot = new Set(sorted.slice(0, 6).map((s) => s.n));
  const cold = new Set(sorted.slice(-6).map((s) => s.n));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const h = hover !== null ? stats[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-2">
        <LegendItem className="bg-series-2" label="많이 나온 6개" />
        <LegendItem className="bg-series-1" label="보통" />
        <LegendItem className="bg-muted-mark" label="적게 나온 6개" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 bg-ink-2" />
          평균 {avg.toFixed(1)}회
        </span>
      </div>
      {/* 좁은 화면에서만 가로 스크롤 (데스크톱은 툴팁이 잘리지 않도록 overflow 해제) */}
      <div className="overflow-x-auto pt-20 md:overflow-visible md:pt-6">
        <div className="relative min-w-[600px] pl-9">
          {/* 눈금선 */}
          <div className="relative h-56">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-grid"
                style={{ bottom: `${(t / top) * 100}%` }}
              >
                <span className="absolute -left-9 -translate-y-1/2 text-[10px] tabular-nums text-ink-3">{t}</span>
              </div>
            ))}
            <div
              className="absolute inset-x-0 z-[1] border-t border-ink-2"
              style={{ bottom: `${(avg / top) * 100}%` }}
            />
            <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
              {stats.map((s, i) => (
                <button
                  key={s.n}
                  type="button"
                  aria-label={`${s.n}번 ${s.count}회`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className={`relative h-full flex-1 outline-none ${hover === i ? "bg-grid/70" : ""}`}
                >
                  <span
                    className={`absolute bottom-0 left-1/2 w-[70%] max-w-6 -translate-x-1/2 rounded-t-[4px] ${
                      hot.has(s.n) ? "bg-series-2" : cold.has(s.n) ? "bg-muted-mark" : "bg-series-1"
                    }`}
                    style={{ height: `${(s.count / top) * 100}%` }}
                  />
                </button>
              ))}
            </div>
            {h && (
              <Tooltip leftPct={((hover! + 0.5) / stats.length) * 100}>
                <div className="mb-1 flex items-center gap-2">
                  <Ball n={h.n} size="sm" />
                  <b className="text-sm">{h.count}회 출현</b>
                </div>
                <div className="text-ink-2">
                  비율 {pct(h.share, 2)} · 평균 대비 {h.count >= avg ? "+" : ""}
                  {(h.count - avg).toFixed(1)}회
                </div>
                <div className="text-ink-2">
                  {h.gap === null ? "이 범위에서 미출현" : h.gap === 0 ? "최신 회차에 나옴" : `${h.gap}회차 전 마지막 출현`}
                </div>
              </Tooltip>
            )}
          </div>
          {/* x축 번호 */}
          <div className="flex pt-1">
            {stats.map((s) => (
              <span key={s.n} className="flex-1 text-center text-[10px] tabular-nums text-ink-3">
                {s.n === 1 || s.n % 5 === 0 ? s.n : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NumberChips({
  title,
  items,
  render,
}: {
  title: string;
  items: NumberStat[];
  render: (s: NumberStat) => string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-ink-2">{title}</h3>
      <ul className="flex flex-wrap gap-3">
        {items.map((s) => (
          <li key={s.n} className="flex flex-col items-center gap-1">
            <Ball n={s.n} />
            <span className="text-[11px] tabular-nums text-ink-3">{render(s)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- 홀짝 ---------------- */

export function OddEvenSplit({ odd, even }: { odd: number; even: number }) {
  const total = odd + even || 1;
  const parts = [
    { label: "홀수", value: odd, cls: "bg-series-1" },
    { label: "짝수", value: even, cls: "bg-series-2" },
  ];
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        {parts.map((p) => (
          <LegendItem key={p.label} className={p.cls} label={`${p.label} ${p.value.toLocaleString()}개`} />
        ))}
      </div>
      <div className="flex h-7 gap-0.5">
        {parts.map((p) =>
          p.value > 0 ? (
            <div
              key={p.label}
              className={`flex items-center justify-center rounded text-xs font-semibold text-white ${p.cls}`}
              style={{ width: `${(p.value / total) * 100}%` }}
            >
              {p.label} {pct(p.value / total)}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function OddEvenDistChart({ dist }: { dist: { odds: number; count: number; share: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...dist.map((d) => d.count), 1);
  const { top } = niceScale(max);
  const peak = dist.reduce((a, b) => (b.count > a.count ? b : a));
  const h = hover !== null ? dist[hover] : null;

  return (
    <div className="pt-12">
      <div className="relative">
        <div className="relative flex h-40 border-b border-grid" onMouseLeave={() => setHover(null)}>
          {dist.map((d, i) => (
            <button
              key={d.odds}
              type="button"
              aria-label={`홀 ${d.odds} 짝 ${6 - d.odds}: ${d.count}회`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className={`relative h-full flex-1 outline-none ${hover === i ? "bg-grid/70" : ""}`}
            >
              <span
                className="absolute bottom-0 left-1/2 w-6 -translate-x-1/2 rounded-t-[4px] bg-series-1"
                style={{ height: `${(d.count / top) * 100}%` }}
              />
              {d === peak && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-full pb-1 text-xs font-semibold tabular-nums text-ink"
                  style={{ bottom: `${(d.count / top) * 100}%` }}
                >
                  {pct(d.share, 0)}
                </span>
              )}
            </button>
          ))}
        </div>
        {h && (
          <Tooltip leftPct={((hover! + 0.5) / dist.length) * 100}>
            <b className="text-sm">
              홀 {h.odds} : 짝 {6 - h.odds}
            </b>
            <div className="text-ink-2">
              {h.count.toLocaleString()}회 · {pct(h.share)}
            </div>
          </Tooltip>
        )}
      </div>
      <div className="flex pt-1.5">
        {dist.map((d) => (
          <span key={d.odds} className="flex-1 text-center text-[11px] tabular-nums text-ink-3">
            {d.odds}:{6 - d.odds}
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-[11px] text-ink-3">홀수 개수 : 짝수 개수</p>
    </div>
  );
}

/* ---------------- 구간 분포 ---------------- */

export function RangeChart({
  ranges,
}: {
  ranges: { label: string; count: number; share: number; expected: number }[];
}) {
  const scaleMax = Math.max(0.3, ...ranges.map((r) => Math.max(r.share, r.expected))) * 1.05;
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-ink-2">
        <LegendItem className="bg-series-1" label="실제 비율" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-ink" />
          기대 비율 (번호 개수 기준)
        </span>
      </div>
      <ul className="space-y-3">
        {ranges.map((r) => {
          const diff = r.share - r.expected;
          return (
            <li key={r.label} className="grid grid-cols-[3.5rem_1fr_7.5rem] items-center gap-3 text-sm">
              <span className="tabular-nums text-ink-2">{r.label}</span>
              <div className="relative h-6" title={`${r.label}: ${r.count.toLocaleString()}개 (${pct(r.share)})`}>
                <div
                  className="absolute inset-y-0 left-0 rounded-r-[4px] bg-series-1"
                  style={{ width: `${(r.share / scaleMax) * 100}%` }}
                />
                <div
                  className="absolute -inset-y-1 w-0.5 bg-ink"
                  style={{ left: `${(r.expected / scaleMax) * 100}%` }}
                />
              </div>
              <span className="text-right tabular-nums">
                <b>{pct(r.share)}</b>{" "}
                <span className="text-xs text-ink-3">
                  ({diff >= 0 ? "+" : ""}
                  {(diff * 100).toFixed(1)}p)
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- 최근 10회차 ---------------- */

export function RecentHeatmap({ draws }: { draws: LottoDraw[] }) {
  const freq = new Array(46).fill(0);
  for (const d of draws) for (const n of d.numbers) freq[n]++;
  const cols = "grid-cols-[3.25rem_repeat(45,minmax(0,1fr))]";

  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-ink-2">
        <LegendItem className="bg-series-1" label="당첨번호" />
        <LegendItem className="bg-series-1-soft" label="보너스" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px] text-[10px] tabular-nums">
          <div className={`grid ${cols} gap-[2px] text-ink-3`}>
            <span />
            {NUMBERS.map((n) => (
              <span key={n} className="text-center">
                {n === 1 || n % 5 === 0 ? n : ""}
              </span>
            ))}
          </div>
          {draws.map((d) => (
            <div key={d.round} className={`mt-[2px] grid ${cols} gap-[2px]`}>
              <span className="pr-1 text-right text-ink-2">{d.round}회</span>
              {NUMBERS.map((n) => {
                const win = d.numbers.includes(n);
                const bonus = d.bonus === n;
                return (
                  <span
                    key={n}
                    title={`${d.round}회 ${n}번${win ? " 당첨" : bonus ? " 보너스" : ""}`}
                    className={`aspect-square rounded-[3px] ${
                      win ? "bg-series-1" : bonus ? "bg-series-1-soft" : "bg-grid"
                    }`}
                  />
                );
              })}
            </div>
          ))}
          <div className={`mt-1 grid ${cols} gap-[2px] border-t border-line pt-1 text-ink-3`}>
            <span className="pr-1 text-right">합계</span>
            {NUMBERS.map((n) => (
              <span key={n} className={`text-center ${freq[n] >= 3 ? "font-bold text-ink" : ""}`}>
                {freq[n] || ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SumTrendChart({ draws, overallAvg }: { draws: LottoDraw[]; overallAvg: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const series = [...draws].reverse(); // 과거 → 최신 (왼쪽 → 오른쪽)
  const sums = series.map(sumOf);
  const lo = Math.floor((Math.min(...sums, overallAvg) - 10) / 20) * 20;
  const hi = Math.ceil((Math.max(...sums, overallAvg) + 10) / 20) * 20;
  const W = 1000;
  const H = 240;
  const pad = { l: 40, r: 24, t: 24, b: 28 };
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, series.length - 1);
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo || 1);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 20) ticks.push(t);
  const path = sums.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s)}`).join(" ");
  const h = hover !== null ? series[hover] : null;

  return (
    <div className="relative overflow-x-auto pt-16 md:overflow-visible md:pt-2">
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-ink-3" />
          역대 평균 {overallAvg.toFixed(1)}
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px] overflow-visible"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
                {t}
              </text>
            </g>
          ))}
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(overallAvg)}
            y2={y(overallAvg)}
            stroke="var(--ink-3)"
            strokeWidth={2}
          />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line)" strokeWidth={1} />
          )}
          <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {series.map((d, i) => (
            <g key={d.round}>
              <circle
                cx={x(i)}
                cy={y(sums[i])}
                r={hover === i ? 6 : 4.5}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                {d.round}회
              </text>
              <rect
                x={x(i) - (W - pad.l - pad.r) / series.length / 2}
                y={0}
                width={(W - pad.l - pad.r) / series.length}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
          {/* 최신 회차 값만 직접 표기 */}
          {sums.length > 0 && (
            <text
              x={x(sums.length - 1)}
              y={y(sums[sums.length - 1]) - 12}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill="var(--ink)"
              pointerEvents="none"
            >
              {sums[sums.length - 1]}
            </text>
          )}
        </svg>
        {h && hover !== null && (
          <Tooltip leftPct={(x(hover) / W) * 100}>
            <b className="text-sm">
              {h.round}회 · 합계 {sums[hover]}
            </b>
            <div className="mt-1 flex gap-1">
              {h.numbers.map((n) => (
                <Ball key={n} n={n} size="sm" />
              ))}
            </div>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function RecentTable({ draws }: { draws: LottoDraw[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">회차</th>
            <th className="py-2 pr-3 font-medium">당첨번호 + 보너스</th>
            <th className="py-2 pr-3 text-center font-medium">홀:짝</th>
            <th className="py-2 pr-3 text-right font-medium">합계</th>
            <th className="py-2 pr-3 text-center font-medium">구간 (1·11·21·31·41)</th>
            <th className="py-2 text-center font-medium">연번</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {draws.map((d) => {
            const o = oddCount(d);
            return (
              <tr key={d.round}>
                <td className="py-2 pr-3">
                  <b className="tabular-nums">{d.round}회</b>
                  <div className="text-xs tabular-nums text-ink-3">{d.date}</div>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1">
                    {d.numbers.map((n) => (
                      <Ball key={n} n={n} size="sm" />
                    ))}
                    <span className="px-0.5 text-ink-3">+</span>
                    <Ball n={d.bonus} size="sm" />
                  </div>
                </td>
                <td className="py-2 pr-3 text-center tabular-nums">
                  {o}:{6 - o}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{sumOf(d)}</td>
                <td className="py-2 pr-3 text-center font-mono text-xs tabular-nums text-ink-2">
                  {rangePattern(d).join("-")}
                </td>
                <td className="py-2 text-center text-xs text-ink-2">{hasConsecutive(d) ? "있음" : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
