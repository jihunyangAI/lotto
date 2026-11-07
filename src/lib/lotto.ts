import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export const SOURCE_PAGE = "https://billyjodev.github.io/lotto/";
// 대상 페이지의 표는 이 스크립트(LOTTO_DATA 배열)를 읽어 클라이언트에서 그려진다.
const SOURCE_DATA = new URL("lotto_data.js", SOURCE_PAGE).toString();

export const DATA_FILE = path.join(process.cwd(), "data", "lotto.json");

export type LottoDraw = {
  round: number; // 회차
  date: string; // 추첨일 (YYYY-MM-DD)
  numbers: number[]; // 당첨번호 6개 (오름차순)
  bonus: number; // 보너스번호
  prize: number; // 1등 1인당 당첨금액 (원)
  winners: number; // 1등 당첨자 수
};

export type LottoStore = {
  source: string;
  updatedAt: string | null;
  draws: LottoDraw[]; // 회차 내림차순
};

export type CrawlResult = {
  fetched: number;
  added: number[];
  skipped: number;
  invalid: number;
  total: number;
  updatedAt: string;
};

export async function readStore(): Promise<LottoStore> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<LottoStore>;
    return {
      source: parsed.source ?? SOURCE_PAGE,
      updatedAt: parsed.updatedAt ?? null,
      draws: Array.isArray(parsed.draws) ? parsed.draws : [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { source: SOURCE_PAGE, updatedAt: null, draws: [] };
    }
    throw err;
  }
}

async function writeStore(store: LottoStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  // 임시 파일에 쓴 뒤 rename → 쓰는 도중 실패해도 기존 파일이 깨지지 않음
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

/** lotto_data.js 본문에서 `const LOTTO_DATA = [...]` 배열을 추출한다. */
export function extractRawDraws(script: string): unknown[] {
  const match = script.match(/LOTTO_DATA\s*=\s*(\[[\s\S]*\])\s*;?/);
  if (!match) throw new Error("LOTTO_DATA 배열을 찾지 못했습니다. 대상 사이트 구조가 바뀌었을 수 있습니다.");
  const arr = JSON.parse(match[1]);
  if (!Array.isArray(arr)) throw new Error("LOTTO_DATA가 배열이 아닙니다.");
  return arr;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isBall = (v: unknown): v is number => isInt(v) && v >= 1 && v <= 45;

/** 원본 레코드를 검증·정규화한다. 잘못된 레코드는 null. */
export function normalizeDraw(raw: unknown): LottoDraw | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const dateMatch = typeof r.date === "string" ? r.date.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/) : null;
  if (!isInt(r.round) || r.round < 1 || !dateMatch) return null;
  if (!Array.isArray(r.numbers) || r.numbers.length !== 6 || !r.numbers.every(isBall)) return null;
  if (new Set(r.numbers).size !== 6) return null;
  if (!isBall(r.bonus) || r.numbers.includes(r.bonus)) return null;

  const [, y, m, d] = dateMatch;
  return {
    round: r.round,
    date: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
    numbers: [...(r.numbers as number[])].sort((a, b) => a - b),
    bonus: r.bonus,
    prize: typeof r.prize === "number" && r.prize >= 0 ? r.prize : 0,
    winners: isInt(r.winners) && r.winners >= 0 ? r.winners : 0,
  };
}

async function fetchSource(): Promise<string> {
  const res = await fetch(SOURCE_DATA, {
    cache: "no-store",
    headers: { "User-Agent": "lotto-crawler/1.0", Referer: SOURCE_PAGE },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`데이터 요청 실패: HTTP ${res.status}`);
  return res.text();
}

let running: Promise<CrawlResult> | null = null;

/** 크롤링 후 이미 저장된 회차는 건너뛰고 신규 회차만 JSON 파일에 추가한다. */
export function crawl(): Promise<CrawlResult> {
  // 동시 요청이 들어와도 한 번만 실행 (파일 쓰기 경합 방지)
  running ??= doCrawl().finally(() => {
    running = null;
  });
  return running;
}

async function doCrawl(): Promise<CrawlResult> {
  const rawDraws = extractRawDraws(await fetchSource());
  const store = await readStore();
  const known = new Set(store.draws.map((d) => d.round));

  const added: LottoDraw[] = [];
  let skipped = 0;
  let invalid = 0;

  for (const raw of rawDraws) {
    const draw = normalizeDraw(raw);
    if (!draw) {
      invalid++;
      continue;
    }
    if (known.has(draw.round)) {
      skipped++;
      continue;
    }
    known.add(draw.round);
    added.push(draw);
  }

  const updatedAt = new Date().toISOString();
  if (added.length > 0 || store.updatedAt === null) {
    const draws = [...store.draws, ...added].sort((a, b) => b.round - a.round);
    await writeStore({ source: SOURCE_PAGE, updatedAt, draws });
    store.draws = draws;
  }

  return {
    fetched: rawDraws.length,
    added: added.map((d) => d.round).sort((a, b) => a - b),
    skipped,
    invalid,
    total: store.draws.length,
    updatedAt,
  };
}
