/**
 * Update Neon photo↔match links (+ match album URLs) from ligapro-photos.json / seed.json.
 * Does NOT truncate photos or tags.
 *
 * Run after: npm run scrape:ligapro
 *   npx tsx scripts/resync-photos-neon.ts
 */
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { SeedData, SeedPhoto } from "../src/lib/types";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const dataDir = path.join(process.cwd(), "data");
  const seed = JSON.parse(
    await fs.readFile(path.join(dataDir, "seed.json"), "utf8"),
  ) as SeedData;
  const pack = JSON.parse(
    await fs.readFile(path.join(dataDir, "ligapro-photos.json"), "utf8"),
  ) as { photos: SeedPhoto[] };

  const db = drizzle(neon(process.env.DATABASE_URL), { schema });
  const [matchRows, champRows, photoRows] = await Promise.all([
    db.select().from(schema.matches),
    db.select().from(schema.championships),
    db.select().from(schema.photos),
  ]);

  const matchByIndex = new Map(
    matchRows
      .filter((m) => m.matchIndex != null)
      .map((m) => [m.matchIndex!, m]),
  );
  const champBySlug = new Map(champRows.map((c) => [c.slug, c]));
  const photoByUrl = new Map(photoRows.map((p) => [p.imageUrl, p]));

  // Sync album URLs on matches from seed
  let albums = 0;
  for (const m of seed.matches) {
    if (!m.ligaproAlbumUrl && !m.ligaproAlbumId) continue;
    const row = matchByIndex.get(m.index);
    if (!row) continue;
    await db
      .update(schema.matches)
      .set({
        ligaproAlbumId: m.ligaproAlbumId ?? row.ligaproAlbumId,
        ligaproAlbumUrl: m.ligaproAlbumUrl ?? row.ligaproAlbumUrl,
        jornada: m.jornada ?? row.jornada,
      })
      .where(eq(schema.matches.id, row.id));
    albums += 1;
  }
  console.log(`Updated album URLs on ${albums} matches`);

  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  for (const p of pack.photos ?? []) {
    const match =
      p.matchIndex != null ? matchByIndex.get(p.matchIndex) : null;
    const champ = p.championshipSlug
      ? champBySlug.get(p.championshipSlug)
      : null;
    const existing = photoByUrl.get(p.imageUrl);

    if (existing) {
      const nextMatchId = match?.id ?? null;
      const nextChampId = champ?.id ?? match?.championshipId ?? null;
      if (
        existing.matchId !== nextMatchId ||
        existing.championshipId !== nextChampId
      ) {
        await db
          .update(schema.photos)
          .set({
            matchId: nextMatchId,
            championshipId: nextChampId,
            caption: p.caption ?? existing.caption,
            sourcePageUrl: p.sourcePageUrl ?? existing.sourcePageUrl,
            sortOrder: p.sortOrder ?? existing.sortOrder,
          })
          .where(eq(schema.photos.id, existing.id));
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await db.insert(schema.photos).values({
      imageUrl: p.imageUrl,
      sourcePageUrl: p.sourcePageUrl ?? null,
      championshipId: champ?.id ?? match?.championshipId ?? null,
      matchId: match?.id ?? null,
      caption: p.caption ?? null,
      sortOrder: p.sortOrder ?? 0,
    });
    inserted += 1;
  }

  console.log(
    `Photos: updated=${updated} inserted=${inserted} unchanged=${skipped}`,
  );

  // Coverage summary
  const photosAfter = await db.select().from(schema.photos);
  const byMatch = new Map<number, number>();
  for (const p of photosAfter) {
    if (p.matchId == null) continue;
    byMatch.set(p.matchId, (byMatch.get(p.matchId) ?? 0) + 1);
  }
  const missing = matchRows.filter((m) => !byMatch.has(m.id));
  console.log(
    `Coverage: ${matchRows.length - missing.length}/${matchRows.length} matches have photos`,
  );
  for (const m of missing.sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  )) {
    console.log(
      `  still missing #${m.matchIndex} ${m.date} vs ${m.rival} ${m.goalsFor}-${m.goalsAgainst}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
