import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { SectionHeading } from "@/components/SectionHeading";
import { StatCard } from "@/components/StatCard";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getData } from "@/lib/data";
import { displayPlayerName, resolvePlayerPhoto } from "@/lib/players";
import {
  computePlayerStats,
  formatPct,
  recordString,
  statusLabel,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

function matchesPlayer(
  player: { name: string; slug: string; aliases?: string[] },
  value: string | null | undefined,
) {
  if (!value) return false;
  const keys = new Set(
    [player.name, player.slug, ...(player.aliases ?? [])].map((s) =>
      s.toLowerCase(),
    ),
  );
  return keys.has(value.toLowerCase());
}

export default async function JugadorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getData();
  const player = data.players.find((p) => p.slug === slug);
  if (!player) notFound();

  const global = computePlayerStats(data).find((p) => p.playerSlug === slug)!;
  const byChamp = data.championships
    .map((c) => {
      const stats = computePlayerStats(data, c.slug).find(
        (p) => p.playerSlug === slug,
      );
      return { championship: c, stats };
    })
    .filter((x) => x.stats && x.stats.eligible > 0);

  const history = data.attendances
    .filter((a) => matchesPlayer(player, a.player))
    .map((a) => {
      const match = data.matches.find((m) => m.index === a.matchIndex)!;
      return { ...a, match };
    })
    .filter((x) => x.match)
    .sort((a, b) => (b.match.date ?? "").localeCompare(a.match.date ?? ""));

  const photos = (data.photos ?? []).filter((p) =>
    (p.taggedPlayerSlugs ?? []).includes(slug),
  );
  const avatar = resolvePlayerPhoto(player, data.photos);

  const goals = data.goals.filter(
    (g) => matchesPlayer(player, g.player) && !g.isOwnGoal,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end">
        <PlayerAvatar
          url={avatar?.url}
          crop={avatar?.crop}
          name={player.name}
          fallback={player.number ?? player.name.slice(0, 1)}
        />
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-muted">
            {player.position ?? "Jugador"}
            {player.number != null ? ` · #${player.number}` : ""}
          </p>
          <h1 className="display text-4xl text-blue-deep md:text-5xl">
            {player.name}
          </h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Presencias"
          value={`${global.played}/${global.eligible}`}
          hint={formatPct(global.attendancePct)}
        />
        <StatCard
          label="Justificadas"
          value={formatPct(global.justifiedPct)}
        />
        <StatCard
          label="Récord"
          value={recordString(global.wins, global.draws, global.losses)}
          hint={`WR ${formatPct(global.winRate)}`}
        />
        <StatCard
          label="Goles / Racha"
          value={`${goals.length} / ${global.longestStreak}`}
        />
      </div>

      <div className="mt-10">
        <SectionHeading title="Por campeonato" />
        <div className="overflow-x-auto surface rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-deep text-white">
              <tr>
                <th className="px-4 py-3 text-left">Torneo</th>
                <th className="px-3 py-3">Jugados</th>
                <th className="px-3 py-3">%</th>
                <th className="px-3 py-3">Récord</th>
              </tr>
            </thead>
            <tbody>
              {byChamp.map(({ championship, stats }) => (
                <tr key={championship.slug} className="border-b border-line">
                  <td className="px-4 py-3">
                    <Link href={`/campeonatos/${championship.slug}`}>
                      {championship.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {stats!.played}/{stats!.eligible}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {formatPct(stats!.attendancePct)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {recordString(stats!.wins, stats!.draws, stats!.losses)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <SectionHeading title="Historial" />
        <ul className="space-y-2">
          {history.map((h) => (
            <li key={h.matchIndex}>
              <Link
                href={`/partidos/${h.matchIndex}`}
                className="surface flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold">vs {h.match.rival}</p>
                  <p className="text-sm text-muted">
                    {h.match.championship}
                    {h.match.date ? ` · ${h.match.date}` : ""} ·{" "}
                    {statusLabel(h.status)}
                  </p>
                </div>
                <MatchResultBadge
                  result={h.match.result}
                  goalsFor={h.match.goalsFor}
                  goalsAgainst={h.match.goalsAgainst}
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {photos.length > 0 ? (
        <div className="mt-10">
          <SectionHeading
            title="Fotos etiquetadas"
            subtitle="Fotos de Liga Pro donde aparece este jugador."
          />
          <PhotoCarousel
            players={data.players.map((pl) => ({
              slug: pl.slug,
              name: pl.name,
            }))}
            photos={photos.map((p) => ({
              imageUrl: p.imageUrl,
              caption: p.caption ?? player.name,
              tags: (p.taggedPlayerSlugs ?? []).map((s) =>
                displayPlayerName(data, s),
              ),
              taggedPlayerSlugs: p.taggedPlayerSlugs ?? [],
            }))}
            alt={player.name}
          />
        </div>
      ) : null}
    </div>
  );
}
