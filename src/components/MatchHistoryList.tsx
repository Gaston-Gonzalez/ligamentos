"use client";

import Image from "next/image";
import Link from "next/link";
import { IoFootball } from "react-icons/io5";
import { MatchResultBadge } from "@/components/MatchResultBadge";

export type HistoryItem = {
  matchIndex: number;
  rival: string;
  championship: string;
  date: string | null;
  result: string | null;
  goalsFor: number;
  goalsAgainst: number;
  goalsInMatch: number;
  crestUrl: string | null;
};

export function MatchHistoryList({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">Sin partidos presentes cargados.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((h) => (
        <li key={h.matchIndex}>
          <Link
            href={`/partidos/${h.matchIndex}`}
            className="surface flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
                {h.crestUrl ? (
                  <Image
                    src={h.crestUrl}
                    alt={`Escudo ${h.rival}`}
                    width={48}
                    height={48}
                    className="h-full w-full object-contain p-1"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm font-bold text-muted">
                    {h.rival.slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-blue-deep">vs {h.rival}</p>
                <p className="text-sm text-muted">
                  {h.championship}
                  {h.date ? ` · ${h.date}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {h.goalsInMatch > 0 ? (
                <div
                  className="flex items-center gap-0.5 text-blue-deep"
                  title={`${h.goalsInMatch} gol${h.goalsInMatch === 1 ? "" : "es"}`}
                  aria-label={`${h.goalsInMatch} gol${h.goalsInMatch === 1 ? "" : "es"}`}
                >
                  {Array.from({ length: h.goalsInMatch }, (_, i) => (
                    <IoFootball key={i} className="h-5 w-5 shrink-0" />
                  ))}
                </div>
              ) : null}
              <MatchResultBadge
                result={h.result}
                goalsFor={h.goalsFor}
                goalsAgainst={h.goalsAgainst}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
