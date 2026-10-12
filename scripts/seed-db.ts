/**
 * Loads data/seed.json (+ optional ligapro-photos.json) into Neon.
 * Requires DATABASE_URL.
 * Run: npx tsx scripts/seed-db.ts
 */
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { SeedData, SeedPhoto } from "../src/lib/types";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const dataDir = path.join(process.cwd(), "data");
  const seed = JSON.parse(
    await fs.readFile(path.join(dataDir, "seed.json"), "utf8"),
  ) as SeedData;

  let photos: SeedPhoto[] = seed.photos ?? [];
  try {
    const pack = JSON.parse(
      await fs.readFile(path.join(dataDir, "ligapro-photos.json"), "utf8"),
    ) as { photos: SeedPhoto[] };
    photos = [...photos, ...(pack.photos ?? [])];
  } catch {
    // optional
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log("Resetting tables...");
  await db.execute(sql`truncate table photo_tags, photos, goals, attendances, matches, players, championships restart identity cascade`);

  console.log("Inserting championships...");
  const champRows = await db
    .insert(schema.championships)
    .values(
      seed.championships.map((c) => ({
        name: c.name,
        slug: c.slug,
        series: c.series ?? "Serie 4",
        division: c.division ?? null,
        ligaproUrl: c.ligaproUrl ?? null,
        ligaproGalleryUrl: c.ligaproGalleryUrl ?? null,
      })),
    )
    .returning();
  const champByName = new Map(champRows.map((c) => [c.name, c]));

  console.log("Inserting players...");
  const playerRows = await db
    .insert(schema.players)
    .values(
      seed.players.map((p) => ({
        name: p.name,
        slug: p.slug,
        aliases: p.aliases ?? [],
        number: p.number ?? null,
        position: p.position ?? null,
        photoUrl: p.photoUrl ?? null,
        photoCrop: p.photoCrop ? JSON.stringify(p.photoCrop) : null,
        active: p.active ?? true,
      })),
    )
    .returning();
  const playerByName = new Map(playerRows.map((p) => [p.name, p]));

  console.log("Inserting matches...");
  const matchRows = await db
    .insert(schema.matches)
    .values(
      seed.matches.map((m) => {
        const champ = champByName.get(m.championship);
        if (!champ) throw new Error(`Missing championship ${m.championship}`);
        return {
          championshipId: champ.id,
          matchIndex: m.index,
          date: m.date,
          rival: m.rival,
          pitch: m.pitch,
          goalsFor: m.goalsFor,
          goalsAgainst: m.goalsAgainst,
          result: m.result,
          jornada: m.jornada ?? null,
          youtubeUrl: m.youtubeUrl ?? null,
          ligaproAlbumId: m.ligaproAlbumId ?? null,
          ligaproAlbumUrl: m.ligaproAlbumUrl ?? null,
          notes: m.notes ?? null,
        };
      }),
    )
    .returning();
  const matchByIndex = new Map(
    matchRows.map((m) => [m.matchIndex as number, m]),
  );

  console.log("Inserting attendances...");
  const attendanceValues = seed.attendances
    .map((a) => {
      const match = matchByIndex.get(a.matchIndex);
      const player = playerByName.get(a.player);
      if (!match || !player) return null;
      return {
        matchId: match.id,
        playerId: player.id,
        status: a.status,
      };
    })
    .filter(Boolean) as {
    matchId: number;
    playerId: number;
    status: string;
  }[];

  const chunk = 500;
  for (let i = 0; i < attendanceValues.length; i += chunk) {
    await db.insert(schema.attendances).values(attendanceValues.slice(i, i + chunk));
  }

  console.log("Inserting goals...");
  const goalValues = seed.goals
    .map((g) => {
      const match = matchByIndex.get(g.matchIndex);
      if (!match) return null;
      const player = g.player ? playerByName.get(g.player) : null;
      return {
        matchId: match.id,
        playerId: player?.id ?? null,
        isOwnGoal: g.isOwnGoal,
      };
    })
    .filter(Boolean) as {
    matchId: number;
    playerId: number | null;
    isOwnGoal: boolean;
  }[];
  if (goalValues.length) {
    await db.insert(schema.goals).values(goalValues);
  }

  console.log("Inserting photos...");
  const champBySlug = new Map(champRows.map((c) => [c.slug, c]));
  const uniquePhotos = new Map<string, SeedPhoto>();
  for (const p of photos) uniquePhotos.set(p.imageUrl, p);

  for (const p of uniquePhotos.values()) {
    const match = p.matchIndex != null ? matchByIndex.get(p.matchIndex) : null;
    const champ = p.championshipSlug
      ? champBySlug.get(p.championshipSlug)
      : null;
    const [photoRow] = await db
      .insert(schema.photos)
      .values({
        imageUrl: p.imageUrl,
        sourcePageUrl: p.sourcePageUrl ?? null,
        championshipId: champ?.id ?? match?.championshipId ?? null,
        matchId: match?.id ?? null,
        caption: p.caption ?? null,
        sortOrder: p.sortOrder ?? 0,
      })
      .onConflictDoNothing()
      .returning();

    if (!photoRow) continue;
    const tags = p.taggedPlayerSlugs ?? [];
    for (const slug of tags) {
      const player = playerRows.find((pl) => pl.slug === slug);
      if (!player) continue;
      await db
        .insert(schema.photoTags)
        .values({ photoId: photoRow.id, playerId: player.id })
        .onConflictDoNothing();
    }
  }

  console.log(
    `Done: ${champRows.length} championships, ${playerRows.length} players, ${matchRows.length} matches, ${attendanceValues.length} attendances, ${goalValues.length} goals, ${uniquePhotos.size} photos`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
