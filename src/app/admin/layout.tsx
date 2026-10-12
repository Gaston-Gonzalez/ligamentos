import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/auth";
import { hasDatabase } from "@/lib/data";
import { logoutAction } from "./actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthenticated();
  const mode = hasDatabase() ? "database" : "json";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-3xl text-blue-deep">Admin</h1>
          <p className="text-sm text-muted">
            Almacenamiento: {mode === "database" ? "Neon Postgres" : "JSON local (data/)"}
          </p>
        </div>
        {authed ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/admin" className="rounded-full border border-line px-3 py-1">
              Panel
            </Link>
            <Link
              href="/admin/partidos"
              className="rounded-full border border-line px-3 py-1"
            >
              Partidos
            </Link>
            <Link
              href="/admin/jugadores"
              className="rounded-full border border-line px-3 py-1"
            >
              Jugadores
            </Link>
            <Link
              href="/admin/fotos"
              className="rounded-full border border-line px-3 py-1"
            >
              Fotos
            </Link>
            <form action={logoutAction}>
              <button className="rounded-full bg-blue-deep px-3 py-1 text-white">
                Salir
              </button>
            </form>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
