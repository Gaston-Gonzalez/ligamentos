import Link from "next/link";
import { notFound } from "next/navigation";
import { IoFootball } from "react-icons/io5";
import { AssistIcon } from "@/components/AssistIcon";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";
import {
  displayPlayerName,
  findPlayer,
  resolvePlayerPhoto,
} from "@/lib/players";
import {
  attendanceForMatch,
  goalsForMatch,
  resultLabel,
  statusLabel,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
  return null;
}

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index: indexRaw } = await params;
  const index = Number(indexRaw);
  if (!Number.isFinite(index)) notFound();

  const data = await getData();
  const match = data.matches.find((m) => m.index === index);
  if (!match) notFound();

  const champ = data.championships.find((c) => c.name === match.championship);
  const goals = goalsForMatch(data, index);
  const attendance = attendanceForMatch(data, index);
  const photos = (data.photos ?? []).filter((p) => p.matchIndex === index);
  const embed = match.youtubeUrl ? youtubeEmbed(match.youtubeUrl) : null;

  type ScorerCard = {
    key: string;
    playerName: string | null;
    goals: number;
    /** Assister display names, one per assisted goal, in goal order. */
    assistNames: string[];
  };
  const scorerMap = new Map<string, ScorerCard>();
  const ownGoalAssists: string[] = [];
  let ownGoalCount = 0;

  for (const g of goals) {
    if (g.isOwnGoal) {
      ownGoalCount += 1;
      if (g.assistPlayer) {
        const assist = findPlayer(data, g.assistPlayer);
        ownGoalAssists.push(assist?.name ?? g.assistPlayer);
      }
      continue;
    }
    if (!g.player) continue;
    const player = findPlayer(data, g.player);
    const key = player?.slug ?? g.player;
    const existing = scorerMap.get(key);
    if (existing) {
      existing.goals += 1;
      if (g.assistPlayer) {
        const assist = findPlayer(data, g.assistPlayer);
        existing.assistNames.push(assist?.name ?? g.assistPlayer);
      }
    } else {
      const assistNames: string[] = [];
      if (g.assistPlayer) {
        const assist = findPlayer(data, g.assistPlayer);
        assistNames.push(assist?.name ?? g.assistPlayer);
      }
      scorerMap.set(key, {
        key,
        playerName: player?.name ?? g.player,
        goals: 1,
        assistNames,
      });
    }
  }
  const scorers = [...scorerMap.values()].sort((a, b) => b.goals - a.goals);

  const groups = {
    present: attendance.filter((a) => a.status === "present"),
    absent: attendance.filter((a) => a.status === "absent"),
    injury: attendance.filter((a) => a.status === "injury"),
    travel: attendance.filter((a) => a.status === "travel"),
    not_registered: attendance.filter((a) => a.status === "not_registered"),
  };

  const carouselPhotos = photos.map((p) => ({
    imageUrl: p.imageUrl,
    caption: p.caption ?? `vs ${match.rival}`,
    tags: (p.taggedPlayerSlugs ?? []).map((s) => displayPlayerName(data, s)),
    taggedPlayerSlugs: p.taggedPlayerSlugs ?? [],
  }));
  const carouselPlayers = data.players.map((pl) => ({
    slug: pl.slug,
    name: pl.name,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm uppercase tracking-[0.16em] text-muted">
        {match.championship}
        {match.jornada ? ` · Jornada ${match.jornada}` : ""}
      </p>
      <h1 className="display mt-2 text-4xl text-blue-deep md:text-5xl">
        vs {match.rival}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <MatchResultBadge
          result={match.result}
          goalsFor={match.goalsFor}
          goalsAgainst={match.goalsAgainst}
        />
        <span className="text-sm text-muted">
          {resultLabel(match.result)}
          {match.date ? ` · ${match.date}` : ""}
          {match.pitch ? ` · Cancha ${match.pitch}` : ""}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {champ ? (
          <Link
            href={`/campeonatos/${champ.slug}`}
            className="rounded-full border border-line px-3 py-1.5 font-semibold"
          >
            Ver campeonato
          </Link>
        ) : null}
        {champ?.ligaproUrl ? (
          <a
            href={champ.ligaproUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-3 py-1.5 font-semibold"
          >
            Liga Pro
          </a>
        ) : null}
        {match.ligaproAlbumUrl ? (
          <a
            href={match.ligaproAlbumUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-blue px-3 py-1.5 font-semibold text-white"
          >
            Álbum Liga Pro
          </a>
        ) : null}
      </div>

      <div className="mt-10 space-y-12">
        {embed ? (
          <section>
            <SectionHeading title="Video" />
            <div className="aspect-video overflow-hidden rounded-2xl border border-line">
              <iframe
                src={embed}
                title={`Video vs ${match.rival}`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeading title="Goles y asistencias" />
          {scorers.length === 0 && ownGoalCount === 0 ? (
            <p className="text-muted">Sin goles registrados.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {scorers.map((s) => {
                const player = findPlayer(data, s.key);
                const avatar = player
                  ? resolvePlayerPhoto(player, data.photos)
                  : null;
                const name = player?.name ?? s.playerName ?? "Desconocido";
                const goalLabel = `${s.goals} gol${s.goals === 1 ? "" : "es"}`;
                return (
                  <li
                    key={s.key}
                    className="surface flex items-center gap-4 rounded-2xl px-4 py-4"
                  >
                    {player ? (
                      <Link
                        href={`/jugadores/${player.slug}`}
                        className="shrink-0 rounded-full hover:opacity-90"
                      >
                        <PlayerAvatar
                          url={avatar?.url}
                          crop={avatar?.crop}
                          name={name}
                          className="h-20 w-20 rounded-full border-[3px] md:h-24 md:w-24"
                        />
                      </Link>
                    ) : (
                      <PlayerAvatar
                        url={avatar?.url}
                        crop={avatar?.crop}
                        name={name}
                        className="h-20 w-20 shrink-0 rounded-full border-[3px] md:h-24 md:w-24"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {player ? (
                        <Link
                          href={`/jugadores/${player.slug}`}
                          className="display text-2xl leading-none text-blue-deep hover:underline md:text-3xl"
                        >
                          {name}
                        </Link>
                      ) : (
                        <p className="display text-2xl leading-none text-blue-deep md:text-3xl">
                          {name}
                        </p>
                      )}
                      <div
                        className="mt-2 flex flex-wrap items-center gap-1 text-blue-deep"
                        title={goalLabel}
                        aria-label={goalLabel}
                      >
                        {Array.from({ length: s.goals }, (_, i) => (
                          <IoFootball
                            key={`g-${i}`}
                            className="h-7 w-7 shrink-0"
                          />
                        ))}
                      </div>
                      {s.assistNames.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {s.assistNames.map((assistName, i) => {
                            const assistPlayer = findPlayer(data, assistName);
                            const chip = (
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-deep">
                                <AssistIcon className="h-5 w-5 shrink-0" />
                                <span>{assistName}</span>
                              </span>
                            );
                            return (
                              <li key={`${assistName}-${i}`}>
                                {assistPlayer ? (
                                  <Link
                                    href={`/jugadores/${assistPlayer.slug}`}
                                    className="hover:underline"
                                    aria-label={`Asistencia: ${assistName}`}
                                  >
                                    {chip}
                                  </Link>
                                ) : (
                                  <span aria-label={`Asistencia: ${assistName}`}>
                                    {chip}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {ownGoalCount > 0 ? (
                <li className="surface flex items-center gap-4 rounded-2xl px-4 py-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[3px] border-line bg-paper text-sm font-bold text-muted md:h-24 md:w-24">
                    EC
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="display text-2xl leading-none text-muted md:text-3xl">
                      En contra
                    </p>
                    <div
                      className="mt-2 flex items-center gap-1 text-muted"
                      title={`${ownGoalCount} en contra`}
                      aria-label={`${ownGoalCount} en contra`}
                    >
                      {Array.from({ length: ownGoalCount }, (_, i) => (
                        <IoFootball key={i} className="h-7 w-7 shrink-0" />
                      ))}
                    </div>
                    {ownGoalAssists.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {ownGoalAssists.map((assistName, i) => {
                          const assistPlayer = findPlayer(data, assistName);
                          const chip = (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-muted">
                              <AssistIcon className="h-5 w-5 shrink-0" />
                              <span>{assistName}</span>
                            </span>
                          );
                          return (
                            <li key={`og-${assistName}-${i}`}>
                              {assistPlayer ? (
                                <Link
                                  href={`/jugadores/${assistPlayer.slug}`}
                                  className="hover:underline"
                                  aria-label={`Asistencia: ${assistName}`}
                                >
                                  {chip}
                                </Link>
                              ) : (
                                <span aria-label={`Asistencia: ${assistName}`}>
                                  {chip}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                </li>
              ) : null}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading title="Convocatoria" />
          {(
            [
              ["present", "Presentes"],
              ["absent", "Ausentes"],
              ["injury", "Lesión"],
              ["travel", "Viaje"],
              ["not_registered", "No fichados"],
            ] as const
          ).map(([key, label]) => {
            if (!groups[key].length) return null;
            const list = (
              <ul className="grid gap-2 sm:grid-cols-2">
                {groups[key].map((a) => {
                  const player = findPlayer(data, a.player);
                  const name = player?.name ?? a.player;
                  const avatar = player
                    ? resolvePlayerPhoto(player, data.photos)
                    : null;
                  const showStatus = key !== "present";
                  const content = (
                    <>
                      <PlayerAvatar
                        url={avatar?.url}
                        crop={avatar?.crop}
                        name={name}
                        className="h-11 w-11 rounded-full border-2"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-blue-deep">
                          {name}
                        </p>
                        {showStatus ? (
                          <p className="text-xs text-muted">
                            {statusLabel(a.status)}
                          </p>
                        ) : null}
                      </div>
                    </>
                  );
                  return (
                    <li key={`${a.player}-${a.status}`}>
                      {player ? (
                        <Link
                          href={`/jugadores/${player.slug}`}
                          className="surface flex items-center gap-3 rounded-xl px-3 py-2 hover:border-blue/40"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="surface flex items-center gap-3 rounded-xl px-3 py-2">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            );

            if (key === "not_registered") {
              return (
                <details key={key} className="mb-6 group">
                  <summary className="mb-2 cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="text-blue transition group-open:rotate-90">
                        ›
                      </span>
                      {label} ({groups[key].length})
                    </span>
                  </summary>
                  {list}
                </details>
              );
            }

            return (
              <div key={key} className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {label} ({groups[key].length})
                </p>
                {list}
              </div>
            );
          })}
        </section>
      </div>

      {carouselPhotos.length > 0 ? (
        <div className="mt-10">
          <SectionHeading title="Fotos del partido" />
          <PhotoCarousel
            photos={carouselPhotos}
            players={carouselPlayers}
            alt={`vs ${match.rival}`}
          />
        </div>
      ) : null}
    </div>
  );
}
