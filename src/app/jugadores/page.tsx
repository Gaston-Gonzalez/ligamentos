import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";
import { resolvePlayerPhoto } from "@/lib/players";
import {
  computePlayerStats,
  formatPct,
  recordString,
} from "@/lib/stats";
import type { PlayerStats } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jugadores" };

type SortId =
  | "name"
  | "played"
  | "eligible"
  | "pct"
  | "justified"
  | "wins"
  | "winrate"
  | "goals"
  | "streak";

type SortDir = "asc" | "desc";

const COLUMNS: {
  id: SortId;
  label: string;
  defaultDir: SortDir;
  align?: "left" | "right";
}[] = [
  { id: "name", label: "Jugador", defaultDir: "asc", align: "left" },
  { id: "played", label: "Jugados", defaultDir: "desc" },
  { id: "eligible", label: "Hab.", defaultDir: "desc" },
  { id: "pct", label: "%", defaultDir: "desc" },
  { id: "justified", label: "Just.", defaultDir: "desc" },
  { id: "wins", label: "Récord", defaultDir: "desc" },
  { id: "winrate", label: "WR", defaultDir: "desc" },
  { id: "goals", label: "Goles", defaultDir: "desc" },
  { id: "streak", label: "Racha", defaultDir: "desc" },
];

function sortValue(p: PlayerStats, id: SortId): number | string {
  switch (id) {
    case "name":
      return p.playerName.toLowerCase();
    case "played":
      return p.played;
    case "eligible":
      return p.eligible;
    case "pct":
      return p.attendancePct;
    case "justified":
      return p.justifiedPct;
    case "wins":
      return p.wins * 10000 + p.draws * 100 + p.losses;
    case "winrate":
      return p.winRate;
    case "goals":
      return p.goals;
    case "streak":
      return p.longestStreak;
  }
}

function SortHeader({
  col,
  activeSort,
  activeDir,
}: {
  col: (typeof COLUMNS)[number];
  activeSort: SortId;
  activeDir: SortDir;
}) {
  const active = activeSort === col.id;
  const nextDir: SortDir = active
    ? activeDir === "desc"
      ? "asc"
      : "desc"
    : col.defaultDir;
  const href = `/jugadores?sort=${col.id}&dir=${nextDir}`;
  const arrow = !active ? "" : activeDir === "asc" ? " ↑" : " ↓";

  return (
    <th
      className={`px-3 py-3 text-sm font-semibold ${
        col.align === "left" ? "text-left" : "text-right"
      }`}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-0.5 hover:text-gold-soft ${
          active ? "text-gold-soft" : "text-white"
        }`}
        title={
          active
            ? `Ordenar ${nextDir === "asc" ? "ascendente" : "descendente"}`
            : `Ordenar por ${col.label}`
        }
      >
        {col.label}
        <span className="inline-block w-3 text-xs opacity-90">{arrow}</span>
      </Link>
    </th>
  );
}

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const sort = (COLUMNS.some((c) => c.id === params.sort)
    ? params.sort
    : "played") as SortId;
  const col = COLUMNS.find((c) => c.id === sort)!;
  const dir: SortDir =
    params.dir === "asc" || params.dir === "desc"
      ? params.dir
      : col.defaultDir;

  const data = await getData();
  const stats = computePlayerStats(data);

  const sorted = [...stats].sort((a, b) => {
    const av = sortValue(a, sort);
    const bv = sortValue(b, sort);
    let cmp = 0;
    if (typeof av === "string" && typeof bv === "string") {
      cmp = av.localeCompare(bv);
    } else {
      cmp = Number(av) - Number(bv);
    }
    if (cmp === 0) cmp = a.playerName.localeCompare(b.playerName);
    return dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title="Jugadores"
        subtitle="Presencias, habilitados, justificadas, récord y goles del plantel. Tocá una columna para ordenar."
      />

      <div className="overflow-x-auto surface rounded-2xl">
        <table className="min-w-full text-left text-base">
          <thead className="border-b border-line bg-blue-deep text-white">
            <tr>
              {COLUMNS.map((c) => (
                <SortHeader
                  key={c.id}
                  col={c}
                  activeSort={sort}
                  activeDir={dir}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const player = data.players.find((x) => x.slug === p.playerSlug);
              const photo = player
                ? resolvePlayerPhoto(player, data.photos)
                : null;
              return (
                <tr
                  key={p.playerSlug}
                  className="border-b border-line/70 transition hover:bg-white/60"
                >
                  <td className="w-52 max-w-52 px-3 py-3 font-semibold text-blue-deep">
                    <Link
                      href={`/jugadores/${p.playerSlug}`}
                      className="flex items-center gap-2.5"
                    >
                      <PlayerAvatar
                        url={photo?.url}
                        crop={photo?.crop}
                        name={p.playerName}
                        className="h-28 w-28 shrink-0 rounded-2xl border-[3px]"
                        fallback={p.playerName.slice(0, 1)}
                      />
                      <span className="min-w-0 truncate text-base leading-tight">
                        {p.playerName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.played}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {p.eligible}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatPct(p.attendancePct)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatPct(p.justifiedPct)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {recordString(p.wins, p.draws, p.losses)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatPct(p.winRate)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-blue">
                    {p.goals}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {p.longestStreak}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
