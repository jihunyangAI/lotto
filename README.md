# 로또대박기원 (Next.js)

<https://billyjodev.github.io/lotto/>의 로또 6/45 당첨번호를 크롤링해 `data/lotto.json`에 저장하고, 분석 대시보드와 표로 보여줍니다.

## 화면

- `/` 대시보드: 번호별 출현 빈도 차트, 많이/적게/오래 안 나온 번호, 홀짝 비율, 구간 분포, 최근 10회차 출현 패턴·번호 합계·상세표. 분석 범위(전체/최근 100·50·20회)와 보너스 포함 여부를 고를 수 있습니다.
- `/draws` 당첨번호: 역대 당첨번호 표와 **새 회차 수집** 버튼

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
```

화면의 **새 회차 수집** 버튼을 누르면 크롤링합니다. 이미 저장된 회차는 건너뛰고 새 회차만 추가합니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `src/lib/lotto.ts` | 크롤링, 검증, JSON 파일 읽기/쓰기, 중복 회차 건너뛰기 |
| `src/app/api/crawl/route.ts` | `POST /api/crawl`: 크롤링 실행 후 결과(추가/건너뜀 건수) 반환 |
| `src/app/api/lotto/route.ts` | `GET /api/lotto`: 저장된 데이터 반환 |
| `src/lib/analysis.ts` | 빈도, 홀짝, 구간, 합계 등 분석 함수 |
| `src/app/page.tsx`, `src/components/dashboard.tsx`, `charts.tsx` | 대시보드 화면과 차트 |
| `src/app/draws/page.tsx`, `src/components/lotto-table.tsx` | 당첨번호 표 화면 (검색, 정렬, 페이지 이동) |
| `data/lotto.json` | 수집 데이터 저장 파일 |

대상 페이지는 표를 `lotto_data.js`의 `LOTTO_DATA` 배열로 클라이언트에서 그립니다. 그래서 HTML 대신 이 파일을 받아 파싱합니다.

## 저장 형식

```json
{
  "source": "https://billyjodev.github.io/lotto/",
  "updatedAt": "2026-11-07T16:40:28.337Z",
  "draws": [
    { "round": 1217, "date": "2026-03-28", "numbers": [8,10,15,20,29,31], "bonus": 41, "prize": 2179738018, "winners": 14 }
  ]
}
```

`prize`는 1등 1인당 당첨금(원), `winners`는 1등 당첨자 수입니다.

> 파일 시스템에 저장하므로 `next start` 같은 일반 Node 서버에서 실행해야 합니다. Vercel 같은 서버리스 환경에서는 파일 쓰기가 유지되지 않습니다.
