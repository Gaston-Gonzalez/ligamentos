import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerPhotoEditor } from "@/components/PlayerPhotoEditor";
import { isAdminAuthenticated } from "@/lib/auth";
import { getData } from "@/lib/data";
import { resolvePlayerPhoto } from "@/lib/players";
import { createPlayerAction, updatePlayerAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminJugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const { edit } = await searchParams;
  const data = await getData();
  const editing = edit
    ? data.players.find((p) => p.slug === edit)
    : null;
  const editingTagged = editing
    ? (data.photos ?? []).filter((p) =>
        (p.taggedPlayerSlugs ?? []).includes(editing.slug),
      )
    : [];
  const editingResolved = editing
    ? resolvePlayerPhoto(editing, data.photos)
    : null;

  return (
    <div className="space-y-6">
      <form
        action={createPlayerAction}
        className="surface flex flex-wrap items-end gap-3 rounded-2xl p-4"
      >
        <label className="text-sm">
          Nuevo jugador
          <input
            name="name"
            required
            className="mt-1 block rounded-lg border border-line px-3 py-2"
            placeholder="Nombre"
          />
        </label>
        <button className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white">
          Agregar
        </button>
      </form>

      {editing ? (
        <form
          action={updatePlayerAction}
          className="surface space-y-3 rounded-2xl p-5"
        >
          <h2 className="display text-2xl text-blue-deep">
            Editar {editing.name}
          </h2>
          <input type="hidden" name="slug" value={editing.slug} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Nombre
              <input
                name="name"
                defaultValue={editing.name}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Número
              <input
                name="number"
                defaultValue={editing.number ?? ""}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Posición
              <input
                name="position"
                defaultValue={editing.position ?? ""}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Alias (separados por coma)
              <input
                name="aliases"
                defaultValue={(editing.aliases ?? []).join(", ")}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <PlayerPhotoEditor
              playerName={editing.name}
              initialUrl={editing.photoUrl ?? editingResolved?.url ?? ""}
              initialCrop={editing.photoCrop ?? editingResolved?.crop}
              taggedPhotos={editingTagged.map((p) => ({
                imageUrl: p.imageUrl,
                caption: p.caption,
              }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing.active !== false}
              />
              Activo
            </label>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white">
              Guardar
            </button>
            <Link
              href="/admin/jugadores"
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
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2 text-left">Posición</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => {
              const photo = resolvePlayerPhoto(p, data.photos);
              return (
                <tr key={p.slug} className="border-b border-line">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        url={photo?.url}
                        crop={photo?.crop}
                        name={p.name}
                        className="h-9 w-9 border-2"
                        fallback={p.number ?? p.name.slice(0, 1)}
                      />
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{p.number ?? "—"}</td>
                  <td className="px-3 py-2">{p.position ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/jugadores?edit=${p.slug}`}
                      className="font-semibold text-blue"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
