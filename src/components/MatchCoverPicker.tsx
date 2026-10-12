"use client";

import { useState } from "react";

export function MatchCoverPicker({
  photos,
  initialUrl,
}: {
  photos: { imageUrl: string; caption?: string | null }[];
  initialUrl?: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-white/50 p-4 md:col-span-2">
        <p className="text-sm font-semibold text-blue-deep">Foto de portada</p>
        <p className="mt-1 text-sm text-muted">
          Este partido no tiene fotos vinculadas todavía.
        </p>
        <input type="hidden" name="coverImageUrl" value="" />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white/50 p-4 md:col-span-2">
      <input type="hidden" name="coverImageUrl" value={url} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-blue-deep">Foto de portada</p>
          <p className="text-xs text-muted">
            Se usa en las cards del listado. Si no elegís, se toma la más
            reciente.
          </p>
        </div>
        {url ? (
          <button
            type="button"
            onClick={() => setUrl("")}
            className="text-xs font-semibold text-rose-700"
          >
            Quitar selección
          </button>
        ) : null}
      </div>

      <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
        {photos.map((p) => {
          const selected = url === p.imageUrl;
          return (
            <button
              key={p.imageUrl}
              type="button"
              title={p.caption ?? "Elegir portada"}
              onClick={() => setUrl(p.imageUrl)}
              className={`relative overflow-hidden rounded-lg border-2 transition ${
                selected
                  ? "border-blue ring-2 ring-blue/30"
                  : "border-transparent hover:border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt=""
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
              {selected ? (
                <span className="absolute inset-x-0 bottom-0 bg-blue/90 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-white">
                  Portada
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
