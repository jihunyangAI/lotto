// 순수 분석 함수 (서버/클라이언트 공용). draws는 회차 내림차순(최신이 0번).
import type { LottoDraw } from "./lotto";

export const NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);

export const RANGES = [
  { label: "1~10", from: 1, to: 10 },
  { label: "11~20", from: 11, to: 20 },
  { label: "21~30", from: 21, to: 30 },
  { label: "31~40", from: 31, to: 40 },
  { label: "41~45", from: 41, to: 45 },
] as const;

export const rangeIndex = (n: number) => Math.min(4, Math.floor((n - 1) / 10));

export type NumberStat = {
  n: number;
  count: number; // 출현 횟수
  share: number; // 전체 추첨 번호 중 비율
  gap: number | null; // 마지막 출현 후 지난 회차 수 (0 = 최신 회차에 나옴), 범위 안에서 없으면 null
};

export function numberStats(draws: LottoDraw[], includeBonus: boolean): NumberStat[] {
  const count = new Array(46).fill(0);
  const gap: (number | null)[] = new Array(46).fill(null);
  draws.forEach((d, i) => {
    const picked = includeBonus ? [...d.numbers, d.bonus] : d.numbers;
    for (const n of picked) {
      count[n]++;
      if (gap[n] === null) gap[n] = i;
    }
  });
  const total = draws.length * (includeBonus ? 7 : 6) || 1;
  return NUMBERS.map((n) => ({ n, count: count[n], share: count[n] / total, gap: gap[n] }));
}

export const oddCount = (d: LottoDraw) => d.numbers.filter((n) => n % 2 === 1).length;
export const sumOf = (d: LottoDraw) => d.numbers.reduce((a, b) => a + b, 0);

/** 회차별 홀수 개수(0~6) 분포 + 전체 홀/짝 번호 수 */
export function oddEvenStats(draws: LottoDraw[]) {
  const dist = new Array(7).fill(0);
  let odd = 0;
  for (const d of draws) {
    const o = oddCount(d);
    dist[o]++;
    odd += o;
  }
  const totalNumbers = draws.length * 6;
  return {
    dist: dist.map((count, odds) => ({ odds, count, share: draws.length ? count / draws.length : 0 })),
    odd,
    even: totalNumbers - odd,
  };
}

/** 구간별 당첨번호 수와 비율. expected = 번호 개수 기준 기대 비율 */
export function rangeStats(draws: LottoDraw[]) {
  const counts = new Array(5).fill(0);
  for (const d of draws) for (const n of d.numbers) counts[rangeIndex(n)]++;
  const total = draws.length * 6 || 1;
  return RANGES.map((r, i) => ({
    label: r.label,
    count: counts[i],
    share: counts[i] / total,
    expected: (r.to - r.from + 1) / 45,
  }));
}

/** 회차의 구간 분포 (예: [2,1,1,1,1]) */
export function rangePattern(d: LottoDraw) {
  const p = [0, 0, 0, 0, 0];
  for (const n of d.numbers) p[rangeIndex(n)]++;
  return p;
}

export const hasConsecutive = (d: LottoDraw) => d.numbers.some((n, i) => i > 0 && n - d.numbers[i - 1] === 1);

export function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
