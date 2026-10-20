import Link from "next/link";
import { IoFootball } from "react-icons/io5";
import { AssistIcon } from "@/components/AssistIcon";
import { AttendanceChart } from "@/components/AttendanceChart";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { SectionHeading } from "@/components/SectionHeading";
import { StatCard } from "@/components/StatCard";
import { getData } from "@/lib/data";
import { resolvePlayerPhoto } from "@/lib/players";
import {
  absenceBreakdown,
  attendanceTimeline,
  duoConnections,
  topConnections,
  type DuoConnection,
} from "@/lib/stats";
import type { SeedPhoto, SeedPlayer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estadísticas" };

function PlayerFace({
  player,
  photos,
}: {
  player: SeedPlayer;
  photos: SeedPhoto[] | undefined;
}) {
  const avatar = resolvePlayerPhoto(player, photos);
  return (
    <Link href={`/jugadores/${player.slug}`} className="group min-w-0">
      <PlayerAvatar
        url={avatar?.url}
        crop={avatar?.crop}
        name={player.name}
        className="mx-auto h-16 w-16 rounded-full border-[3px] md:h-20 md:w-20"
      />
      <p className="mt-2 truncate text-center text-sm font-semibold text-blue-deep group-hover:underline">
        {player.name}
      </p>
    </Link>
  );
}

function contributionLabel(goals: number, assists: number): string {
  const goalsLabel = `${goals} ${goals === 1 ? "gol" : "goles"}`;
  const assistsLabel = `${assists} ${assists === 1 ? "asistencia" : "asistencias"}`;
  return `${goalsLabel} · ${assistsLabel}`;
}

function ConnectionCard({
  pair,
  photos,
  featured,
}: {
  pair: DuoConnection;
  photos: SeedPhoto[] | undefined;
  featured?: boolean;
}) {
  return (
    <article
      className={`surface flex items-center gap-3 rounded-2xl px-4 py-4 ${
        featured ? "md:px-6" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <PlayerFace player={pair.playerA} photos={photos} />
        <p className="mt-1 text-center text-xs font-semibold text-blue-deep">
          {contributionLabel(pair.goalsA, pair.assistsA)}
        </p>
      </div>
      <div className="shrink-0 text-center">
        <p className="display text-4xl leading-none text-blue-dark">
          {pair.goals}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
          {pair.goals === 1 ? "gol junto" : "goles juntos"}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <PlayerFace player={pair.playerB} photos={photos} />
        <p className="mt-1 text-center text-xs font-semibold text-blue-deep">
          {contributionLabel(pair.goalsB, pair.assistsB)}
        </p>
      </div>
    </article>
  );
}

export default async function EstadisticasPage() {
  const data = await getData();
  const connections = duoConnections(data, 12).filter((pair) => pair.goals >= 2);
  const feeders = topConnections(data, 200);
  const timeline = attendanceTimeline(data);
  const absences = absenceBreakdown(data);
  const best = connections[0];
  const topFeeder = feeders[0];
  const presentValues = timeline.map((p) => p.present);
  const avgPresent = presentValues.length
    ? Math.round(
        presentValues.reduce((sum, n) => sum + n, 0) / presentValues.length,
      )
    : 0;
  const maxPresent = presentValues.length ? Math.max(...presentValues) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title="Estadísticas"
        subtitle="Conexiones de gol, convocatoria a lo largo del tiempo, lesiones, viajes y ausencias."
      />

      <section>
        <SectionHeading
          title="Mejor conexión"
          subtitle="Goles en los que cualquiera de los dos asistió al otro."
        />
        {best ? (
          <>
            <ConnectionCard pair={best} photos={data.photos} featured />
            {connections.length > 1 ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {connections.slice(1).map((pair) => (
                  <li key={`${pair.playerA.slug}-${pair.playerB.slug}`}>
                    <ConnectionCard pair={pair} photos={data.photos} />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Todavía no hay goles con asistencia.</p>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading
          title="Asistencias"
          subtitle="Cada pareja asistidor y goleador. Se ven las primeras 15; scrolleá la lista para el resto."
        />
        {topFeeder ? (
          <ul className="max-h-[982px] space-y-2 overflow-y-auto pr-1">
            {feeders.map((pair, index) => (
              <li key={`${pair.assister.slug}-${pair.scorer.slug}`}>
                <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 text-sm text-muted">{index + 1}.</span>
                    <Link
                      href={`/jugadores/${pair.assister.slug}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-blue-deep hover:underline"
                    >
                      <AssistIcon className="h-5 w-5 shrink-0" />
                      {pair.assister.name}
                    </Link>
                    <span className="text-sm text-muted">a</span>
                    <Link
                      href={`/jugadores/${pair.scorer.slug}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-blue-deep hover:underline"
                    >
                      <IoFootball className="h-5 w-5 shrink-0" />
                      {pair.scorer.name}
                    </Link>
                  </div>
                  <span className="display text-2xl text-blue">
                    {pair.goals}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin asistencias cargadas.</p>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading
          title="Convocatoria en el tiempo"
          subtitle={
            timeline.length
              ? `${timeline.length} partidos con fecha · promedio ${avgPresent} presentes · máximo ${maxPresent}.`
              : "Partidos ordenados por fecha."
          }
        />
        <AttendanceChart points={timeline} />
      </section>

      <section className="mt-12">
        <SectionHeading
          title="Lesiones, viajes y ausencias"
          subtitle="Lesión y viaje son faltas justificadas. Ausencia es cuando figuró ausente."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Lesiones" value={absences.injuries} hint="partidos" />
          <StatCard label="Viajes" value={absences.travels} hint="partidos" />
          <StatCard label="Ausencias" value={absences.absent} hint="partidos" />
          <StatCard
            label="Jugadores lesionados"
            value={absences.playersInjured}
          />
          <StatCard
            label="Jugadores de viaje"
            value={absences.playersTraveling}
          />
          <StatCard
            label="Jugadores ausentes"
            value={absences.playersAbsent}
          />
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Más lesiones
            </h3>
            {absences.byInjury.length === 0 ? (
              <p className="text-sm text-muted">Sin lesiones registradas.</p>
            ) : (
              <ul className="space-y-2">
                {absences.byInjury.slice(0, 8).map((row) => (
                  <li key={row.player.slug}>
                    <Link
                      href={`/jugadores/${row.player.slug}`}
                      className="surface flex items-center justify-between rounded-xl px-4 py-2.5 hover:border-blue/40"
                    >
                      <span className="font-medium text-blue-deep">
                        {row.player.name}
                      </span>
                      <span className="display text-xl text-rose-700">
                        {row.injuries}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Más viajes
            </h3>
            {absences.byTravel.length === 0 ? (
              <p className="text-sm text-muted">Sin viajes registrados.</p>
            ) : (
              <ul className="space-y-2">
                {absences.byTravel.slice(0, 8).map((row) => (
                  <li key={row.player.slug}>
                    <Link
                      href={`/jugadores/${row.player.slug}`}
                      className="surface flex items-center justify-between rounded-xl px-4 py-2.5 hover:border-blue/40"
                    >
                      <span className="font-medium text-blue-deep">
                        {row.player.name}
                      </span>
                      <span className="display text-xl text-blue">
                        {row.travels}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Más ausencias
            </h3>
            {absences.byAbsent.length === 0 ? (
              <p className="text-sm text-muted">Sin ausencias registradas.</p>
            ) : (
              <ul className="space-y-2">
                {absences.byAbsent.slice(0, 8).map((row) => (
                  <li key={row.player.slug}>
                    <Link
                      href={`/jugadores/${row.player.slug}`}
                      className="surface flex items-center justify-between rounded-xl px-4 py-2.5 hover:border-blue/40"
                    >
                      <span className="font-medium text-blue-deep">
                        {row.player.name}
                      </span>
                      <span className="display text-xl text-blue-deep">
                        {row.absent}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
