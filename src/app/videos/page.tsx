import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { getData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Videos" };

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

export default async function VideosPage() {
  const data = await getData();
  const withVideo = data.matches
    .filter((m) => m.youtubeUrl)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        title="Videos"
        subtitle="Partidos con video del canal Ligamentos Cruzeiro."
      />
      <a
        href="https://www.youtube.com/@LigamentosCruzeiro"
        target="_blank"
        rel="noreferrer"
        className="mb-8 inline-flex rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white"
      >
        Canal de YouTube
      </a>

      {withVideo.length === 0 ? (
        <div className="surface rounded-2xl p-6 text-muted">
          Todavía no hay links de YouTube asociados a partidos. Agregalos desde
          el admin pegando la URL del video en cada partido.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {withVideo.map((m) => {
            const id = youtubeId(m.youtubeUrl!);
            return (
              <article key={m.index} className="surface overflow-hidden rounded-2xl">
                {id ? (
                  <div className="aspect-video bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${id}`}
                      title={`vs ${m.rival}`}
                      className="h-full w-full"
                      allowFullScreen
                    />
                  </div>
                ) : null}
                <div className="p-4">
                  <Link
                    href={`/partidos/${m.index}`}
                    className="display text-2xl text-blue-deep"
                  >
                    vs {m.rival}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {m.championship}
                    {m.date ? ` · ${m.date}` : ""}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
