import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { readStore } from "@/lib/lotto";
import Recommend from "@/components/recommend";

export const metadata: Metadata = { title: "번호 추천 · 로또대박기원" };

async function RecommendData() {
  await connection();
  const store = await readStore();
  return <Recommend draws={store.draws} />;
}

export default function RecommendPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">로또 번호 추천</h1>
        <p className="mt-1 text-sm text-ink-3">
          세 가지 방법으로 번호 6개를 받아 보세요. 추천 번호마다 홀짝, 합계, 구간, 과거 당첨번호와 겹친 정도를 함께 보여 드립니다.
        </p>
      </header>
      <Suspense fallback={<p className="py-16 text-center text-sm text-ink-3">불러오는 중…</p>}>
        <RecommendData />
      </Suspense>
    </main>
  );
}
