import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getData } from "@/lib/data";
import {
  deleteChampionshipAction,
  updateChampionshipLinksAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const data = await getData();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface rounded-2xl p-4">
          <p className="text-xs uppercase text-muted">Partidos</p>
          <p className="display text-3xl text-blue">{data.matches.length}</p>
        </div>
        <div className="surface rounded-2xl p-4">
          <p className="text-xs uppercase text-muted">Jugadores</p>
          <p className="display text-3xl text-blue">{data.players.length}</p>
        </div>
        <div className="surface rounded-2xl p-4">
          <p className="text-xs uppercase text-muted">Fotos</p>
          <p className="display text-3xl text-blue">
            {(data.photos ?? []).length}
          </p>
        </div>
      </div>

      <section className="surface rounded-2xl p-5">
        <h2 className="display text-2xl text-blue-deep">Campeonatos</h2>
        <p className="mt-1 text-sm text-muted">
          Renombrá torneos y asociá links de ligapro.uy. El slug de la URL
          interna se mantiene para no romper favoritos.
        </p>
        <div className="mt-4 space-y-5">
          {data.championships.map((c) => {
            const matchCount = data.matches.filter(
              (m) => m.championship === c.name,
            ).length;
            return (
              <div key={c.slug} className="border-b border-line pb-4">
                <form
                  action={updateChampionshipLinksAction}
                  className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <input type="hidden" name="slug" value={c.slug} />
                  <label className="text-xs font-semibold text-muted">
                    Nombre
                    <input
                      name="name"
                      defaultValue={c.name}
                      required
                      className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm font-semibold text-ink"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    URL campeonato Liga Pro
                    <input
                      name="ligaproUrl"
                      defaultValue={c.ligaproUrl ?? ""}
                      placeholder="https://www.ligapro.uy/campeonatos/..."
                      className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    URL galería / Drive
                    <input
                      name="ligaproGalleryUrl"
                      defaultValue={c.ligaproGalleryUrl ?? ""}
                      placeholder="https://www.ligapro.uy/galeria/... o Drive"
                      className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink"
                    />
                  </label>
                  <div className="flex items-end">
                    <button className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white">
                      Guardar
                    </button>
                  </div>
                </form>
                <form action={deleteChampionshipAction} className="mt-2">
                  <input type="hidden" name="slug" value={c.slug} />
                  <button
                    type="submit"
                    className="text-xs font-semibold text-rose-700 underline"
                  >
                    Eliminar campeonato
                    {matchCount > 0
                      ? ` (y sus ${matchCount} partidos)`
                      : ""}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface rounded-2xl p-5 text-sm text-muted">
        <h2 className="display text-xl text-blue-deep">Importar datos</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Excel → <code>npm run seed:parse</code>
          </li>
          <li>
            Fotos Liga Pro → <code>npm run scrape:ligapro</code>
          </li>
          <li>
            Cargar a Neon → <code>npm run db:push && npm run seed:db</code>
          </li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/partidos" className="font-semibold text-blue">
            Editar partidos →
          </Link>
          <Link href="/admin/jugadores" className="font-semibold text-blue">
            Editar jugadores →
          </Link>
          <Link href="/admin/fotos" className="font-semibold text-blue">
            Fotos y etiquetas →
          </Link>
        </div>
      </section>
    </div>
  );
}
