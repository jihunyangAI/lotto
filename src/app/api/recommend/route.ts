import { readStore } from "@/lib/lotto";
import { AiError, GEMINI_MODEL } from "@/lib/gemini";
import { MAX_CONDITION_LENGTH, recommendWithGemini } from "@/lib/recommend";

// POST /api/recommend
//   { mode: "auto" }                       → AI 자동 추천 (번호 6개 + 근거)
//   { mode: "prompt", condition: "..." }   → 사용자 조건 기반 AI 추천
export async function POST(request: Request) {
  let body: { mode?: unknown; condition?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  let condition: string | undefined;
  if (body.mode === "prompt") {
    if (typeof body.condition !== "string" || !body.condition.trim()) {
      return Response.json({ ok: false, error: "추천 조건을 입력해 주세요." }, { status: 400 });
    }
    if (body.condition.length > MAX_CONDITION_LENGTH) {
      return Response.json(
        { ok: false, error: `추천 조건은 ${MAX_CONDITION_LENGTH}자 이내로 입력해 주세요.` },
        { status: 400 },
      );
    }
    condition = body.condition.trim();
  } else if (body.mode !== "auto") {
    return Response.json({ ok: false, error: "mode는 auto 또는 prompt여야 합니다." }, { status: 400 });
  }

  try {
    const result = await recommendWithGemini(await readStore(), condition);
    return Response.json({ ok: true, ...result, model: GEMINI_MODEL });
  } catch (err) {
    const status = err instanceof AiError ? err.status : 500;
    if (!(err instanceof AiError)) console.error("[recommend]", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
