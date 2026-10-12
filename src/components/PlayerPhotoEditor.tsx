"use client";

import { useCallback, useRef, useState } from "react";
import type { PhotoCrop } from "@/lib/types";
import { DEFAULT_PHOTO_CROP } from "@/lib/players";
import { PlayerAvatar } from "./PlayerAvatar";

type TaggedPhoto = { imageUrl: string; caption?: string | null };

export function PlayerPhotoEditor({
  playerName,
  initialUrl,
  initialCrop,
  taggedPhotos,
}: {
  playerName: string;
  initialUrl?: string | null;
  initialCrop?: PhotoCrop | null;
  taggedPhotos: TaggedPhoto[];
}) {
  const defaultUrl = initialUrl ?? taggedPhotos[0]?.imageUrl ?? "";
  const [url, setUrl] = useState(defaultUrl);
  const [crop, setCrop] = useState<PhotoCrop>(
    initialCrop ?? DEFAULT_PHOTO_CROP,
  );
  const drag = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!url) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { px: e.clientX, py: e.clientY, ox: crop.x, oy: crop.y };
    },
    [crop.x, crop.y, url],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current || !boxRef.current) return;
    const size = boxRef.current.clientWidth || 1;
    const dx = ((e.clientX - drag.current.px) / size) * 100;
    const dy = ((e.clientY - drag.current.py) / size) * 100;
    setCrop((c) => {
      const max = 45 * c.zoom;
      return {
        ...c,
        x: Math.max(-max, Math.min(max, drag.current!.ox + dx)),
        y: Math.max(-max, Math.min(max, drag.current!.oy + dy)),
      };
    });
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white/50 p-4 md:col-span-2">
      <input type="hidden" name="photoUrl" value={url} />
      <input type="hidden" name="photoCrop" value={JSON.stringify(crop)} />

      <p className="text-sm font-semibold text-blue-deep">Foto de perfil</p>
      <p className="text-xs text-muted">
        Elegí una foto donde esté etiquetado, arrastrá para encuadrar y usá el
        zoom. Si no hay foto elegida, se usa la primera etiquetada.
      </p>

      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <div
          ref={boxRef}
          className="relative h-56 w-56 cursor-grab touch-none overflow-hidden rounded-full border-4 border-gold bg-blue-deep active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={playerName}
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none object-cover"
              style={{
                width: `${crop.zoom * 100}%`,
                height: `${crop.zoom * 100}%`,
                transform: `translate(calc(-50% + ${crop.x}%), calc(-50% + ${crop.y}%))`,
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              Sin fotos
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <label className="block text-sm">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={crop.zoom}
              onChange={(e) =>
                setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))
              }
              className="mt-1 w-full"
              disabled={!url}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
              onClick={() => setCrop(DEFAULT_PHOTO_CROP)}
              disabled={!url}
            >
              Centrar
            </button>
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
              onClick={() => {
                setUrl("");
                setCrop(DEFAULT_PHOTO_CROP);
              }}
            >
              Quitar foto
            </button>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">Vista previa</p>
            <PlayerAvatar
              url={url || null}
              crop={crop}
              name={playerName}
              className="h-16 w-16 border-2"
              fallback={playerName.slice(0, 1)}
            />
          </div>
        </div>
      </div>

      {taggedPhotos.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Fotos etiquetadas ({taggedPhotos.length})
          </p>
          <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            {taggedPhotos.map((p) => {
              const selected = p.imageUrl === url;
              return (
                <button
                  key={p.imageUrl}
                  type="button"
                  onClick={() => {
                    setUrl(p.imageUrl);
                    setCrop(DEFAULT_PHOTO_CROP);
                  }}
                  className={`overflow-hidden rounded-lg border-2 ${
                    selected ? "border-blue" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={p.caption ?? "Foto"}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Todavía no hay fotos etiquetadas con este jugador. Etiquetalo desde
          la galería o el carrusel.
        </p>
      )}
    </div>
  );
}
