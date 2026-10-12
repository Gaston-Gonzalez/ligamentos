import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getData } from "@/lib/data";
import { updateAttendanceAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function AdminAsistenciaPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const { index: raw } = await params;
  const index = Number(raw);
  const data = await getData();
  const match = data.matches.find((m) => m.index === index);
  if (!match) notFound();

  const statuses = [
    { value: "present", label: "Presente" },
    { value: "absent", label: "Ausente" },
    { value: "injury", label: "Lesión" },
    { value: "travel", label: "Viaje" },
    { value: "not_registered", label: "No fichado" },
  ];

  return (
    <div className="space-y-4">
      <Link href={`/admin/partidos?edit=${index}`} className="text-sm text-blue">
        ← Volver al partido
      </Link>
      <h2 className="display text-2xl text-blue-deep">
        Asistencia · vs {match.rival}
      </h2>
      <div className="space-y-2">
        {data.players.map((p) => {
          const row = data.attendances.find(
            (a) => a.matchIndex === index && a.player === p.name,
          );
          return (
            <form
              key={p.slug}
              action={updateAttendanceAction}
              className="surface flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2"
            >
              <input type="hidden" name="index" value={index} />
              <input type="hidden" name="player" value={p.name} />
              <span className="font-medium">{p.name}</span>
              <div className="flex items-center gap-2">
                <select
                  name="status"
                  defaultValue={row?.status ?? "not_registered"}
                  className="rounded-lg border border-line px-2 py-1 text-sm"
                >
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button className="rounded-full bg-blue px-3 py-1 text-xs font-semibold text-white">
                  OK
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
