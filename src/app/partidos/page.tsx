import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";
import { coverPhotoForMatch } from "@/lib/photos";
import { loadRivalCrests, resolveCrestUrl } from "@/lib/rivals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partidos" };

export default async function PartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ campeonato?: string }>;
}) {
  const { campeonato } = await searchParams;
  const data = await getData();
  const crests = await loadRivalCrests();
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => (
          <MatchCard
            key={m.index}
            match={m}
            coverUrl={coverPhotoForMatch(data.photos ?? [], m)?.imageUrl}
            crestUrl={resolveCrestUrl(m.rival, crests)}
          />
        ))}
      </div>
    </div>
  );
}
