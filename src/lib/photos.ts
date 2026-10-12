import type { SeedMatch, SeedPhoto } from "./types";

/** Unix-ish timestamp embedded in Liga Pro filenames: …/1791171885-2W6A8303.jpg */
export function photoUrlTimestamp(imageUrl: string): number {
  const m = imageUrl.match(/\/(\d{9,12})[-_]/);
  if (m) return Number(m[1]);
  return 0;
}

function matchDateMs(
  photo: SeedPhoto,
  matchesByIndex: Map<number, SeedMatch>,
): number {
  if (photo.matchIndex == null) return 0;
  const date = matchesByIndex.get(photo.matchIndex)?.date;
  if (!date) return 0;
  const ms = Date.parse(date);
  return Number.isFinite(ms) ? ms : 0;
}

/** Newest → oldest: match date, then URL timestamp, then sortOrder. */
export function sortPhotosNewestFirst(
  photos: SeedPhoto[],
  matches: SeedMatch[] = [],
): SeedPhoto[] {
  const matchesByIndex = new Map(matches.map((m) => [m.index, m]));
  return [...photos].sort((a, b) => {
    const da = matchDateMs(a, matchesByIndex);
    const db = matchDateMs(b, matchesByIndex);
    if (da !== db) return db - da;
    const ta = photoUrlTimestamp(a.imageUrl);
    const tb = photoUrlTimestamp(b.imageUrl);
    if (ta !== tb) return tb - ta;
    return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
  });
}

export function coverPhotoForMatch(
  photos: SeedPhoto[],
  matchOrIndex: SeedMatch | number,
): SeedPhoto | null {
  const match =
    typeof matchOrIndex === "number" ? null : matchOrIndex;
  const matchIndex =
    typeof matchOrIndex === "number" ? matchOrIndex : matchOrIndex.index;
  const mine = photos.filter((p) => p.matchIndex === matchIndex);

  const preferred = match?.coverImageUrl?.trim();
  if (preferred) {
    const fromMatch = mine.find((p) => p.imageUrl === preferred);
    if (fromMatch) return fromMatch;
    const anywhere = photos.find((p) => p.imageUrl === preferred);
    if (anywhere) return anywhere;
    return {
      imageUrl: preferred,
      matchIndex,
      caption: null,
      taggedPlayerSlugs: [],
    };
  }

  if (mine.length === 0) return null;
  return sortPhotosNewestFirst(mine)[0] ?? null;
}
