import { connection } from "next/server";
import { readStore } from "@/lib/lotto";

// GET /api/lotto — 저장된 JSON 데이터 반환
export async function GET() {
  await connection();
  return Response.json(await readStore());
}
