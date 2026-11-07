import { crawl } from "@/lib/lotto";

// POST /api/crawl — 대상 사이트를 크롤링해 신규 회차만 data/lotto.json에 추가
export async function POST() {
  try {
    const result = await crawl();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
