import Link from "next/link";
import { notFound } from "next/navigation";
import { IoFootball } from "react-icons/io5";
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

  const ownGoals = goals.filter((g) => g.isOwnGoal).length;
  const scorerMap = new Map<
    string,
    { key: string; count: number; playerName: string | null }
  >();
  for (const g of goals) {
    if (g.isOwnGoal) continue;
    const player = findPlayer(data, g.player);
    const key = player?.slug ?? g.player ?? "unknown";
    const existing = scorerMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      scorerMap.set(key, {
        key,
        count: 1,
        playerName: player?.name ?? g.player ?? null,
      });
    }
  }
  const scorers = [...scorerMap.values()].sort((a, b) => b.count - a.count);

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
          <SectionHeading title="Goleadores" />
          {scorers.length === 0 && ownGoals === 0 ? (
            <p className="text-muted">Sin goles registrados.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {scorers.map((s) => {
                const player = findPlayer(data, s.key);
                const avatar = player
                  ? resolvePlayerPhoto(player, data.photos)
                  : null;
                const name = player?.name ?? s.playerName ?? "Desconocido";
                const row = (
                  <>
                    <PlayerAvatar
                      url={avatar?.url}
                      crop={avatar?.crop}
                      name={name}
                      className="h-20 w-20 rounded-full border-[3px] md:h-24 md:w-24"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="display text-2xl leading-none text-blue-deep md:text-3xl">
                        {name}
                      </p>
                      <div
                        className="mt-2 flex items-center gap-1 text-blue-deep"
                        title={`${s.count} gol${s.count === 1 ? "" : "es"}`}
                        aria-label={`${s.count} gol${s.count === 1 ? "" : "es"}`}
                      >
                        {Array.from({ length: s.count }, (_, i) => (
                          <IoFootball key={i} className="h-7 w-7 shrink-0" />
                        ))}
                      </div>
                    </div>
                  </>
                );
                return (
                  <li key={s.key}>
                    {player ? (
                      <Link
                        href={`/jugadores/${player.slug}`}
                        className="surface flex items-center gap-4 rounded-2xl px-4 py-4 hover:border-blue/40"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="surface flex items-center gap-4 rounded-2xl px-4 py-4">
                        {row}
                      </div>
                    )}
                  </li>
                );
              })}
              {ownGoals > 0 ? (
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
                      title={`${ownGoals} en contra`}
                      aria-label={`${ownGoals} en contra`}
                    >
                      {Array.from({ length: ownGoals }, (_, i) => (
                        <IoFootball key={i} className="h-7 w-7 shrink-0" />
                      ))}
                    </div>
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
