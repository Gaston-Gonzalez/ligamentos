import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";
import { displayPlayerName, findPlayer } from "@/lib/players";
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

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading title="Goleadores" />
          {goals.length === 0 ? (
            <p className="text-muted">Sin goles registrados.</p>
          ) : (
            <ul className="space-y-2">
              {goals.map((g, i) => {
                const player = findPlayer(data, g.player);
                return (
                  <li
                    key={`${g.player}-${i}`}
                    className="surface rounded-xl px-4 py-2"
                  >
                    {g.isOwnGoal ? (
                      <span>En contra</span>
                    ) : player ? (
                      <Link
                        href={`/jugadores/${player.slug}`}
                        className="font-semibold text-blue-deep"
                      >
                        {player.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">
                        {g.player ?? "Desconocido"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {embed ? (
            <div className="mt-8">
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
            </div>
          ) : null}
        </div>

        <div>
          <SectionHeading title="Convocatoria" />
          {(
            [
              ["present", "Presentes"],
              ["absent", "Ausentes"],
              ["injury", "Lesión"],
              ["travel", "Viaje"],
              ["not_registered", "No fichados"],
            ] as const
          ).map(([key, label]) =>
            groups[key].length ? (
              <div key={key} className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {label} ({groups[key].length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {groups[key].map((a) => {
                    const player = findPlayer(data, a.player);
                    const labelName = player?.name ?? a.player;
                    return (
                      <Link
                        key={`${a.player}-${a.status}`}
                        href={player ? `/jugadores/${player.slug}` : "#"}
                        className="rounded-full border border-line bg-white/80 px-3 py-1 text-sm"
                        title={statusLabel(a.status)}
                      >
                        {labelName}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}
        </div>
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
