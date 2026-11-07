"use client";

import { useEffect, useRef, useState } from "react";

/*
 * 로또 추첨기 애니메이션 (Canvas 2D + 간단한 물리)
 * - 투명한 구 안에서 45개 공이 공기에 날려 튀어 다니다가
 * - 정해진 번호(numbers)가 하나씩 배출구로 빨려 나와 관을 타고 아래 받침대에 놓인다.
 * - numbers 배열이 바뀔 때마다(배열 참조 기준) 새 추첨을 시작하고, 끝나면 onDone(numbers)를 부른다.
 */

// 논리 좌표계 (실제 크기는 컨테이너 너비에 맞춰 확대/축소)
const W = 320;
const H = 300;
const CX = 160;
const CY = 120;
const R = 104; // 구 반지름
const BR = 9; // 구 안 공 반지름
const TRAY_R = 17; // 받침대 공 반지름
const TRAY_Y = 270;
const slotX = (i: number) => CX + (i - 2.5) * 44;
const OUTLET_IN = { x: CX, y: CY + R - BR - 1 }; // 구 안쪽 배출구
const OUTLET_OUT = { x: CX, y: CY + R + 16 }; // 관 끝

const MIN_MIX_MS = 1300; // 추첨 전 최소 섞는 시간
const SEEK_MAX_MS = 450; // 공이 배출구로 빨려가는 최대 시간
const CHUTE_MS = 520; // 관을 타고 내려오는 시간
const GAP_MS = 150; // 공 사이 간격

const BALL_COLORS = [
  { base: "#fbbf24", light: "#fde68a", dark: "#b45309", text: "#451a03" },
  { base: "#0ea5e9", light: "#7dd3fc", dark: "#0369a1", text: "#ffffff" },
  { base: "#f43f5e", light: "#fda4af", dark: "#be123c", text: "#ffffff" },
  { base: "#71717a", light: "#d4d4d8", dark: "#3f3f46", text: "#ffffff" },
  { base: "#10b981", light: "#6ee7b7", dark: "#047857", text: "#ffffff" },
];
const colorOf = (n: number) => BALL_COLORS[Math.min(4, Math.floor((n - 1) / 10))];

type Ball = {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: "in" | "seek" | "chute" | "tray";
  t0: number;
  sx: number;
  sy: number;
  slot: number;
};

