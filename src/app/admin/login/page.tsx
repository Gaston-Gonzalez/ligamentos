import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { loginAction } from "../actions";

export const metadata = { title: "Admin login" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdminAuthenticated()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <form
      action={loginAction}
      className="surface mx-auto max-w-md rounded-2xl p-6"
    >
      <h2 className="display text-2xl text-blue-deep">Ingresar</h2>
      <p className="mt-2 text-sm text-muted">
        Contraseña de admin. Por defecto en local: <code>ligamentos</code>
      </p>
      {error ? (
        <p className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
          Contraseña incorrecta
        </p>
      ) : null}
      <label className="mt-4 block text-sm font-semibold">
        Contraseña
        <input
          type="password"
          name="password"
          required
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="mt-4 w-full rounded-full bg-blue px-4 py-2 font-semibold text-white"
      >
        Entrar
      </button>
    </form>
  );
}
