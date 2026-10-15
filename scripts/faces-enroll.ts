/**
 * Build face descriptors from manually tagged photos (+ optional player.photoUrl).
 *
 * Prerequisites:
 *   npm run faces:models
 *   Tag 2–4 clear close-up photos per player in /admin/fotos or galería
 *
 * Run: npx tsx scripts/faces-enroll.ts
 *   --min 1     minimum faces per player (default 1)
 */
import "dotenv/config";
import {
  averageDescriptors,
  detectBestFace,
  loadDescriptors,
  loadPhotos,
  loadSeedPlayers,
  parseArgs,
  saveDescriptors,
  type FaceDescriptorsFile,
} from "./lib/faces";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const minFaces = args.getNumber("min", 1);

  const players = await loadSeedPlayers();
  const photos = await loadPhotos();
  const bySlug = new Map(players.map((p) => [p.slug, p]));

  // Collect reference image URLs per player slug
  const refs = new Map<string, Set<string>>();
  for (const p of players) {
    refs.set(p.slug, new Set());
    if (p.photoUrl) refs.get(p.slug)!.add(p.photoUrl);
  }
  for (const photo of photos) {
    for (const slug of photo.taggedPlayerSlugs ?? []) {
      if (!bySlug.has(slug)) continue;
      refs.get(slug)?.add(photo.imageUrl);
    }
  }

  const withRefs = [...refs.entries()].filter(([, urls]) => urls.size > 0);
  console.log(
    `Players: ${players.length}; with reference images: ${withRefs.length}`,
  );
  if (!withRefs.length) {
    console.error(
      "No tagged photos or photoUrl found. Tag 2–4 clear faces per player first.",
    );
    process.exit(1);
  }

  const next: FaceDescriptorsFile = {
    updatedAt: new Date().toISOString(),
    players: {},
  };

  let enrolled = 0;
  let skipped = 0;

  for (const [slug, urls] of withRefs) {
    const player = bySlug.get(slug)!;
    const descriptors: Float32Array[] = [];
    const sources: string[] = [];

    for (const url of urls) {
      try {
        const face = await detectBestFace(url);
        if (!face) {
          console.log(`  skip (no face): ${slug} ← ${url}`);
          continue;
        }
        descriptors.push(face.descriptor);
        sources.push(url);
        console.log(
          `  face ok (${face.score.toFixed(2)}): ${slug} ← ${url.slice(-60)}`,
        );
      } catch (err) {
        console.warn(
          `  error ${slug}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (descriptors.length < minFaces) {
      console.log(
        `SKIP ${player.name} (${slug}): ${descriptors.length}/${minFaces} faces`,
      );
      skipped += 1;
      continue;
    }

    const avg = averageDescriptors(descriptors);
    next.players[slug] = {
      name: player.name,
      descriptor: Array.from(avg),
      sources,
    };
    enrolled += 1;
    console.log(
      `ENROLLED ${player.name} (${slug}) from ${sources.length} image(s)`,
    );
  }

  // Keep previously enrolled players that still exist if this run found nothing new for them?
  // Plan: full rebuild from current tags — overwrite file.
  await saveDescriptors(next);

  console.log(
    `\nDone. Enrolled ${enrolled}, skipped ${skipped}. Wrote data/face-descriptors.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
