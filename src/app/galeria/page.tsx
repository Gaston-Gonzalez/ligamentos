import Link from "next/link";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";
import { displayPlayerName } from "@/lib/players";

export const dynamic = "force-dynamic";
export const metadata = { title: "Galería" };

export default async function GaleriaPage({
  searchParams,
}: {
  searchParams: Promise<{ campeonato?: string }>;
}) {
  const { campeonato } = await searchParams;
  const data = await getData();
  const photos = (data.photos ?? []).filter(
    (p) => !campeonato || p.championshipSlug === campeonato,
  );

  const albums = data.championships
    .map((c) => ({
      ...c,
      count: (data.photos ?? []).filter(
        (p) =>
          p.championshipSlug === c.slug ||
          data.matches.some(
            (m) => m.championship === c.name && m.index === p.matchIndex,
          ),
      ).length,
    }))
    .filter((a) => a.count > 0 || a.ligaproGalleryUrl);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title="Galería"
        subtitle="Fotos de Liga Pro vinculadas a partidos de Ligamentos Cruzeiro."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((a) => (
          <div key={a.slug} className="surface rounded-2xl p-4">
            <p className="display text-xl text-blue-deep">{a.name}</p>
            <p className="mt-1 text-sm text-muted">{a.count} fotos en el sitio</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link
                href={`/galeria?campeonato=${a.slug}`}
                className="rounded-full bg-blue px-3 py-1 font-semibold text-white"
              >
                Ver
              </Link>
              {a.ligaproGalleryUrl ? (
                <a
                  href={a.ligaproGalleryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-line px-3 py-1 font-semibold"
                >
                  Liga Pro
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {campeonato ? (
        <p className="mb-4 text-sm">
          Filtrando por campeonato.{" "}
          <Link href="/galeria" className="font-semibold text-blue">
            Ver todas
          </Link>
        </p>
      ) : null}

      {photos.length === 0 ? (
        <div className="surface rounded-2xl p-6 text-muted">
          Todavía no hay fotos importadas. Corré{" "}
          <code className="text-blue-dark">npm run scrape:ligapro</code> o
          agregalas desde el admin.
        </div>
      ) : (
        <PhotoCarousel
          players={data.players.map((pl) => ({
            slug: pl.slug,
            name: pl.name,
          }))}
          photos={photos.map((p) => {
            const match = p.matchIndex
              ? data.matches.find((m) => m.index === p.matchIndex)
              : null;
            return {
              imageUrl: p.imageUrl,
              caption: match
                ? `vs ${match.rival}${p.caption ? ` · ${p.caption}` : ""}`
                : (p.caption ?? "Foto Liga Pro"),
              tags: (p.taggedPlayerSlugs ?? []).map((s) =>
                displayPlayerName(data, s),
              ),
              taggedPlayerSlugs: p.taggedPlayerSlugs ?? [],
            };
          })}
        />
      )}
    </div>
  );
}
