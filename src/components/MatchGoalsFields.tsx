"use client";

import { useEffect, useId, useRef, useState } from "react";

type GoalRow = {
  player: string;
  isOwnGoal: boolean;
  assistPlayer: string;
};

export function MatchGoalsFields({
  goalsFor: goalsForProp,
  initialGoals,
  players,
}: {
  goalsFor: number;
  initialGoals?: {
    player: string | null;
    isOwnGoal: boolean;
    assistPlayer?: string | null;
  }[];
  players: { name: string; slug: string }[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mismatchId = useId();
  const [goalsFor, setGoalsFor] = useState(goalsForProp);
  const [rows, setRows] = useState<GoalRow[]>(() =>
    (initialGoals ?? []).length > 0
      ? (initialGoals ?? []).map((g) => ({
          player: g.player ?? "",
          isOwnGoal: g.isOwnGoal,
          assistPlayer: g.assistPlayer ?? "",
        }))
      : [],
  );

  const mismatch = rows.length !== goalsFor;

  // Seguir el input "goalsFor" del mismo formulario.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const input = form.elements.namedItem("goalsFor");
    if (!(input instanceof HTMLInputElement)) return;

    const sync = () => {
      const n = Number(input.value);
      setGoalsFor(Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0);
    };
    sync();
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    return () => {
      input.removeEventListener("input", sync);
      input.removeEventListener("change", sync);
    };
  }, []);

  // Bloquear submit si no coinciden marcador y goleadores.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const onSubmit = (e: Event) => {
      const gfInput = form.elements.namedItem("goalsFor");
      const gf =
        gfInput instanceof HTMLInputElement
          ? Math.max(0, Math.trunc(Number(gfInput.value) || 0))
          : goalsFor;
      if (rows.length === gf) return;
      e.preventDefault();
      e.stopPropagation();
      setGoalsFor(gf);
      document.getElementById(mismatchId)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    };

    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [rows.length, goalsFor, mismatchId]);

  return (
    <div
      ref={rootRef}
      className="space-y-3 rounded-xl border border-line bg-white/50 p-4 md:col-span-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-blue-deep">Goleadores</p>
          <p className="text-xs text-muted">
            Marcador a favor: {goalsFor}. Un renglón por cada gol (con asistencia
            opcional).
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((r) => [
              ...r,
              { player: "", isOwnGoal: false, assistPlayer: "" },
            ])
          }
          className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
        >
          + Gol
        </button>
      </div>

      {mismatch ? (
        <p
          id={mismatchId}
          role="alert"
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          Hay {rows.length} goleador{rows.length === 1 ? "" : "es"} pero el
          marcador a favor es {goalsFor}. Deben ser iguales para guardar.
        </p>
      ) : (
        <p className="text-xs text-emerald-800">
          {goalsFor === 0
            ? "Sin goles a favor: no hace falta cargar goleadores."
            : `OK · ${rows.length} de ${goalsFor}`}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Sin goles cargados.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-2 py-2"
            >
              <span className="w-6 text-center text-xs text-muted">{i + 1}</span>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={row.isOwnGoal}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRows((r) =>
                      r.map((x, idx) =>
                        idx === i
                          ? {
                              player: checked ? "" : x.player,
                              isOwnGoal: checked,
                              assistPlayer: x.assistPlayer,
                            }
                          : x,
                      ),
                    );
                  }}
                />
                En contra
              </label>
              <input
                type="hidden"
                name="goalOwn"
                value={row.isOwnGoal ? "1" : "0"}
              />
              {row.isOwnGoal ? (
                <input type="hidden" name="goalPlayer" value="" />
              ) : (
                <select
                  name="goalPlayer"
                  value={row.player}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRows((r) =>
                      r.map((x, idx) =>
                        idx === i ? { ...x, player: v } : x,
                      ),
                    );
                  }}
                  required={!row.isOwnGoal}
                  className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-sm"
                >
                  <option value="">Goleador…</option>
                  {players.map((p) => (
                    <option key={p.slug} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                name="goalAssist"
                value={row.assistPlayer}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((r) =>
                    r.map((x, idx) =>
                      idx === i ? { ...x, assistPlayer: v } : x,
                    ),
                  );
                }}
                className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-sm"
              >
                <option value="">Sin asistencia</option>
                {players.map((p) => (
                  <option key={`a-${p.slug}`} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setRows((r) => r.filter((_, idx) => idx !== i))
                }
                className="text-xs font-semibold text-rose-700"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
