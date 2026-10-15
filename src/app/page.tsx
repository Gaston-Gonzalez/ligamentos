import Image from "next/image";
import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeading } from "@/components/SectionHeading";
import { StatCard } from "@/components/StatCard";
import { getData } from "@/lib/data";
import { coverPhotoForMatch } from "@/lib/photos";
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

export default async function HomePage() {
  const data = await getData();
  const crests = await loadRivalCrests();
  const record = teamRecord(data.matches);
  const scorers = topScorers(data, undefined, 5);
  const assisters = topAssists(data, undefined, 5);
  const presence = computePlayerStats(data)
    .sort((a, b) => b.played - a.played)
    .slice(0, 5);
  const recent = [...data.matches]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 5);
  const final25 =
    data.matches.find((m) => /final\s*25/i.test(m.championship)) ??
    data.matches.find((m) => m.index === 43);
  const heroCover =
    (final25
      ? coverPhotoForMatch(data.photos ?? [], final25)?.imageUrl
      : null) ?? "/fotos/final-25/053-1lqfjDIS8mp0RMUnfn8IbriW4CwxfD56y.jpg";

  return (
    <div>
      <section className="relative min-h-[70vh] overflow-hidden md:min-h-[78vh]">
        <Image
          src={heroCover}
          alt="Final 25 · campeones"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_28%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-deep/90 via-blue-deep/70 to-blue-deep/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-blue-deep/40" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div className="animate-rise text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold-soft">
              Serie 4 · Liga Pro
            </p>
            <h1 className="display mt-3 text-5xl leading-none md:text-7xl">
              Ligamentos
              <span className="block text-gold-soft">Cruzeiro</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-white/85 md:text-lg">
              Estadísticas del plantel, partidos, fotos de Liga Pro y videos del
              canal oficial.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/jugadores"
                className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-blue-deep transition hover:bg-gold-soft"
              >
                Ver jugadores
              </Link>
              <Link
                href="/partidos"
                className="rounded-full border border-white/35 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Últimos partidos
              </Link>
            </div>
          </div>
          <div className="flex justify-center animate-rise">
            <Image
              src="/escudo.jpg"
              alt="Escudo Ligamentos Cruzeiro"
              width={320}
              height={320}
              className="animate-crest w-56 rounded-full border-4 border-gold shadow-2xl md:w-72"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Récord"
            value={recordString(record.wins, record.draws, record.losses)}
            hint={`${record.played} partidos`}
          />
          <StatCard
            label="Goles"
            value={`${record.goalsFor}:${record.goalsAgainst}`}
            hint={`Diff ${record.goalsFor - record.goalsAgainst}`}
          />
          <StatCard label="Puntos" value={record.points} hint="3 por victoria" />
          <StatCard
            label="Plantel"
            value={data.players.length}
            hint={`${data.championships.length} campeonatos`}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            title="Últimos partidos"
            subtitle="Resultados más recientes del plantel."
          />
          <div className="grid gap-3">
            {recent.map((m) => (
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

        <div className="space-y-10">
          <div>
            <SectionHeading title="Goleadores" />
            <ul className="space-y-2">
              {scorers.map((s, i) => (
                <li key={s.player.slug}>
                  <Link
                    href={`/jugadores/${s.player.slug}`}
                    className="surface flex items-center justify-between rounded-xl px-4 py-2.5 hover:border-gold/50"
                  >
                    <span className="font-medium">
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      {s.player.name}
                    </span>
                    <span className="display text-xl text-blue">{s.goals}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading title="Asistencias" />
            <ul className="space-y-2">
              {assisters.map((s, i) => (
                <li key={s.player.slug}>
                  <Link
                    href={`/jugadores/${s.player.slug}`}
                    className="surface flex items-center justify-between rounded-xl px-4 py-2.5 hover:border-gold/50"
                  >
                    <span className="font-medium">
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      {s.player.name}
                    </span>
                    <span className="display text-xl text-blue">{s.assists}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading title="Más presencias" />
            <ul className="space-y-2">
              {presence.map((p, i) => (
                <li key={p.playerSlug}>
                  <Link
                    href={`/jugadores/${p.playerSlug}`}
                    className="surface flex items-center justify-between rounded-xl px-4 py-2.5 hover:border-gold/50"
                  >
                    <span className="font-medium">
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      {p.playerName}
                    </span>
                    <span className="text-sm text-muted">
                      {p.played} · {formatPct(p.attendancePct)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
