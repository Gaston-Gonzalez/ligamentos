import Link from "next/link";
import { redirect } from "next/navigation";
import { MatchAttendanceFields } from "@/components/MatchAttendanceFields";
import { MatchGoalsFields } from "@/components/MatchGoalsFields";
import { isAdminAuthenticated } from "@/lib/auth";
import { getData } from "@/lib/data";
import { createMatchAction, updateMatchAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPartidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    error?: string;
    gf?: string;
    gs?: string;
  }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const { edit, error, gf, gs } = await searchParams;
  const data = await getData();
  const editIndex = edit ? Number(edit) : null;
  const editing =
    editIndex != null
      ? data.matches.find((m) => m.index === editIndex)
      : null;
  const editingGoals =
    editIndex != null
      ? data.goals.filter((g) => g.matchIndex === editIndex)
      : [];
  const editingAttendance =
    editIndex != null
      ? Object.fromEntries(
          data.attendances
            .filter((a) => a.matchIndex === editIndex)
            .map((a) => [a.player, a.status]),
        )
      : {};

  const playerOpts = data.players.map((p) => ({
    name: p.name,
    slug: p.slug,
  }));

  const sorted = [...data.matches].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  return (
    <div className="space-y-6">
      {error === "goals" ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          No se pudo guardar: los goles a favor
          {gf != null ? ` (${gf})` : ""} deben coincidir con la cantidad de
          goleadores
          {gs != null ? ` (${gs})` : ""}.
        </p>
      ) : null}
      {!editing ? (
        <form
          action={createMatchAction}
          className="surface space-y-3 rounded-2xl p-5"
        >
          <h2 className="display text-2xl text-blue-deep">Nuevo partido</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Rival
              <input
                name="rival"
                required
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                placeholder="Nombre del rival"
              />
            </label>
            <label className="text-sm">
              Campeonato
              <select
                name="championship"
                required
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                defaultValue={data.championships[0]?.name ?? ""}
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
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Jornada
              <input
                type="number"
                name="jornada"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Cancha
              <input
                name="pitch"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <label className="text-sm">
                Goles a favor
                <input
                  type="number"
                  name="goalsFor"
                  defaultValue={0}
                  min={0}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Goles en contra
                <input
                  type="number"
                  name="goalsAgainst"
                  defaultValue={0}
                  min={0}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
            </div>
            <label className="text-sm md:col-span-2">
              YouTube URL
              <input
                name="youtubeUrl"
                placeholder="https://www.youtube.com/watch?v=..."
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Álbum Liga Pro
              <input
                name="ligaproAlbumUrl"
                placeholder="https://www.ligapro.uy/galeria/album/..."
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <MatchGoalsFields goalsFor={0} players={playerOpts} />
            <MatchAttendanceFields players={playerOpts} />
          </div>
          <button className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white">
            Crear partido
          </button>
        </form>
      ) : null}

      {editing ? (
        <form
          key={`match-edit-${editing.index}`}
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
              Jornada
              <input
                type="number"
                name="jornada"
                defaultValue={editing.jornada ?? ""}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Cancha
              <input
                name="pitch"
                defaultValue={editing.pitch ?? ""}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <label className="text-sm">
                Goles a favor
                <input
                  type="number"
                  name="goalsFor"
                  defaultValue={editing.goalsFor}
                  min={0}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Goles en contra
                <input
                  type="number"
                  name="goalsAgainst"
                  defaultValue={editing.goalsAgainst}
                  min={0}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
            </div>
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
            <MatchGoalsFields
              goalsFor={editing.goalsFor}
              initialGoals={editingGoals}
              players={playerOpts}
            />
            <MatchAttendanceFields
              players={playerOpts}
              initialByPlayer={editingAttendance}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white">
              Guardar partido
            </button>
            <Link
              href="/admin/partidos"
              className="rounded-full border border-line px-4 py-2 text-sm"
            >
              Cancelar
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
