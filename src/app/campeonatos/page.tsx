import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";
import { recordString, teamRecord } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campeonatos" };

export default async function CampeonatosPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title="Campeonatos"
        subtitle="Rendimiento de Ligamentos Cruzeiro por torneo desde Clausura 2024."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {data.championships.map((c) => {
          const matches = data.matches.filter((m) => m.championship === c.name);
          const record = teamRecord(matches);
          return (
            <Link
              key={c.slug}
              href={`/campeonatos/${c.slug}`}
              className="surface rounded-2xl p-5 transition hover:border-blue/40"
            >
              <p className="display text-2xl text-blue-deep">{c.name}</p>
              <p className="mt-2 text-sm text-muted">
                {record.played} partidos ·{" "}
                {recordString(record.wins, record.draws, record.losses)} ·{" "}
                {record.points} pts
              </p>
              <p className="mt-1 text-sm text-muted">
                Goles {record.goalsFor}:{record.goalsAgainst}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
