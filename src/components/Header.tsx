import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/campeonatos", label: "Campeonatos" },
  { href: "/jugadores", label: "Jugadores" },
  { href: "/partidos", label: "Partidos" },
  { href: "/estadisticas", label: "Estadísticas" },
  { href: "/galeria", label: "Galería" },
  { href: "/videos", label: "Videos" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#0f2868]/95 text-white backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/escudo.jpg"
            alt="Escudo Ligamentos Cruzeiro"
            width={48}
            height={48}
            className="rounded-full border-2 border-gold shadow-[0_0_0_2px_rgba(224,179,58,0.25)]"
            priority
          />
          <div className="leading-tight">
            <p className="display text-lg text-gold-soft md:text-xl">
              Ligamentos
            </p>
            <p className="text-xs tracking-[0.18em] text-white/70">CRUZEIRO</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-gold-soft"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/admin"
            className="ml-2 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gold-soft transition hover:bg-gold/15"
          >
            Admin
          </Link>
        </nav>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
