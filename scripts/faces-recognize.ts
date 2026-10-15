/**
 * Detect faces in gallery photos and auto-tag matching players (merge only).
 *
 * Prerequisites:
 *   npm run faces:models
 *   npm run faces:enroll
 *
 * Run (prefer npx — npm steals flags like --force / --limit):
 *   npx tsx scripts/faces-recognize.ts --max=20
 *   npx tsx scripts/faces-recognize.ts --rerun
 *   npx tsx scripts/faces-recognize.ts --threshold=0.55
 *   npx tsx scripts/faces-recognize.ts --untagged-only
 *
 * Or via npm with equals form:
 *   npm run faces:recognize -- --max=20 --rerun
 */
import "dotenv/config";
import {
  DEFAULT_MATCH_THRESHOLD,
  detectFaces,
  loadDescriptors,
  loadPhotos,
  loadRecognitionState,
  matchFaces,
  mergePhotoTags,
  parseArgs,
  saveRecognitionState,
} from "./lib/faces";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Prefer --max / --rerun: npm steals --limit and --force on Windows.
  const limit = args.getNumber(
    "max",
    args.getNumber("limit", Number(process.env.FACES_MAX ?? Infinity)),
  );
  const force =
    args.has("rerun") ||
    args.has("force") ||
    process.env.FACES_RERUN === "1";
  const threshold = args.getNumber(
    "threshold",
    Number(process.env.FACES_THRESHOLD ?? DEFAULT_MATCH_THRESHOLD),
  );
  const untaggedOnly = args.has("untagged-only");

  const descriptors = await loadDescriptors();
  const catalog = descriptors.players;
  const catalogCount = Object.keys(catalog).length;
  if (!catalogCount) {
    console.error(
      "No face descriptors. Tag some photos and run: npm run faces:enroll",
    );
    process.exit(1);
  }
  console.log(
    `Catalog: ${catalogCount} players · threshold=${threshold}${force ? " · force" : ""}`,
  );

  const photos = await loadPhotos();
  const state = await loadRecognitionState();

  let queue = photos;
  if (untaggedOnly) {
    queue = queue.filter((p) => !(p.taggedPlayerSlugs ?? []).length);
  }
  if (!force) {
    queue = queue.filter((p) => !state.processed[p.imageUrl]);
  }
  if (Number.isFinite(limit)) {
    queue = queue.slice(0, limit);
  }

  console.log(`Photos to process: ${queue.length} (of ${photos.length})`);

  let processed = 0;
  let tagged = 0;
  let noFace = 0;
  let noMatch = 0;
  let errors = 0;

  for (const photo of queue) {
    processed += 1;
    const short = photo.imageUrl.slice(-70);
    try {
      const faces = await detectFaces(photo.imageUrl);
      if (!faces.length) {
        noFace += 1;
        state.processed[photo.imageUrl] = {
          at: new Date().toISOString(),
          faces: 0,
          matched: [],
        };
        console.log(`[${processed}/${queue.length}] no face · ${short}`);
        continue;
      }

      const matches = matchFaces(faces, catalog, threshold);
      if (!matches.length) {
        noMatch += 1;
        state.processed[photo.imageUrl] = {
          at: new Date().toISOString(),
          faces: faces.length,
          matched: [],
        };
        console.log(
          `[${processed}/${queue.length}] ${faces.length} face(s), no match · ${short}`,
        );
        continue;
      }

      const slugs = matches.map((m) => m.slug);
      const { added, all } = await mergePhotoTags(photo.imageUrl, slugs);
      if (added.length) tagged += 1;

      state.processed[photo.imageUrl] = {
        at: new Date().toISOString(),
        faces: faces.length,
        matched: matches.map((m) => ({
          slug: m.slug,
          distance: Number(m.distance.toFixed(4)),
        })),
      };

      const detail = matches
        .map((m) => `${m.slug}(${m.distance.toFixed(3)})`)
        .join(", ");
      console.log(
        `[${processed}/${queue.length}] +${added.length} → [${all.join(", ")}] · ${detail} · ${short}`,
      );
    } catch (err) {
      errors += 1;
      console.warn(
        `[${processed}/${queue.length}] ERROR ${short}: ${err instanceof Error ? err.message : err}`,
      );
    }

    // Persist state periodically so crashes don't lose progress
    if (processed % 10 === 0) {
      state.updatedAt = new Date().toISOString();
      await saveRecognitionState(state);
    }
  }

  state.updatedAt = new Date().toISOString();
  await saveRecognitionState(state);

  console.log("\n=== Summary ===");
  console.log(`Processed:  ${processed}`);
  console.log(`Tagged:     ${tagged} (photos with ≥1 new tag)`);
  console.log(`No face:    ${noFace}`);
  console.log(`No match:   ${noMatch}`);
  console.log(`Errors:     ${errors}`);
  console.log(`State:      data/face-recognition-state.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
