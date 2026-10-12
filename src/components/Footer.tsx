import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-blue-deep text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="display text-gold-soft">Ligamentos Cruzeiro</p>
          <p className="mt-1 text-sm text-white/65">
            Serie 4 · Liga Pro · Desde Clausura 2024
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-white/75">
          <a
            href="https://www.ligapro.uy"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gold-soft"
          >
            Liga Pro
          </a>
          <a
            href="https://www.youtube.com/@LigamentosCruzeiro"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gold-soft"
          >
            YouTube
          </a>
          <Link href="/admin" className="hover:text-gold-soft">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
