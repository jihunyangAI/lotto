import { readStore } from "@/lib/lotto";
import { AiError, analyzeWithGemini, GEMINI_MODEL, MAX_QUESTION_LENGTH } from "@/lib/gemini";

// POST /api/ai-analysis { question } → { ok, html }
// 서버의 당첨번호 데이터와 사용자 요청을 Gemini에 보내고, 정화된 HTML 보고서를 돌려준다.
export async function POST(request: Request) {
  let question: unknown;
  try {
    ({ question } = await request.json());
  } catch {
    return Response.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (typeof question !== "string" || !question.trim()) {
    return Response.json({ ok: false, error: "분석 요청을 입력해 주세요." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { ok: false, error: `분석 요청은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요.` },
      { status: 400 },
    );
  }

  try {
    const store = await readStore();
    const html = await analyzeWithGemini(store, question.trim());
    return Response.json({ ok: true, html, model: GEMINI_MODEL });
  } catch (err) {
    const status = err instanceof AiError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    if (!(err instanceof AiError)) console.error("[ai-analysis]", err);
    return Response.json({ ok: false, error: message }, { status });
  }
}
