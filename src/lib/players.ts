import type { PhotoCrop, SeedData, SeedPhoto, SeedPlayer } from "./types";

export const DEFAULT_PHOTO_CROP: PhotoCrop = { x: 0, y: 0, zoom: 1 };

export function parsePhotoCrop(raw: unknown): PhotoCrop | null {
  if (!raw) return null;
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("x" in value) ||
    !("y" in value) ||
    !("zoom" in value)
  ) {
    return null;
  }
  const v = value as PhotoCrop;
  return {
    x: Number.isFinite(v.x) ? v.x : 0,
    y: Number.isFinite(v.y) ? v.y : 0,
    zoom: Number.isFinite(v.zoom) ? Math.min(3, Math.max(1, v.zoom)) : 1,
  };
}

/** Explicit profile photo, or first tagged gallery photo as fallback. */
export function resolvePlayerPhoto(
  player: SeedPlayer,
  photos: SeedPhoto[] | undefined,
): { url: string; crop: PhotoCrop; fromTagged: boolean } | null {
  if (player.photoUrl) {
    return {
      url: player.photoUrl,
      crop: player.photoCrop ?? DEFAULT_PHOTO_CROP,
      fromTagged: false,
    };
  }
  const tagged = (photos ?? []).find((p) =>
    (p.taggedPlayerSlugs ?? []).includes(player.slug),
  );
  if (!tagged) return null;
  return {
    url: tagged.imageUrl,
    crop: DEFAULT_PHOTO_CROP,
    fromTagged: true,
  };
}

/** Resolve a player by slug, exact name, or alias. */
export function findPlayer(
  data: SeedData,
  nameOrSlug: string | null | undefined,
): SeedPlayer | null {
  if (!nameOrSlug) return null;
  const key = nameOrSlug.trim();
  const lower = key.toLowerCase();

  return (
    data.players.find((p) => p.slug === key) ??
    data.players.find((p) => p.name === key) ??
    data.players.find((p) => p.name.toLowerCase() === lower) ??
    data.players.find((p) =>
      (p.aliases ?? []).some((a) => a.toLowerCase() === lower),
    ) ??
    null
  );
}

export function displayPlayerName(
  data: SeedData,
  nameOrSlug: string | null | undefined,
): string {
  if (!nameOrSlug) return "—";
  return findPlayer(data, nameOrSlug)?.name ?? nameOrSlug;
}
