import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { readStore, SOURCE_PAGE } from "@/lib/lotto";
import LottoTable from "@/components/lotto-table";

export const metadata: Metadata = { title: "당첨번호 · 로또대박기원" };

// 저장된 JSON은 요청마다 새로 읽는다 (크롤링 후 즉시 반영)
async function LottoData() {
  await connection();
  const store = await readStore();
  return <LottoTable draws={store.draws} updatedAt={store.updatedAt} />;
}

export default function DrawsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">역대 당첨번호</h1>
        <p className="mt-1 text-sm text-ink-3">
          출처:{" "}
          <a href={SOURCE_PAGE} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {SOURCE_PAGE}
          </a>{" "}
          · 저장 위치: <code className="rounded bg-grid px-1">data/lotto.json</code>
        </p>
      </header>
      <Suspense fallback={<p className="py-10 text-center text-sm text-ink-3">데이터 불러오는 중…</p>}>
        <LottoData />
      </Suspense>
    </main>
  );
}
