import Image from "next/image";
import Link from "next/link";
import { MatchResultBadge } from "@/components/MatchResultBadge";
import type { SeedMatch } from "@/lib/types";

export function MatchCard({
  match,
  coverUrl,
  crestUrl,
}: {
  match: SeedMatch;
  coverUrl?: string | null;
  crestUrl?: string | null;
}) {
  return (
    <Link
      href={`/partidos/${match.index}`}
      className="group surface relative block overflow-hidden rounded-2xl transition hover:border-blue/40 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-blue-deep/90">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={`vs ${match.rival}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-deep via-blue to-blue-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />

        {crestUrl ? (
          <div
            className={`absolute overflow-hidden rounded-full border-2 border-white/85 bg-white/95 shadow-md ${
              coverUrl
                ? "right-3 top-3 h-14 w-14"
                : "left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-[70%]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={crestUrl}
              alt=""
              className="h-full w-full object-contain p-1.5"
            />
          </div>
        ) : null}

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="display text-lg leading-tight text-white drop-shadow md:text-xl">
              vs {match.rival}
            </p>
            <p className="mt-0.5 truncate text-xs text-white/85">
              {match.championship}
              {match.date ? ` · ${match.date}` : ""}
              {match.pitch ? ` · Cancha ${match.pitch}` : ""}
            </p>
          </div>
          <MatchResultBadge
            result={match.result}
            goalsFor={match.goalsFor}
            goalsAgainst={match.goalsAgainst}
          />
        </div>
      </div>
    </Link>
  );
}
