// 로또 공 색 (국내 로또 관례: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록)
export function ballColor(n: number) {
  if (n <= 10) return "bg-amber-400 text-amber-950";
  if (n <= 20) return "bg-sky-500 text-white";
  if (n <= 30) return "bg-rose-500 text-white";
  if (n <= 40) return "bg-zinc-500 text-white";
  return "bg-emerald-500 text-white";
}

const SIZES = {
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-11 w-11 text-base",
};

export default function Ball({ n, size = "md" }: { n: number; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ${SIZES[size]} ${ballColor(n)}`}
    >
      {n}
    </span>
  );
}
