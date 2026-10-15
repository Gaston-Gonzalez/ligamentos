import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  attendances,
  championships,
  goals,
  matches,
  photoTags,
  photos,
  players,
} from "@/db/schema";
import { sortPhotosNewestFirst } from "./photos";
import { parsePhotoCrop } from "./players";
import type { SeedData, SeedPhoto } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJsonFile<T>(filename: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadJsonSeed(): Promise<SeedData> {
  const seed = await readJsonFile<SeedData>("seed.json");
  if (!seed) {
    throw new Error("data/seed.json not found. Run: npm run seed:parse");
  }
  const photoPack = await readJsonFile<{ photos: SeedPhoto[] }>(
    "ligapro-photos.json",
  );
  const overrides = await readJsonFile<Partial<SeedData>>("overrides.json");

  const merged: SeedData = {
    ...seed,
    ...(overrides ?? {}),
    championships: overrides?.championships ?? seed.championships,
    players: (overrides?.players ?? seed.players).map((p) => ({
      ...p,
      photoCrop: parsePhotoCrop(p.photoCrop),
    })),
    matches: overrides?.matches ?? seed.matches,
    attendances: overrides?.attendances ?? seed.attendances,
    goals: overrides?.goals ?? seed.goals,
    photos: [
      ...(seed.photos ?? []),
      ...(photoPack?.photos ?? []),
      ...(overrides?.photos ?? []),
    ],
  };

  // Dedupe photos by URL
  const seen = new Set<string>();
  merged.photos = (merged.photos ?? []).filter((p) => {
    if (seen.has(p.imageUrl)) return false;
    seen.add(p.imageUrl);
    return true;
  });
  merged.photos = sortPhotosNewestFirst(merged.photos, merged.matches);

  return merged;
}

async function loadFromDatabase(): Promise<SeedData> {
  const db = getDb();
  const [
    championshipRows,
    playerRows,
    matchRows,
    attendanceRows,
    goalRows,
    photoRows,
    tagRows,
  ] = await Promise.all([
    db.select().from(championships),
    db.select().from(players),
    db.select().from(matches),
    db.select().from(attendances),
    db.select().from(goals),
    db.select().from(photos),
    db.select().from(photoTags),
  ]);

  const champById = new Map(championshipRows.map((c) => [c.id, c]));
  const playerById = new Map(playerRows.map((p) => [p.id, p]));
  const matchById = new Map(matchRows.map((m) => [m.id, m]));

  const tagsByPhoto = new Map<number, string[]>();
  for (const t of tagRows) {
    const player = playerById.get(t.playerId);
    if (!player) continue;
    const list = tagsByPhoto.get(t.photoId) ?? [];
    list.push(player.slug);
    tagsByPhoto.set(t.photoId, list);
  }

  const data: SeedData = {
    team: "Ligamentos Cruzeiro",
    championships: championshipRows.map((c) => ({
      name: c.name,
      slug: c.slug,
      series: c.series,
      division: c.division,
      ligaproUrl: c.ligaproUrl,
      ligaproGalleryUrl: c.ligaproGalleryUrl,
    })),
    players: playerRows.map((p) => ({
      name: p.name,
      slug: p.slug,
      aliases: p.aliases ?? [],
      number: p.number,
      position: p.position,
      photoUrl: p.photoUrl,
      photoCrop: parsePhotoCrop(p.photoCrop),
      active: p.active,
    })),
    matches: matchRows.map((m) => {
      const champ = champById.get(m.championshipId);
      return {
        index: m.matchIndex ?? m.id,
        rival: m.rival,
        championship: champ?.name ?? "Sin torneo",
        pitch: m.pitch,
        result: (m.result as "W" | "D" | "L" | null) ?? null,
        goalsFor: m.goalsFor,
        goalsAgainst: m.goalsAgainst,
        date: m.date,
        jornada: m.jornada,
        youtubeUrl: m.youtubeUrl,
        ligaproAlbumId: m.ligaproAlbumId,
        ligaproAlbumUrl: m.ligaproAlbumUrl,
        coverImageUrl: m.coverImageUrl,
        notes: m.notes,
      };
    }),
    attendances: attendanceRows.map((a) => {
      const match = matchById.get(a.matchId);
      const player = playerById.get(a.playerId);
      return {
        matchIndex: match?.matchIndex ?? a.matchId,
        player: player?.name ?? "?",
        status: a.status,
      };
    }),
    goals: goalRows.map((g) => {
      const match = matchById.get(g.matchId);
      const player = g.playerId ? playerById.get(g.playerId) : null;
      const assist = g.assistPlayerId
        ? playerById.get(g.assistPlayerId)
        : null;
      return {
        matchIndex: match?.matchIndex ?? g.matchId,
        player: player?.name ?? null,
        isOwnGoal: g.isOwnGoal,
        assistPlayer: assist?.name ?? null,
      };
    }),
    photos: photoRows.map((p) => {
      const match = p.matchId ? matchById.get(p.matchId) : null;
      const champ = p.championshipId
        ? champById.get(p.championshipId)
        : null;
      return {
        imageUrl: p.imageUrl,
        sourcePageUrl: p.sourcePageUrl,
        championshipSlug: champ?.slug ?? null,
        matchIndex: match?.matchIndex ?? null,
        caption: p.caption,
        taggedPlayerSlugs: tagsByPhoto.get(p.id) ?? [],
        sortOrder: p.sortOrder,
      };
    }),
  };
  data.photos = sortPhotosNewestFirst(data.photos ?? [], data.matches);
  return data;
}

export const getData = cache(async (): Promise<SeedData> => {
  if (hasDatabase()) {
    try {
      return await loadFromDatabase();
    } catch (err) {
      console.error("DB load failed, falling back to JSON seed", err);
    }
  }
  return loadJsonSeed();
});

export async function getChampionship(slug: string) {
  const data = await getData();
  return data.championships.find((c) => c.slug === slug) ?? null;
}

export async function getPlayer(slug: string) {
  const data = await getData();
  return data.players.find((p) => p.slug === slug) ?? null;
}

export async function getMatchByIndex(index: number) {
  const data = await getData();
  return data.matches.find((m) => m.index === index) ?? null;
}

export async function getPhotosForMatch(matchIndex: number) {
  const data = await getData();
  return sortPhotosNewestFirst(
    (data.photos ?? []).filter((p) => p.matchIndex === matchIndex),
    data.matches,
  );
}

export async function getPhotosForPlayer(playerSlug: string) {
  const data = await getData();
  return sortPhotosNewestFirst(
    (data.photos ?? []).filter((p) =>
      (p.taggedPlayerSlugs ?? []).includes(playerSlug),
    ),
    data.matches,
  );
}

export async function getPhotosForChampionship(championshipSlug: string) {
  const data = await getData();
  return sortPhotosNewestFirst(
    (data.photos ?? []).filter(
      (p) => p.championshipSlug === championshipSlug,
    ),
    data.matches,
  );
}

/** Resolve DB ids for admin mutations when DATABASE_URL is set */
export async function resolveDbIds() {
  if (!hasDatabase()) return null;
  const db = getDb();
  const [champs, pls, mts] = await Promise.all([
    db.select().from(championships),
    db.select().from(players),
    db.select().from(matches),
  ]);
  return {
    db,
    championships: champs,
    players: pls,
    matches: mts,
    championshipBySlug: new Map(champs.map((c) => [c.slug, c])),
    playerBySlug: new Map(pls.map((p) => [p.slug, p])),
    matchByIndex: new Map(
      mts.filter((m) => m.matchIndex != null).map((m) => [m.matchIndex!, m]),
    ),
  };
}

export { hasDatabase, eq };
