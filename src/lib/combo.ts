// 추천 조합 공통 유틸 (서버/클라이언트 공용)
import type { LottoDraw } from "./lotto";
import { rangeIndex } from "./analysis";

/** 1~45에서 중복 없이 6개를 무작위로 뽑는다 (crypto 난수 + 부분 Fisher–Yates) */
export function randomPick(count = 6): number[] {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const rand = new Uint32Array(count);
  crypto.getRandomValues(rand);
  for (let i = 0; i < count; i++) {
    // 모듈로 편향은 2^32 대비 45라 무시 가능한 수준
    const j = i + (rand[i] % (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

/** 1~45 정수 6개, 중복 없음이면 오름차순 배열, 아니면 null */
export function validateNumbers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== 6) return null;
  if (!value.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)) return null;
  if (new Set(value).size !== 6) return null;
  return [...(value as number[])].sort((a, b) => a - b);
}

export type ComboFacts = {
  odd: number;
  even: number;
  sum: number;
  ranges: number[]; // 1~10,11~20,21~30,31~40,41~45 개수
  consecutive: boolean;
  exactMatch: number | null; // 과거 1등 번호와 완전히 같은 회차
  bestMatch: { count: number; rounds: number[] }; // 과거 회차 당첨번호와 가장 많이 겹친 개수
};

/** 조합의 객관적 특성 (AI 응답과 무관하게 데이터로 직접 계산) */
export function describeCombo(numbers: number[], draws: LottoDraw[]): ComboFacts {
  const odd = numbers.filter((n) => n % 2 === 1).length;
  const ranges = [0, 0, 0, 0, 0];
  for (const n of numbers) ranges[rangeIndex(n)]++;
  const set = new Set(numbers);
  let best = 0;
  let rounds: number[] = [];
  let exactMatch: number | null = null;
  for (const d of draws) {
    const hit = d.numbers.filter((n) => set.has(n)).length;
    if (hit === 6 && exactMatch === null) exactMatch = d.round;
    if (hit > best) {
      best = hit;
      rounds = [d.round];
    } else if (hit === best) rounds.push(d.round);
  }
  return {
    odd,
    even: 6 - odd,
    sum: numbers.reduce((a, b) => a + b, 0),
    ranges,
    consecutive: numbers.some((n, i) => i > 0 && n - numbers[i - 1] === 1),
    exactMatch,
    bestMatch: { count: best, rounds },
  };
}
