import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getData } from "@/lib/data";
import { updateMatchAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const { edit } = await searchParams;
  const data = await getData();
  const editIndex = edit ? Number(edit) : null;
  const editing =
    editIndex != null
      ? data.matches.find((m) => m.index === editIndex)
      : null;

  const sorted = [...data.matches].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  return (
    <div className="space-y-6">
      {editing ? (
        <form
          action={updateMatchAction}
          className="surface space-y-3 rounded-2xl p-5"
        >
          <h2 className="display text-2xl text-blue-deep">
            Editar vs {editing.rival}
          </h2>
          <input type="hidden" name="index" value={editing.index} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Rival
              <input
                name="rival"
                defaultValue={editing.rival}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              Campeonato
              <select
                name="championship"
                defaultValue={editing.championship}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              >
                {data.championships.map((c) => (
                  <option key={c.slug} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Fecha
              <input
                type="date"
                name="date"
                defaultValue={editing.date ?? ""}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Cancha
              <input
                name="pitch"
                defaultValue={editing.pitch ?? ""}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Goles a favor
              <input
                type="number"
                name="goalsFor"
                defaultValue={editing.goalsFor}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Goles en contra
              <input
                type="number"
                name="goalsAgainst"
                defaultValue={editing.goalsAgainst}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              YouTube URL
              <input
                name="youtubeUrl"
                defaultValue={editing.youtubeUrl ?? ""}
                placeholder="https://www.youtube.com/watch?v=..."
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Álbum Liga Pro
              <input
                name="ligaproAlbumUrl"
                defaultValue={editing.ligaproAlbumUrl ?? ""}
                placeholder="https://www.ligapro.uy/galeria/album/..."
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white">
              Guardar
            </button>
            <Link
              href="/admin/partidos"
              className="rounded-full border border-line px-4 py-2 text-sm"
            >
              Cancelar
            </Link>
            <Link
              href={`/admin/partidos/${editing.index}/asistencia`}
              className="rounded-full border border-line px-4 py-2 text-sm"
            >
              Editar asistencia
            </Link>
          </div>
        </form>
      ) : null}

      <div className="surface overflow-hidden rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-deep text-white">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Rival</th>
              <th className="px-3 py-2 text-left">Torneo</th>
              <th className="px-3 py-2">Marcador</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.index} className="border-b border-line">
                <td className="px-3 py-2">{m.date ?? "—"}</td>
                <td className="px-3 py-2 font-semibold">{m.rival}</td>
                <td className="px-3 py-2">{m.championship}</td>
                <td className="px-3 py-2 text-center">
                  {m.goalsFor}-{m.goalsAgainst}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/partidos?edit=${m.index}`}
                    className="font-semibold text-blue"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