type Sim = {
  balls: Ball[];
  phase: "idle" | "mixing" | "drawing" | "done";
  target: number[] | null; // 현재 추첨 대상 (참조로 식별)
  order: number[]; // 배출 순서
  drawIndex: number;
  mixStart: number;
  premixed: boolean; // AI 응답을 기다리며 이미 섞고 있었는지
  nextAt: number;
  current: Ball | null;
  calmFrames: number;
  running: boolean;
  last: number;
  theme: { tray: string; slot: string; line: string };
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function spawnInSphere(b: Ball, top = false) {
  const ang = rand(0, Math.PI * 2);
  const dist = Math.sqrt(Math.random()) * (R - BR - 4);
  b.x = CX + Math.cos(ang) * dist * (top ? 0.6 : 1);
  b.y = top ? CY - R * 0.45 + rand(-12, 12) : CY + Math.sin(ang) * dist;
  b.vx = rand(-40, 40);
  b.vy = rand(-40, 40);
  b.state = "in";
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function readTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return { tray: v("--grid", "#ebeae6"), slot: v("--line", "#e4e3df"), line: v("--ink-3", "#7c7b76") };
}

/* ---------------- 물리 ---------------- */

function step(sim: Sim, dt: number, blower: boolean) {
  const active = sim.balls.filter((b) => b.state === "in" || b.state === "seek");
  for (const b of active) {
    if (b.state === "seek") {
      // 배출구로 끌어당김 (중력 무시)
      b.vx = (b.vx + (OUTLET_IN.x - b.x) * 140 * dt) * 0.88;
      b.vy = (b.vy + (OUTLET_IN.y - b.y) * 140 * dt) * 0.88;
    } else {
      b.vy += 800 * dt; // 중력
      if (blower) {
        const depth = (b.y - CY) / R; // -1(위) ~ 1(아래)
        // 바닥 쪽에서 무작위로 터지는 강한 공기 분출 → 공이 위로 튕겨 오름
        if (depth > 0.2 && Math.random() < 9 * dt) {
          b.vy -= rand(500, 1000);
          b.vx += rand(-380, 380);
        }
        // 아래쪽 약한 상승 기류 + 구 안을 도는 회전 기류
        if (depth > 0) b.vy -= 700 * depth * dt;
        b.vx += (-(b.y - CY) / R) * 300 * dt;
        b.vy += ((b.x - CX) / R) * 300 * dt;
      }
      b.vx *= 0.997;
      b.vy *= 0.997;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1000) {
        b.vx *= 1000 / sp;
        b.vy *= 1000 / sp;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 구 벽 충돌
    const dx = b.x - CX;
    const dy = b.y - CY;
    const d = Math.hypot(dx, dy) || 1;
    const max = R - BR;
    if (d > max) {
      const nx = dx / d;
      const ny = dy / d;
      b.x = CX + nx * max;
      b.y = CY + ny * max;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        const e = blower ? 0.85 : 0.45;
        b.vx -= (1 + e) * vn * nx;
        b.vy -= (1 + e) * vn * ny;
        b.vx *= 0.98; // 벽 마찰
      }
    }
  }

  // 공끼리 충돌 (같은 질량, 배출 중인 공은 밀리지 않음)
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = BR * 2;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = min - d;
      const aFixed = a.state === "seek";
      const bFixed = b.state === "seek";
      if (aFixed && bFixed) continue;
      const wa = aFixed ? 0 : bFixed ? 1 : 0.5;
      const wb = 1 - wa;
      a.x -= nx * overlap * wa;
      a.y -= ny * overlap * wa;
      b.x += nx * overlap * wb;
      b.y += ny * overlap * wb;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) {
        const imp = -(1 + 0.9) * rv;
        if (!aFixed) {
          a.vx -= imp * nx * (bFixed ? 1 : 0.5);
          a.vy -= imp * ny * (bFixed ? 1 : 0.5);
        }
        if (!bFixed) {
          b.vx += imp * nx * (aFixed ? 1 : 0.5);
          b.vy += imp * ny * (aFixed ? 1 : 0.5);
        }
      }
    }
  }
}

function chutePos(b: Ball, t: number) {
  const e = easeInOut(Math.min(1, t));
  const split = 0.3;
  if (e < split) {
    const k = e / split;
    return { x: b.sx + (OUTLET_OUT.x - b.sx) * k, y: b.sy + (OUTLET_OUT.y - b.sy) * k, r: BR };
  }
  // 관 끝 → 받침대 칸 (2차 베지어)
  const k = (e - split) / (1 - split);
  const p0 = OUTLET_OUT;
  const p1 = { x: CX, y: TRAY_Y };
  const p2 = { x: slotX(b.slot), y: TRAY_Y };
  const u = 1 - k;
  return {
    x: u * u * p0.x + 2 * u * k * p1.x + k * k * p2.x,
    y: u * u * p0.y + 2 * u * k * p1.y + k * k * p2.y,
    r: BR + (TRAY_R - BR) * k,
  };
}

/* ---------------- 그리기 ---------------- */

