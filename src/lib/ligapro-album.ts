const LIGAPRO_GAMES = "https://www.ligapro.uy/api/games";

/** Game id from a Liga Pro album URL (`/galeria/album/123`). */
export function ligaproAlbumIdFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const match = url.match(/\/galeria\/album\/(\d+)/i);
  return match?.[1] ?? null;
}

export function ligaproImageUrl(img: string): string {
  const trimmed = img.trim();
  if (trimmed.startsWith("http")) return trimmed;
  return `https://r2.ligapro.uy/${trimmed.replace(/^\/+/, "")}`;
}

/** Photo URLs for one Liga Pro game album, in gallery order. */
export async function fetchLigaproAlbumImages(albumId: string): Promise<string[]> {
  const res = await fetch(`${LIGAPRO_GAMES}/${albumId}/gallery`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`No se pudo leer el álbum ${albumId} (${res.status})`);
  }
  const json = (await res.json()) as { data?: { img?: string }[] };
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of json.data ?? []) {
    if (!item.img?.trim()) continue;
    const imageUrl = ligaproImageUrl(item.img);
    if (seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    urls.push(imageUrl);
  }
  return urls;
}
