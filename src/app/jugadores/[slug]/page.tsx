import Link from "next/link";
import { notFound } from "next/navigation";
import { IoFootball } from "react-icons/io5";
import { AssistIcon } from "@/components/AssistIcon";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { SectionHeading } from "@/components/SectionHeading";
import { StatCard } from "@/components/StatCard";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getData } from "@/lib/data";
import { displayPlayerName, resolvePlayerPhoto } from "@/lib/players";
import { loadRivalCrests, resolveCrestUrl } from "@/lib/rivals";
import {
  computePlayerStats,
  formatPct,
  recordString,
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
  const crests = await loadRivalCrests();
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

  const playerGoals = data.goals.filter(
    (g) => matchesPlayer(player, g.player) && !g.isOwnGoal,
  );
  const playerAssists = data.goals.filter((g) =>
    matchesPlayer(player, g.assistPlayer),
  );

  const history = data.attendances
    .filter((a) => matchesPlayer(player, a.player) && a.status === "present")
    .map((a) => {
      const match = data.matches.find((m) => m.index === a.matchIndex);
      if (!match) return null;
      const goalsInMatch = playerGoals.filter(
        (g) => g.matchIndex === a.matchIndex,
      ).length;
      const assistsInMatch = playerAssists.filter(
        (g) => g.matchIndex === a.matchIndex,
      ).length;
      return {
        matchIndex: a.matchIndex,
        match,
        goalsInMatch,
        assistsInMatch,
        crestUrl: resolveCrestUrl(match.rival, crests),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => (b.match.date ?? "").localeCompare(a.match.date ?? ""));

  const photos = (data.photos ?? []).filter((p) =>
    (p.taggedPlayerSlugs ?? []).includes(slug),
  );
  const avatar = resolvePlayerPhoto(player, data.photos);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
        <StatCard label="Goles" value={playerGoals.length} />
        <StatCard label="Asistencias" value={playerAssists.length} />
        <StatCard
          label="Racha"
          value={global.longestStreak}
          hint="Presencias seguidas"
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
        <SectionHeading
          title="Historial"
          subtitle="Partidos en los que estuvo presente."
        />
        {history.length === 0 ? (
          <p className="text-sm text-muted">Sin partidos presentes cargados.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.matchIndex}>
                <Link
                  href={`/partidos/${h.matchIndex}`}
                  className="surface flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
                      {h.crestUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.crestUrl}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-xs font-bold text-muted">
                          {h.match.rival.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-blue-deep">
                        vs {h.match.rival}
                      </p>
                      <p className="text-sm text-muted">
                        {h.match.championship}
                        {h.match.date ? ` · ${h.match.date}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.goalsInMatch > 0 || h.assistsInMatch > 0 ? (
                      <div
                        className="flex items-center gap-0.5 text-blue-deep"
                        title={[
                          h.goalsInMatch > 0
                            ? `${h.goalsInMatch} gol${h.goalsInMatch === 1 ? "" : "es"}`
                            : null,
                          h.assistsInMatch > 0
                            ? `${h.assistsInMatch} asistencia${h.assistsInMatch === 1 ? "" : "s"}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        aria-label={[
                          h.goalsInMatch > 0
                            ? `${h.goalsInMatch} gol${h.goalsInMatch === 1 ? "" : "es"}`
                            : null,
                          h.assistsInMatch > 0
                            ? `${h.assistsInMatch} asistencia${h.assistsInMatch === 1 ? "" : "s"}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      >
                        {Array.from({ length: h.goalsInMatch }, (_, i) => (
                          <IoFootball key={`g-${i}`} className="h-5 w-5" />
                        ))}
                        {Array.from({ length: h.assistsInMatch }, (_, i) => (
                          <AssistIcon key={`a-${i}`} className="h-5 w-5" />
                        ))}
                      </div>
                    ) : null}
                    <MatchResultBadge
                      result={h.match.result}
                      goalsFor={h.match.goalsFor}
                      goalsAgainst={h.match.goalsAgainst}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
