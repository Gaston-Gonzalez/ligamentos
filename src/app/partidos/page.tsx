import Link from "next/link";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partidos" };

export default async function PartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ campeonato?: string }>;
}) {
  const { campeonato } = await searchParams;
  const data = await getData();
  const champ = campeonato
    ? data.championships.find((c) => c.slug === campeonato)
    : null;

  const matches = data.matches
    .filter((m) => !champ || m.championship === champ.name)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title="Partidos"
        subtitle="Historial completo de Ligamentos Cruzeiro."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/partidos"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            !campeonato ? "bg-blue text-white" : "border border-line bg-white/70"
          }`}
        >
          Todos
        </Link>
        {data.championships.map((c) => (
          <Link
            key={c.slug}
            href={`/partidos?campeonato=${c.slug}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              campeonato === c.slug
                ? "bg-blue text-white"
                : "border border-line bg-white/70"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>
      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.index}>
            <Link
              href={`/partidos/${m.index}`}
              className="surface flex items-center justify-between gap-3 rounded-2xl px-4 py-3 hover:border-blue/40"
            >
              <div>
                <p className="font-semibold text-blue-deep">vs {m.rival}</p>
                <p className="text-sm text-muted">
                  {m.championship}
                  {m.date ? ` · ${m.date}` : ""}
                  {m.pitch ? ` · Cancha ${m.pitch}` : ""}
                  {m.youtubeUrl ? " · Video" : ""}
                </p>
              </div>
              <MatchResultBadge
                result={m.result}
                goalsFor={m.goalsFor}
                goalsAgainst={m.goalsAgainst}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
