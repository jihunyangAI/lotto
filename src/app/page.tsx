import { Suspense } from "react";
import { connection } from "next/server";
import { readStore } from "@/lib/lotto";
import Dashboard from "@/components/dashboard";

async function DashboardData() {
  await connection();
  const store = await readStore();
  return <Dashboard draws={store.draws} updatedAt={store.updatedAt} />;
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">당첨번호 분석 대시보드</h1>
        <p className="mt-1 text-sm text-ink-3">역대 로또 6/45 당첨번호로 본 출현 빈도, 홀짝, 구간 분포, 최근 흐름</p>
      </header>
      <Suspense fallback={<p className="py-16 text-center text-sm text-ink-3">분석 데이터를 불러오는 중…</p>}>
        <DashboardData />
      </Suspense>
    </main>
  );
}
