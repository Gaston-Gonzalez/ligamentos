export function MatchResultBadge({
  result,
  goalsFor,
  goalsAgainst,
}: {
  result: string | null | undefined;
  goalsFor: number;
  goalsAgainst: number;
}) {
  const tone =
    result === "W"
      ? "bg-emerald-100 text-emerald-800"
      : result === "D"
        ? "bg-amber-100 text-amber-900"
        : result === "L"
          ? "bg-rose-100 text-rose-800"
          : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}
    >
      <span>{result ?? "—"}</span>
      <span className="tabular-nums">
        {goalsFor}-{goalsAgainst}
      </span>
    </span>
  );
}
