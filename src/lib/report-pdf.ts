// AI 분석 보고서를 PDF로 저장 (클라이언트 전용, html2pdf.js)
import type html2pdfType from "html2pdf.js";

type Html2PdfOptions = Parameters<InstanceType<(typeof html2pdfType)["Worker"]>["set"]>[0];

const MARGIN_MM = 15;

/** 로또분석_YYYYMMDD.pdf (로컬 날짜 기준) */
export function reportFileName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `로또분석_${y}${m}${d}.pdf`;
}

/*
 * html2pdf.js 0.14가 쓰는 html2canvas 1.x는 Tailwind v4의 oklch() 색을 해석하지 못한다.
 * 그래서 캡처용 복제 문서에서는 사이트 스타일시트를 모두 걷어내고, hex 색만 쓰는 아래 스타일만 적용한다.
 * (PDF는 화면 테마와 관계없이 항상 밝은 배경으로 출력)
 */
const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid #e4e3df; }
  .pdf-root {
    width: 100%;
    background: #ffffff;
    color: #0b0b0b;
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 13px;
    line-height: 1.7;
    padding-bottom: 6px;
  }
  .pdf-header { border-bottom: 2px solid #0b0b0b; padding-bottom: 10px; margin-bottom: 16px; }
  .pdf-brand { font-size: 11px; color: #7c7b76; letter-spacing: 0.02em; }
  .pdf-title { font-size: 20px; font-weight: 700; margin-top: 2px; }
  .pdf-meta { margin-top: 6px; font-size: 11px; color: #52514e; }
  .pdf-meta div + div { margin-top: 2px; }
  .ai-report > * + * { margin-top: 10px; }
  .ai-report h3 { font-size: 16px; font-weight: 700; }
  .ai-report h4 { margin-top: 16px; font-size: 14px; font-weight: 700; }
  .ai-report p { margin-top: 8px; }
  .ai-report ul, .ai-report ol { padding-left: 20px; }
  .ai-report ul { list-style: disc; }
  .ai-report ol { list-style: decimal; }
  .ai-report li + li { margin-top: 3px; }
  .ai-report strong { font-weight: 700; }
  .ai-report em { font-style: italic; }
  .ai-report table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .ai-report th, .ai-report td { border: 1px solid #d6d5d0; padding: 5px 8px; text-align: left; vertical-align: middle; }
  .ai-report th { background: #f4f4f2; color: #52514e; font-weight: 600; }
  .ai-report blockquote {
    border-left: 3px solid #d6d5d0;
    padding: 4px 0 4px 10px;
    font-size: 11px;
    color: #7c7b76;
  }
  .ai-report .ball {
    display: inline-block;
    width: 22px;
    height: 22px;
    margin: 0 1px;
    border-radius: 11px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    line-height: 22px;
    vertical-align: middle;
    color: #ffffff;
    background: #7c7b76;
  }
  .ai-report .ball-1 { background: #fbbf24; color: #451a03; }
  .ai-report .ball-2 { background: #0ea5e9; }
  .ai-report .ball-3 { background: #f43f5e; }
  .ai-report .ball-4 { background: #71717a; }
  .ai-report .ball-5 { background: #10b981; }
  .pdf-footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e4e3df; font-size: 10px; color: #7c7b76; }
`;

function text(tag: string, className: string, value: string) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = value; // 사용자 입력은 textContent로만 넣는다
  return el;
}

function buildPdfElement(reportHtml: string, question: string, model: string, createdAt: Date) {
  const root = document.createElement("div");
  root.className = "pdf-root";

  const header = document.createElement("div");
  header.className = "pdf-header";
  header.append(text("div", "pdf-brand", "로또대박기원 · AI 분석 보고서"), text("div", "pdf-title", "로또 당첨번호 AI 분석"));
  const meta = document.createElement("div");
  meta.className = "pdf-meta";
  meta.append(
    text("div", "", `분석 요청: ${question}`),
    text("div", "", `생성 일시: ${createdAt.toLocaleString("ko-KR")} · 모델: ${model}`),
  );
  header.append(meta);

  const body = document.createElement("div");
  body.className = "ai-report";
  body.innerHTML = reportHtml; // 서버에서 허용 태그만 남기도록 정화된 HTML

  root.append(header, body, text("div", "pdf-footer", "로또는 무작위 추첨입니다. 이 보고서는 과거 통계를 정리한 참고 자료이며 당첨을 보장하지 않습니다."));
  return root;
}

export async function saveReportPdf(opts: { html: string; question: string; model: string }) {
  const { default: html2pdf } = await import("html2pdf.js");
  const createdAt = new Date();
  const element = buildPdfElement(opts.html, opts.question, opts.model, createdAt);

  // pagebreak은 지원 옵션이지만 패키지 타입 정의에 빠져 있어 교차 타입으로 보완
  const options: Html2PdfOptions & { pagebreak: { mode: string[]; avoid: string[] } } = {
    margin: [MARGIN_MM, MARGIN_MM, MARGIN_MM, MARGIN_MM], // 상, 좌, 하, 우 (mm)
    filename: reportFileName(createdAt),
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      onclone: (doc: Document) => {
        doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());
        const style = doc.createElement("style");
        style.textContent = PDF_CSS;
        doc.head.appendChild(style);
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    // 표의 행, 제목, 번호 공이 페이지 경계에서 잘리지 않도록
    pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "h3", "h4", "blockquote", "li"] },
  };

  // Tailwind 기본 스타일의 `img { display: block }`이 html2canvas의 글자 기준선 측정을 어긋나게 해
  // 모든 글자가 몇 px 아래로 그려진다. PDF를 만드는 동안만 원래 문서에 보정 규칙을 넣었다가 뺀다.
  const fix = document.createElement("style");
  fix.textContent = "img { display: inline !important; vertical-align: baseline !important; }";
  document.head.appendChild(fix);
  try {
    await html2pdf().set(options).from(element).save();
  } finally {
    fix.remove();
  }
}
