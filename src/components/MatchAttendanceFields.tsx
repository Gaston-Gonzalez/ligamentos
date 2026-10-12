"use client";

import { useState } from "react";

const STATUSES = [
  {
    value: "present",
    label: "Sí",
    title: "Presente",
    // Excel CF green (#B7E1CD)
    active: "bg-[#B7E1CD] text-[#0D652D] ring-1 ring-[#0D652D]/30",
    idle: "bg-white text-[#0D652D]/70 ring-1 ring-[#B7E1CD] hover:bg-[#B7E1CD]/50",
  },
  {
    value: "absent",
    label: "No",
    title: "Ausente",
    active: "bg-[#F4C7C3] text-[#A50E0E] ring-1 ring-[#A50E0E]/30",
    idle: "bg-white text-[#A50E0E]/70 ring-1 ring-[#F4C7C3] hover:bg-[#F4C7C3]/50",
  },
  {
    value: "injury",
    label: "Lesión",
    title: "Lesión",
    active: "bg-[#FFE599] text-[#7A5900] ring-1 ring-[#7A5900]/25",
    idle: "bg-white text-[#7A5900]/70 ring-1 ring-[#FFE599] hover:bg-[#FFE599]/50",
  },
  {
    value: "travel",
    label: "Viaje",
    title: "Viaje",
    // Excel blue (#9FC5E8)
    active: "bg-[#9FC5E8] text-[#174EA6] ring-1 ring-[#174EA6]/30",
    idle: "bg-white text-[#174EA6]/70 ring-1 ring-[#9FC5E8] hover:bg-[#9FC5E8]/50",
  },
  {
    value: "not_registered",
    label: "N/F",
    title: "No fichado",
    active: "bg-[#E8EAED] text-[#3C4043] ring-1 ring-[#3C4043]/20",
    idle: "bg-white text-[#5F6368] ring-1 ring-[#E8EAED] hover:bg-[#E8EAED]/70",
  },
] as const;

type StatusValue = (typeof STATUSES)[number]["value"];

const ROW_TINT: Record<StatusValue, string> = {
  present: "bg-[#B7E1CD]/35",
  absent: "bg-[#F4C7C3]/35",
  injury: "bg-[#FFE599]/35",
  travel: "bg-[#9FC5E8]/35",
  not_registered: "bg-[#E8EAED]/50",
};

export function MatchAttendanceFields({
  players,
  initialByPlayer,
}: {
  players: { name: string; slug: string }[];
  initialByPlayer?: Record<string, string>;
}) {
  const [byPlayer, setByPlayer] = useState<Record<string, StatusValue>>(() => {
    const init: Record<string, StatusValue> = {};
    for (const p of players) {
      const raw = initialByPlayer?.[p.name] ?? "not_registered";
      init[p.name] = (
        STATUSES.some((s) => s.value === raw) ? raw : "not_registered"
      ) as StatusValue;
    }
    return init;
  });

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white/50 p-4 md:col-span-2">
      <div>
        <p className="text-sm font-semibold text-blue-deep">Asistencia</p>
        <p className="text-xs text-muted">
          Tocá el estado de cada jugador (colores como en el Excel).
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
          {STATUSES.map((s) => (
            <span
              key={s.value}
              className={`rounded px-1.5 py-0.5 font-medium ${s.active}`}
            >
              {s.label} · {s.title}
            </span>
          ))}
        </div>
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {players.map((p) => {
          const status = byPlayer[p.name] ?? "not_registered";
          return (
            <div
              key={p.slug}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-2 py-1.5 ${ROW_TINT[status]}`}
            >
              <input type="hidden" name="attPlayer" value={p.name} />
              <input type="hidden" name="attStatus" value={status} />
              <span className="min-w-[7rem] text-sm font-medium">{p.name}</span>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label={`Asistencia de ${p.name}`}
              >
                {STATUSES.map((s) => {
                  const selected = status === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      title={s.title}
                      aria-pressed={selected}
                      onClick={() =>
                        setByPlayer((prev) => ({
                          ...prev,
                          [p.name]: s.value,
                        }))
                      }
                      className={`rounded px-2 py-1 text-xs font-semibold transition ${
                        selected ? s.active : s.idle
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
