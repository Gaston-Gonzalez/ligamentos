import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getData } from "@/lib/data";
import type { SeedMatch, SeedPhoto } from "@/lib/types";
import { tagPhotoAction } from "@/app/actions/photos";
import { addPhotoAction } from "../actions";

export const dynamic = "force-dynamic";

function matchLabel(m: SeedMatch) {
  const date = m.date ?? "s/f";
  return `#${m.index} vs ${m.rival} · ${date}`;
}

function groupPhotosByMatch(
  photos: SeedPhoto[],
  matches: SeedMatch[],
): { key: string; title: string; match: SeedMatch | null; photos: SeedPhoto[] }[] {
  const byIndex = new Map(matches.map((m) => [m.index, m]));
  const groups = new Map<
    string,
    { title: string; match: SeedMatch | null; photos: SeedPhoto[] }
  >();

  for (const p of photos) {
    const m =
      p.matchIndex != null ? (byIndex.get(p.matchIndex) ?? null) : null;
    const key = m ? `m-${m.index}` : "none";
    const title = m ? matchLabel(m) : "Sin partido";
    const g = groups.get(key) ?? { title, match: m, photos: [] };
    g.photos.push(p);
    groups.set(key, g);
  }

  return [...groups.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => {
      if (!a.match && !b.match) return 0;
      if (!a.match) return 1;
      if (!b.match) return -1;
      const da = a.match.date ?? "";
      const db = b.match.date ?? "";
      if (da !== db) return db.localeCompare(da);
      return b.match.index - a.match.index;
    });
}

export default async function AdminFotosPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const data = await getData();
  const photos = data.photos ?? [];
  const groups = groupPhotosByMatch(photos, data.matches);

  return (
    <div className="space-y-8">
      <form action={addPhotoAction} className="surface space-y-3 rounded-2xl p-5">
        <h2 className="display text-2xl text-blue-deep">Agregar foto (URL)</h2>
        <p className="text-sm text-muted">
          Pegá un link de <code>r2.ligapro.uy/galeria/...</code> o de la página
          del álbum como referencia.
        </p>
        <label className="block text-sm">
          Image URL
          <input
            name="imageUrl"
            required
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="https://r2.ligapro.uy/galeria/..."
          />
        </label>
        <label className="block text-sm">
          Página fuente
          <input
            name="sourcePageUrl"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="https://www.ligapro.uy/galeria/album/..."
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Partido
            <select
              name="matchIndex"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="">—</option>
              {data.matches.map((m) => (
                <option key={m.index} value={m.index}>
                  #{m.index} vs {m.rival} ({m.date ?? "s/f"})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Campeonato
            <select
              name="championshipSlug"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="">—</option>
              {data.championships.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Caption
          <input
            name="caption"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">Etiquetar jugadores</legend>
          <div className="mt-2 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto md:grid-cols-4">
            {data.players.map((p) => (
              <label key={p.slug} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tags" value={p.slug} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white">
          Guardar foto
        </button>
      </form>

      <section className="space-y-10">
        <h2 className="display text-2xl text-blue-deep">
          Fotos por partido ({photos.length})
        </h2>

        {groups.map((g) => (
          <div key={g.key} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="display text-xl text-blue-deep">
                {g.title}
                <span className="ml-2 text-sm font-sans font-normal text-muted">
                  {g.photos.length} foto{g.photos.length === 1 ? "" : "s"}
                </span>
              </h3>
              {g.match ? (
                <Link
                  href={`/partidos/${g.match.index}`}
                  className="text-sm font-semibold text-blue"
                >
                  Ver partido →
                </Link>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {g.photos.map((p) => (
                <div
                  key={p.imageUrl}
                  className="surface overflow-hidden rounded-2xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={p.caption ?? "Foto"}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  <form action={tagPhotoAction} className="space-y-2 p-3">
                    <input type="hidden" name="imageUrl" value={p.imageUrl} />
                    <p className="truncate text-xs text-muted">{p.imageUrl}</p>
                    <div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto">
                      {data.players.map((pl) => (
                        <label
                          key={pl.slug}
                          className="flex items-center gap-1 text-xs"
                        >
                          <input
                            type="checkbox"
                            name="tags"
                            value={pl.slug}
                            defaultChecked={(p.taggedPlayerSlugs ?? []).includes(
                              pl.slug,
                            )}
                          />
                          {pl.name}
                        </label>
                      ))}
                    </div>
                    <button className="rounded-full bg-blue-dark px-3 py-1 text-xs font-semibold text-white">
                      Actualizar etiquetas
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