function drawBall(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, r: number) {
  const c = colorOf(n);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, c.light);
  g.addColorStop(0.45, c.base);
  g.addColorStop(1, c.dark);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = c.text;
  ctx.font = `700 ${Math.round(r * (n >= 10 ? 0.95 : 1.05))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), x, y + r * 0.06);
}

function render(ctx: CanvasRenderingContext2D, sim: Sim, now: number, blower: boolean) {
  ctx.clearRect(0, 0, W, H);
  const { theme } = sim;

  // 받침대
  const left = slotX(0) - TRAY_R - 9;
  const right = slotX(5) + TRAY_R + 9;
  ctx.fillStyle = theme.tray;
  ctx.beginPath();
  ctx.roundRect(left, TRAY_Y - TRAY_R - 7, right - left, (TRAY_R + 7) * 2, TRAY_R + 7);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(slotX(i), TRAY_Y, TRAY_R + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = theme.slot;
    ctx.fill();
  }

  // 배출관 (유리)
  ctx.beginPath();
  ctx.roundRect(CX - BR - 4, CY + R - 6, (BR + 4) * 2, 26, 6);
  ctx.fillStyle = "rgba(160, 190, 230, 0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 145, 180, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 구 내부 (유리 배경)
  const glass = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.35, R * 0.1, CX, CY, R);
  glass.addColorStop(0, "rgba(255, 255, 255, 0.10)");
  glass.addColorStop(1, "rgba(150, 180, 220, 0.20)");
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.fillStyle = glass;
  ctx.fill();

  // 공기 분출 느낌
  if (blower) {
    const air = ctx.createRadialGradient(CX, CY + R, 4, CX, CY + R, R * 0.9);
    air.addColorStop(0, "rgba(200, 230, 255, 0.35)");
    air.addColorStop(1, "rgba(200, 230, 255, 0)");
    ctx.fillStyle = air;
    ctx.fill();
  }

  // 구 안의 공
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R - 1, 0, Math.PI * 2);
  ctx.clip();
  for (const b of sim.balls) if (b.state === "in" || b.state === "seek") drawBall(ctx, b.n, b.x, b.y, BR);
  ctx.restore();

  // 유리 테두리와 반사광 (공 위에 덮어 그림)
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(120, 145, 180, 0.7)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CX, CY, R - 8, Math.PI * 1.08, Math.PI * 1.42);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CX, CY, R - 8, Math.PI * 1.5, Math.PI * 1.56);
  ctx.stroke();

  // 받침대 공, 관을 타는 공
  for (const b of sim.balls) {
    if (b.state === "tray") drawBall(ctx, b.n, slotX(b.slot), TRAY_Y, TRAY_R);
    if (b.state === "chute") {
      const p = chutePos(b, (now - b.t0) / CHUTE_MS);
      drawBall(ctx, b.n, p.x, p.y, p.r);
    }
  }
}

/* ---------------- 컴포넌트 ---------------- */

export default function LottoMachine({
  numbers,
  mixing,
  onDone,
}: {
  numbers: number[] | null; // 뽑을 번호 (배열 참조가 바뀌면 새 추첨)
  mixing: boolean; // AI 응답 대기 중 등, 섞기만 할 때
  onDone?: (numbers: number[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const mixingRef = useRef(mixing);
  const onDoneRef = useRef(onDone);
  const wakeRef = useRef<() => void>(() => {});
  const [finishedFor, setFinishedFor] = useState<number[] | null>(null); // 추첨이 끝난 번호 배열
  const drawing = numbers !== null && finishedFor !== numbers;
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // 시뮬레이션 루프 (마운트 시 1회)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const sim: Sim = {
      balls: Array.from({ length: 45 }, (_, i) => {
        const b: Ball = { n: i + 1, x: 0, y: 0, vx: 0, vy: 0, state: "in", t0: 0, sx: 0, sy: 0, slot: 0 };
        spawnInSphere(b);
        return b;
      }),
      phase: "idle",
      target: null,
      order: [],
      drawIndex: 0,
      mixStart: 0,
      premixed: false,
      nextAt: 0,
      current: null,
      calmFrames: 0,
      running: false,
      last: 0,
      theme: readTheme(),
    };
    simRef.current = sim;

    let raf = 0;
    let scale = 1;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      scale = w / W;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(H * scale * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      render(ctx, sim, performance.now(), false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - (sim.last || now)) / 1000);
      sim.last = now;
      const blower = mixingRef.current || sim.phase === "mixing" || sim.phase === "drawing";

      if (sim.phase === "mixing" && now - sim.mixStart >= MIN_MIX_MS) {
        sim.phase = "drawing";
        sim.nextAt = now;
      }
      if (sim.phase === "drawing" && !sim.current && now >= sim.nextAt && sim.drawIndex < sim.order.length) {
        const ball = sim.balls[sim.order[sim.drawIndex] - 1];
        ball.state = "seek";
        ball.t0 = now;
        sim.current = ball;
      }

      const sub = 3;
      for (let i = 0; i < sub; i++) step(sim, dt / sub, blower);

      const cur = sim.current;
      if (cur?.state === "seek" && (Math.hypot(cur.x - OUTLET_IN.x, cur.y - OUTLET_IN.y) < 5 || now - cur.t0 > SEEK_MAX_MS)) {
        cur.state = "chute";
        cur.t0 = now;
        cur.sx = cur.x;
        cur.sy = cur.y;
        cur.slot = sim.drawIndex;
      }
      if (cur?.state === "chute" && now - cur.t0 >= CHUTE_MS) {
        cur.state = "tray";
        sim.current = null;
        sim.drawIndex++;
        sim.nextAt = now + GAP_MS;
        setAnnounce(`${sim.drawIndex}번째 공: ${cur.n}번`);
        if (sim.drawIndex >= sim.order.length) {
          sim.phase = "done";
          const target = sim.target;
          if (target) {
            setFinishedFor(target);
            onDoneRef.current?.(target);
          }
        }
      }

      render(ctx, sim, now, blower);

      // 섞기·배출이 없으면 공이 가라앉을 시간(약 2.5초)만 돌리고 루프 정지 (CPU 절약)
      // 쌓인 공은 충돌로 미세하게 계속 흔들리므로 속도 대신 시간으로 판단한다
      const animating = blower || sim.balls.some((b) => b.state === "seek" || b.state === "chute");
      sim.calmFrames = animating ? 0 : sim.calmFrames + 1;
      if (sim.calmFrames > 150) {
        sim.running = false;
        sim.last = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (sim.running) return;
      sim.running = true;
      sim.calmFrames = 0;
      sim.theme = readTheme();
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;
    wake(); // 처음에 공을 바닥에 가라앉힘

    // 테마가 바뀌면(OS 다크 모드, 사이트 테마 전환) 색을 다시 읽어 다시 그림
    const retheme = () => {
      sim.theme = readTheme();
      if (!sim.running) render(ctx, sim, performance.now(), false);
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", retheme);
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", retheme);
      sim.running = false;
    };
  }, []);

  // 받침대에 있던 공을 구로 되돌림
  const returnBalls = (sim: Sim) => {
    for (const b of sim.balls) if (b.state !== "in") spawnInSphere(b, true);
    sim.current = null;
  };

  // 섞기 상태 변경
  useEffect(() => {
    mixingRef.current = mixing;
    const sim = simRef.current;
    if (!sim) return;
    if (mixing && (sim.phase === "done" || sim.phase === "idle")) {
      returnBalls(sim);
      sim.phase = "idle";
      sim.mixStart = performance.now(); // 대기 중 섞은 시간도 최소 섞기 시간에 포함
      sim.premixed = true;
    }
    if (!mixing && sim.phase === "idle" && !sim.target) sim.premixed = false;
    wakeRef.current();
  }, [mixing]);

  // 새 추첨
  useEffect(() => {
    const sim = simRef.current;
    if (!sim || !numbers || sim.target === numbers) return;
    sim.target = numbers;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sim.phase !== "idle" || sim.balls.some((b) => b.state !== "in")) {
      returnBalls(sim);
      sim.mixStart = performance.now();
    } else if (!sim.premixed) {
      sim.mixStart = performance.now();
    }
    sim.premixed = false;
    sim.order = shuffle(numbers);
    sim.drawIndex = 0;

    if (reduced) {
      // 동작 줄이기 설정: 애니메이션 없이 바로 받침대에 놓기
      sim.order.forEach((n, i) => Object.assign(sim.balls[n - 1], { state: "tray", slot: i }));
      sim.drawIndex = sim.order.length;
      sim.phase = "done";
      queueMicrotask(() => {
        setFinishedFor(numbers);
        onDoneRef.current?.(numbers);
      });
    } else {
      sim.phase = "mixing";
    }
    wakeRef.current();
  }, [numbers]);

  function skip() {
    const sim = simRef.current;
    if (!sim || !sim.target) return;
    for (let i = sim.drawIndex; i < sim.order.length; i++) {
      Object.assign(sim.balls[sim.order[i] - 1], { state: "tray", slot: i });
    }
    sim.current = null;
    sim.drawIndex = sim.order.length;
    sim.phase = "done";
    setFinishedFor(sim.target);
    onDoneRef.current?.(sim.target);
    wakeRef.current();
  }

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="로또 추첨기: 투명한 구 안에서 번호 공이 섞이다가 하나씩 나옵니다"
        className="block w-full"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      {drawing && (
        <button
          type="button"
          onClick={skip}
          className="absolute right-0 top-0 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] text-ink-2 backdrop-blur hover:bg-grid"
        >
          건너뛰기
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
