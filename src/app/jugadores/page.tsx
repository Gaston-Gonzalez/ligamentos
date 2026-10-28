import Link from "next/link";
import type { ReactNode } from "react";
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
  | "gpg"
  | "assists"
  | "apg"
  | "gapg"
  | "streak";

type SortDir = "asc" | "desc";

const COLUMNS: {
  id: SortId;
  label: string;
  title?: string;
  defaultDir: SortDir;
  align?: "left" | "center";
}[] = [
  { id: "name", label: "Nombre", defaultDir: "asc", align: "left" },
  { id: "played", label: "Jugados", defaultDir: "desc" },
  { id: "eligible", label: "Hab.", title: "Habilitados", defaultDir: "desc" },
  { id: "pct", label: "%", title: "Asistencia", defaultDir: "desc" },
  { id: "justified", label: "Just.", title: "Justificadas", defaultDir: "desc" },
  { id: "wins", label: "Récord", defaultDir: "desc" },
  { id: "winrate", label: "WR", title: "Win rate", defaultDir: "desc" },
  { id: "goals", label: "Goles", defaultDir: "desc" },
  {
    id: "gpg",
    label: "GPG",
    title: "Goles por partido",
    defaultDir: "desc",
  },
  { id: "assists", label: "Asist.", title: "Asistencias", defaultDir: "desc" },
  {
    id: "apg",
    label: "APG",
    title: "Asistencias por partido",
    defaultDir: "desc",
  },
  {
    id: "gapg",
    label: "G/APG",
    title: "Goles + asistencias por partido",
    defaultDir: "desc",
  },
  { id: "streak", label: "Racha", defaultDir: "desc" },
];

function perGame(value: number, played: number): number {
  return played ? value / played : 0;
}

function formatPerGame(value: number, played: number): string {
  if (!played) return "—";
  return perGame(value, played).toFixed(2);
}

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
    case "gpg":
      return perGame(p.goals, p.played);
    case "assists":
      return p.assists;
    case "apg":
      return perGame(p.assists, p.played);
    case "gapg":
      return perGame(p.goals + p.assists, p.played);
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
      className={`px-2 py-3 text-xs font-semibold uppercase tracking-wide ${
        col.align === "left" ? "text-left" : "text-center"
      }`}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-0.5 hover:text-gold-soft ${
          active ? "text-gold-soft" : "text-white/85"
        }`}
        title={
          col.title ??
          (active
            ? `Ordenar ${nextDir === "asc" ? "ascendente" : "descendente"}`
            : `Ordenar por ${col.label}`)
        }
      >
        {col.label}
        <span className="inline-block w-3 text-[10px] opacity-90">{arrow}</span>
      </Link>
    </th>
  );
}

function StatCell({
  children,
  emphasize,
}: {
  children: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <td
      className={`px-2 py-3 text-center tabular-nums ${
        emphasize ? "font-semibold text-blue" : "text-ink"
      }`}
    >
      {children}
    </td>
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
    <div className="mx-auto max-w-7xl px-4 py-10">
      <SectionHeading
        title="Jugadores"
        subtitle="Presencias, habilitados, justificadas, récord, goles, asistencias y promedios por partido. Tocá una columna para ordenar."
      />

      <div className="overflow-x-auto surface rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="border-b border-line bg-blue-deep text-white">
            <tr>
              <th className="w-16 px-3 py-3" aria-hidden />
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
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/jugadores/${p.playerSlug}`}
                      className="block"
                      aria-label={p.playerName}
                    >
                      <PlayerAvatar
                        url={photo?.url}
                        crop={photo?.crop}
                        name={p.playerName}
                        className="h-14 w-14 shrink-0 rounded-xl border-[2.5px]"
                        fallback={p.playerName.slice(0, 1)}
                      />
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-left">
                    <Link
                      href={`/jugadores/${p.playerSlug}`}
                      className="font-semibold text-blue-deep hover:text-blue"
                    >
                      {p.playerName}
                    </Link>
                  </td>
                  <StatCell>{p.played}</StatCell>
                  <StatCell>{p.eligible}</StatCell>
                  <StatCell>{formatPct(p.attendancePct)}</StatCell>
                  <StatCell>{formatPct(p.justifiedPct)}</StatCell>
                  <StatCell>
                    {recordString(p.wins, p.draws, p.losses)}
                  </StatCell>
                  <StatCell>{formatPct(p.winRate)}</StatCell>
                  <StatCell emphasize>{p.goals}</StatCell>
                  <StatCell>{formatPerGame(p.goals, p.played)}</StatCell>
                  <StatCell emphasize>{p.assists}</StatCell>
                  <StatCell>{formatPerGame(p.assists, p.played)}</StatCell>
                  <StatCell emphasize>
                    {formatPerGame(p.goals + p.assists, p.played)}
                  </StatCell>
                  <StatCell>{p.longestStreak}</StatCell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
