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

export const dynamic = "force-dynamic";
export const metadata = { title: "Jugadores" };

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort = "played" } = await searchParams;
  const data = await getData();
  const stats = computePlayerStats(data);

  const sorted = [...stats].sort((a, b) => {
    switch (sort) {
      case "pct":
        return b.attendancePct - a.attendancePct;
      case "justified":
        return b.justifiedPct - a.justifiedPct;
      case "goals":
        return b.goals - a.goals;
      case "winrate":
        return b.winRate - a.winRate;
      case "streak":
        return b.longestStreak - a.longestStreak;
      case "name":
        return a.playerName.localeCompare(b.playerName);
      default:
        return b.played - a.played;
    }
  });

  const sorts = [
    { id: "played", label: "Presencias" },
    { id: "pct", label: "% Hab." },
    { id: "justified", label: "Justificadas" },
    { id: "goals", label: "Goles" },
    { id: "winrate", label: "Win rate" },
    { id: "streak", label: "Racha" },
    { id: "name", label: "Nombre" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title="Jugadores"
        subtitle="Presencias, habilitados, justificadas, récord y goles del plantel."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {sorts.map((s) => (
          <Link
            key={s.id}
            href={`/jugadores?sort=${s.id}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              sort === s.id
                ? "bg-blue text-white"
                : "border border-line bg-white/70 text-muted"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto surface rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-blue-deep text-white">
            <tr>
              <th className="px-4 py-3">Jugador</th>
              <th className="px-3 py-3">Jugados</th>
              <th className="px-3 py-3">Hab.</th>
              <th className="px-3 py-3">%</th>
              <th className="px-3 py-3">Just.</th>
              <th className="px-3 py-3">Récord</th>
              <th className="px-3 py-3">WR</th>
              <th className="px-3 py-3">Goles</th>
              <th className="px-3 py-3">Racha</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const player = data.players.find((x) => x.slug === p.playerSlug);
              const photo = player
                ? resolvePlayerPhoto(player, data.photos)
                : null;
              return (
              <tr key={p.playerSlug} className="border-b border-line/70">
                <td className="px-4 py-3 font-semibold text-blue-deep">
                  <Link
                    href={`/jugadores/${p.playerSlug}`}
                    className="inline-flex items-center gap-2.5"
                  >
                    <PlayerAvatar
                      url={photo?.url}
                      crop={photo?.crop}
                      name={p.playerName}
                      className="h-8 w-8 border-2"
                      fallback={p.playerName.slice(0, 1)}
                    />
                    {p.playerName}
                  </Link>
                </td>
                <td className="px-3 py-3 tabular-nums">{p.played}</td>
                <td className="px-3 py-3 tabular-nums">{p.eligible}</td>
                <td className="px-3 py-3 tabular-nums">
                  {formatPct(p.attendancePct)}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {formatPct(p.justifiedPct)}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {recordString(p.wins, p.draws, p.losses)}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {formatPct(p.winRate)}
                </td>
                <td className="px-3 py-3 tabular-nums font-semibold text-blue">
                  {p.goals}
                </td>
                <td className="px-3 py-3 tabular-nums">{p.longestStreak}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
