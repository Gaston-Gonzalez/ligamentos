import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeading } from "@/components/SectionHeading";
import { StatCard } from "@/components/StatCard";
import { getData } from "@/lib/data";
import { coverPhotoForMatch, sortPhotosNewestFirst } from "@/lib/photos";
import { loadRivalCrests, resolveCrestUrl } from "@/lib/rivals";
import {
  computePlayerStats,
  formatPct,
  recordString,
  teamRecord,
  topAssists,
  topScorers,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function CampeonatoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getData();
  const crests = await loadRivalCrests();
  const championship = data.championships.find((c) => c.slug === slug);
  if (!championship) notFound();

  const matches = data.matches
    .filter((m) => m.championship === championship.name)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const record = teamRecord(matches);
  const scorers = topScorers(data, slug, 10);
  const assisters = topAssists(data, slug, 10);
  const presence = computePlayerStats(data, slug)
    .filter((p) => p.eligible > 0)
    .sort((a, b) => b.played - a.played)
    .slice(0, 10);

  const byPitch = [1, 2, 3, 4].map((pitch) => {
    const subset = matches.filter((m) => m.pitch === pitch);
    return { pitch, ...teamRecord(subset) };
  }).filter((x) => x.played > 0);

  const photos = sortPhotosNewestFirst(
    (data.photos ?? []).filter(
      (p) =>
        p.championshipSlug === slug ||
        matches.some((m) => m.index === p.matchIndex),
    ),
    data.matches,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title={championship.name}
        subtitle="Detalle del torneo: resultados, goleadores y asistencia."
      />

      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        {championship.ligaproGalleryUrl ? (
          <a
            href={championship.ligaproGalleryUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-blue px-4 py-2 font-semibold text-white"
          >
            Galería Liga Pro
          </a>
        ) : null}
        {championship.ligaproUrl ? (
          <a
            href={championship.ligaproUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-4 py-2 font-semibold text-blue-dark"
          >
            Campeonato en Liga Pro
          </a>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Récord"
          value={recordString(record.wins, record.draws, record.losses)}
        />
        <StatCard label="Puntos" value={record.points} />
        <StatCard
          label="Goles"
          value={`${record.goalsFor}:${record.goalsAgainst}`}
        />
        <StatCard label="Partidos" value={record.played} />
      </div>

      {byPitch.length > 0 ? (
        <div className="mt-10">
          <SectionHeading title="Por cancha" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byPitch.map((p) => (
              <div key={p.pitch} className="surface rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-muted">
                  Cancha {p.pitch}
                </p>
                <p className="mt-1 font-semibold">
                  {recordString(p.wins, p.draws, p.losses)}
                </p>
                <p className="text-sm text-muted">
                  {p.points} pts · {p.goalsFor}:{p.goalsAgainst}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <SectionHeading title="Partidos" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard
              key={m.index}
              match={m}
              coverUrl={
                coverPhotoForMatch(data.photos ?? [], m)?.imageUrl
              }
              crestUrl={resolveCrestUrl(m.rival, crests)}
            />
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div>
          <SectionHeading title="Goleadores" />
          <ul className="mt-3 space-y-2">
            {scorers.map((s) => (
              <li
                key={s.player.slug}
                className="surface flex justify-between rounded-xl px-4 py-2"
              >
                <Link href={`/jugadores/${s.player.slug}`}>{s.player.name}</Link>
                <span className="font-bold text-blue">{s.goals}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHeading title="Asistencias" />
          <ul className="mt-3 space-y-2">
            {assisters.length === 0 ? (
              <li className="text-sm text-muted">Sin asistencias registradas.</li>
            ) : (
              assisters.map((s) => (
                <li
                  key={s.player.slug}
                  className="surface flex justify-between rounded-xl px-4 py-2"
                >
                  <Link href={`/jugadores/${s.player.slug}`}>
                    {s.player.name}
                  </Link>
                  <span className="font-bold text-blue">{s.assists}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <SectionHeading title="Presencias" />
          <ul className="mt-3 space-y-2">
            {presence.map((p) => (
              <li
                key={p.playerSlug}
                className="surface flex justify-between rounded-xl px-4 py-2 text-sm"
              >
                <Link href={`/jugadores/${p.playerSlug}`}>{p.playerName}</Link>
                <span className="text-muted">
                  {p.played}/{p.eligible} · {formatPct(p.attendancePct)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="mt-10">
          <SectionHeading
            title="Fotos"
            subtitle={`${photos.length} fotos vinculadas a este campeonato.`}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.slice(0, 12).map((p) => (
              <a
                key={p.imageUrl}
                href={p.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.caption ?? "Foto Liga Pro"}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
          <Link
            href={`/galeria?campeonato=${slug}`}
            className="mt-4 inline-block text-sm font-semibold text-blue"
          >
            Ver galería completa →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
