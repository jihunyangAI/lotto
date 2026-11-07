# 로또대박기원 (Next.js)

<https://billyjodev.github.io/lotto/>의 로또 6/45 당첨번호를 크롤링해 `data/lotto.json`에 저장하고, 분석 대시보드와 표로 보여줍니다.

## 화면

- `/` 대시보드: 번호별 출현 빈도 차트, 많이/적게/오래 안 나온 번호, 홀짝 비율, 구간 분포, 최근 10회차 출현 패턴·번호 합계·상세표. 분석 범위(전체/최근 100·50·20회)와 보너스 포함 여부를 고를 수 있습니다.
- `/recommend` 번호 추천: 세 가지 모드
  1. **랜덤 추천**: 브라우저에서 `crypto.getRandomValues`로 1~45 중 중복 없이 6개
  2. **AI 자동 추천**: Gemini가 당첨 통계를 보고 번호 6개와 근거를 제시 (요청마다 서버가 추천 관점을 무작위로 지정해 같은 조합 반복을 줄임)
  3. **조건 입력 AI 추천**: 사용자가 적은 조건과 당첨 데이터를 Gemini에 보내 번호 6개를 받음. 서버가 포함/제외 번호, 홀수 개수, 합계 범위, 연속번호 조건을 직접 검사해 어기면 다시 요청하고, 끝내 못 지킨 조건은 화면에 표시
  - 모든 모드에서 추천 조합의 홀짝, 합계, 구간 분포, 과거 1등 번호와 최대 일치 개수를 데이터로 계산해 함께 보여줍니다.
  - **추첨기 애니메이션** (`src/components/lotto-machine.tsx`): 투명한 구 안에서 45개 공이 공기에 날려 튀다가 추천 번호가 하나씩 배출구로 나와 받침대에 놓입니다 (Canvas 2D + 간단한 물리). AI 모드는 응답을 기다리는 동안 공을 섞고, 6개가 다 나오면 결과를 공개합니다. 건너뛰기 버튼이 있고, 동작 줄이기 설정 사용자에게는 애니메이션 없이 바로 보여줍니다.
- `/draws` 당첨번호: 역대 당첨번호 표와 **새 회차 수집** 버튼
- 대시보드 하단 **AI 분석**: 분석 요청을 입력하면 서버의 전체 당첨 데이터와 함께 Gemini에 보내고, HTML 보고서로 받아 표시합니다.

## AI 분석 설정 (Gemini)

1. <https://aistudio.google.com/apikey> 에서 API 키를 발급합니다.
2. 프로젝트 루트의 `.env.local`에 키를 넣습니다 (형식은 `.env.example` 참고, `.env.local`은 git에 올라가지 않음).
   ```
   GEMINI_API_KEY=발급받은_키
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```
3. 서버를 재시작합니다.

- 서버가 미리 계산한 통계(번호별 출현 횟수, 홀짝·구간 분포, 합계)와 전체 회차 원본을 프롬프트에 넣어, 모델이 직접 세다 틀리는 일을 줄였습니다.
- 모델 응답은 서버에서 `sanitize-html`로 허용 태그만 남긴 뒤 화면에 넣습니다 (script, 이벤트 속성, 링크, 이미지, style 제거).
- 요청은 500자로 제한하고, 응답 대기 시간은 최대 60초입니다. Gemini 과부하(500/503) 때는 자동으로 2번까지 다시 시도합니다.
- 분석 결과 아래 **PDF 저장** 버튼으로 `로또분석_YYYYMMDD.pdf`(A4, 여백 상하좌우 15mm)를 내려받습니다. `src/lib/report-pdf.ts`에서 html2pdf.js로 만듭니다.

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
| `src/lib/gemini.ts` | Gemini 프롬프트·데이터 컨텍스트 구성, 호출, 응답 HTML 정화 |
| `src/app/api/ai-analysis/route.ts` | `POST /api/ai-analysis`: `{ question }` → `{ ok, html }` |
| `src/components/ai-analysis.tsx` | AI 분석 입력창과 결과 표시 |
| `src/lib/combo.ts` | 랜덤 선택, 번호 검증, 조합 특성 계산 (공용) |
| `src/lib/recommend.ts` | AI 추천 프롬프트·JSON 스키마, 조건 검증과 재요청 |
| `src/app/api/recommend/route.ts` | `POST /api/recommend`: `{ mode: "auto" }` 또는 `{ mode: "prompt", condition }` |
| `src/app/recommend/page.tsx`, `src/components/recommend.tsx` | 번호 추천 화면 |
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
