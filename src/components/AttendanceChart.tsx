"use client";

import { useState } from "react";
import type { AttendancePoint } from "@/lib/stats";

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(iso: string): string {
  const [year, month] = iso.split("-");
  const m = Number(month);
  if (!year || !m) return iso;
  return `${MONTHS[m - 1] ?? month} ${year.slice(2)}`;
}

export function AttendanceChart({ points }: { points: AttendancePoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="text-sm text-muted">Sin partidos con fecha.</p>;
  }

  const width = 920;
  const pad = { l: 36, r: 12, t: 16, b: 32 };
  const presentH = 168;
  const absenceH = 72;
  const gap = 28;
  const height = pad.t + presentH + gap + absenceH + pad.b;
  const innerW = width - pad.l - pad.r;
  const n = points.length;
  const maxPresent = Math.max(1, ...points.map((p) => p.present));
  const maxAbsence = Math.max(
    1,
    ...points.map((p) => p.injury + p.travel),
  );

  const x = (i: number) =>
    n === 1 ? pad.l + innerW / 2 : pad.l + (i / (n - 1)) * innerW;
  const yPresent = (value: number) =>
    pad.t + presentH * (1 - value / maxPresent);
  const absenceTop = pad.t + presentH + gap;
  const absenceBase = absenceTop + absenceH;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yPresent(p.present).toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${yPresent(0).toFixed(1)} L ${x(0).toFixed(1)} ${yPresent(0).toFixed(1)} Z`;

  const yTicks = [maxPresent, Math.round(maxPresent / 2)].filter(
    (tick, index, all) => tick > 0 && all.indexOf(tick) === index,
  );
  const hovered = active != null ? points[active] : null;

  return (
    <div className="surface rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue" />
          Presentes
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
          Lesión
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          Viaje
        </span>
      </div>
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[720px] w-full"
          role="img"
          aria-label="Presentes, lesiones y viajes por partido a lo largo del tiempo"
          onMouseLeave={() => setActive(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={yPresent(tick)}
                y2={yPresent(tick)}
                stroke="rgba(22,58,154,0.12)"
              />
              <text
                x={pad.l - 8}
                y={yPresent(tick) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#5b6b86"
              >
                {tick}
              </text>
            </g>
          ))}
          <path d={area} fill="rgba(30,78,216,0.12)" />
          <path d={line} fill="none" stroke="#1e4ed8" strokeWidth="2.5" />
          {points.map((p, i) => {
            const slot = n === 1 ? 16 : innerW / (n - 1);
            const barW = Math.max(2.5, Math.min(7, slot * 0.34));
            const injuryH = (p.injury / maxAbsence) * absenceH;
            const travelH = (p.travel / maxAbsence) * absenceH;
            const showLabel =
              monthKey(p.date) !== monthKey(points[i - 1]?.date ?? "");
            return (
              <g key={p.matchIndex} onMouseEnter={() => setActive(i)}>
                <rect
                  x={x(i) - slot / 2}
                  y={pad.t}
                  width={slot}
                  height={height - pad.t - pad.b}
                  fill={active === i ? "rgba(15,40,104,0.06)" : "transparent"}
                />
                <circle
                  cx={x(i)}
                  cy={yPresent(p.present)}
                  r={active === i ? 4.5 : 2.5}
                  fill="#1e4ed8"
                />
                <rect
                  x={x(i) - barW}
                  y={absenceBase - injuryH - travelH}
                  width={barW}
                  height={injuryH}
                  fill="#e11d48"
                  rx="1"
                />
                <rect
                  x={x(i) - barW}
                  y={absenceBase - travelH}
                  width={barW}
                  height={travelH}
                  fill="#e0b33a"
                  rx="1"
                />
                {showLabel ? (
                  <text
                    x={x(i)}
                    y={height - 10}
                    textAnchor="start"
                    fontSize="11"
                    fill="#5b6b86"
                  >
                    {monthLabel(p.date)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x={pad.l} y={absenceTop - 8} fontSize="11" fill="#5b6b86">
            Lesiones y viajes por partido
          </text>
          <text
            x={pad.l - 8}
            y={absenceTop + 12}
            textAnchor="end"
            fontSize="11"
            fill="#5b6b86"
          >
            {maxAbsence}
          </text>
        </svg>
        {hovered ? (
          <div className="pointer-events-none absolute left-4 top-3 rounded-xl border border-line bg-white/95 px-3 py-2 text-sm shadow-none">
            <p className="font-semibold text-blue-deep">
              vs {hovered.rival}
            </p>
            <p className="text-xs text-muted">
              {hovered.championship} · {hovered.date}
            </p>
            <p className="mt-1 text-blue-deep">
              {hovered.present} presentes · {hovered.injury} lesión
              {hovered.injury === 1 ? "" : "es"} · {hovered.travel} viaje
              {hovered.travel === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
