"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tagPhotoAction } from "@/app/actions/photos";

export type CarouselPhoto = {
  imageUrl: string;
  caption?: string | null;
  /** Display names for captions under thumbs */
  tags?: string[];
  taggedPlayerSlugs?: string[];
};

export type CarouselPlayer = {
  slug: string;
  name: string;
};

export function PhotoCarousel({
  photos,
  players = [],
  alt = "Foto",
}: {
  photos: CarouselPhoto[];
  /** When provided, enables public tagging in the lightbox */
  players?: CarouselPlayer[];
  alt?: string;
}) {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const canTag = players.length > 0;

  useEffect(() => {
    if (openIndex == null) return;
    setDraftTags(photos[openIndex]?.taggedPlayerSlugs ?? []);
    setSavedFlash(false);
    setTagsOpen(false);
  }, [openIndex, photos]);

  useEffect(() => {
    if (openIndex == null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") {
        setOpenIndex((i) => (i == null ? i : (i + 1) % photos.length));
      }
      if (e.key === "ArrowLeft") {
        setOpenIndex((i) =>
          i == null ? i : (i - 1 + photos.length) % photos.length,
        );
      }
    }

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openIndex, photos.length]);

  if (photos.length === 0) return null;

  const current = openIndex != null ? photos[openIndex] : null;

  function toggleTag(slug: string) {
    setDraftTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
    setSavedFlash(false);
  }

  function saveTags() {
    if (!current) return;
    const fd = new FormData();
    fd.set("imageUrl", current.imageUrl);
    for (const slug of draftTags) fd.append("tags", slug);
    startTransition(async () => {
      await tagPhotoAction(fd);
      setSavedFlash(true);
      router.refresh();
    });
  }

  const displayTags =
    draftTags.length > 0
      ? draftTags
          .map((s) => players.find((p) => p.slug === s)?.name ?? s)
          .join(", ")
      : (current?.tags ?? []).join(", ");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {photos.map((p, i) => (
          <figure
            key={p.imageUrl}
            className="overflow-hidden rounded-xl border border-line bg-white/60"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="block w-full cursor-zoom-in text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt={p.caption ?? alt}
                className="aspect-[4/3] w-full object-cover transition hover:opacity-90"
                loading="lazy"
              />
            </button>
            {(p.tags ?? []).length > 0 ? (
              <figcaption className="px-2 py-1 text-xs text-muted">
                {p.tags!.join(", ")}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      {current && openIndex != null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-20 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white hover:bg-white/25"
            onClick={() => setOpenIndex(null)}
          >
            Cerrar
          </button>

          {photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Anterior"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-xl text-white hover:bg-white/25 md:left-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((openIndex - 1 + photos.length) % photos.length);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-xl text-white hover:bg-white/25 md:right-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((openIndex + 1) % photos.length);
                }}
              >
                ›
              </button>
            </>
          ) : null}

          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col items-center gap-3 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.imageUrl}
              alt={current.caption ?? alt}
              className="max-h-[58vh] w-auto max-w-full rounded-lg object-contain"
            />
            <div className="w-full max-w-2xl text-center text-sm text-white/85">
              <p>
                {openIndex + 1} / {photos.length}
                {current.caption ? ` · ${current.caption}` : ""}
              </p>
              {displayTags ? (
                <p className="mt-1 text-white/65">{displayTags}</p>
              ) : null}
              <a
                href={current.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-gold-soft underline"
              >
                Abrir original
              </a>
            </div>

            {canTag ? (
              <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-black/45 text-left">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white"
                  onClick={() => setTagsOpen((o) => !o)}
                  aria-expanded={tagsOpen}
                >
                  <span>
                    Etiquetar jugadores
                    {draftTags.length > 0 ? (
                      <span className="ml-2 font-normal text-white/60">
                        ({draftTags.length})
                      </span>
                    ) : null}
                  </span>
                  <span className="text-white/70" aria-hidden>
                    {tagsOpen ? "▴" : "▾"}
                  </span>
                </button>
                {tagsOpen ? (
                  <div className="space-y-2 border-t border-white/10 px-4 pb-4 pt-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={saveTags}
                        className="rounded-full bg-blue px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {pending
                          ? "Guardando…"
                          : savedFlash
                            ? "Guardado"
                            : "Guardar"}
                      </button>
                    </div>
                    <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
                      {players.map((pl) => (
                        <label
                          key={pl.slug}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-white/90 hover:bg-white/10"
                        >
                          <input
                            type="checkbox"
                            checked={draftTags.includes(pl.slug)}
                            onChange={() => toggleTag(pl.slug)}
                            className="accent-blue"
                          />
                          {pl.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
