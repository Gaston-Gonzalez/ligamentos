/**
 * Local smoke test (no permanent tag writes):
 * find a clear face → build a temp descriptor → match against a small batch.
 *
 * Run: npx tsx scripts/faces-smoke-test.ts
 */
import {
  averageDescriptors,
  DEFAULT_MATCH_THRESHOLD,
  detectBestFace,
  detectFaces,
  initFaceApi,
  loadPhotos,
  loadSeedPlayers,
  matchFaces,
  saveDescriptors,
  type FaceDescriptorsFile,
} from "./lib/faces";

async function main() {
  console.log("=== Face recognition smoke test ===\n");
  await initFaceApi();

  const players = await loadSeedPlayers();
  const photos = await loadPhotos();
  const player = players[0];
  if (!player) throw new Error("No players in seed.json");

  console.log(`Using player: ${player.name} (${player.slug})`);
  console.log(`Gallery size: ${photos.length}`);

  let enrollUrl: string | null = null;
  let enrollScore = 0;
  const scanN = Math.min(40, photos.length);
  console.log(`\nScanning ${scanN} photos for a clear enrollment face...`);

  for (let i = 0; i < scanN; i++) {
    const url = photos[i]!.imageUrl;
    try {
      const face = await detectBestFace(url);
      if (!face) {
        console.log(`  [${i}] no face`);
        continue;
      }
      console.log(`  [${i}] score=${face.score.toFixed(3)} ${url.slice(-55)}`);
      if (face.score >= 0.6 && (!enrollUrl || face.score > enrollScore)) {
        enrollUrl = url;
        enrollScore = face.score;
      }
      if (enrollUrl && enrollScore >= 0.7) break;
    } catch (err) {
      console.log(`  [${i}] ERR ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!enrollUrl) {
    throw new Error("Could not find a photo with a detectable face");
  }
  console.log(
    `\nEnrollment photo: score=${enrollScore.toFixed(3)}\n  ${enrollUrl}`,
  );

  const face = await detectBestFace(enrollUrl);
  if (!face) throw new Error("Lost face on enrollment photo");

  const catalog: FaceDescriptorsFile["players"] = {
    [player.slug]: {
      name: player.name,
      descriptor: Array.from(averageDescriptors([face.descriptor])),
      sources: [enrollUrl],
    },
  };

  await saveDescriptors({
    updatedAt: new Date().toISOString(),
    players: catalog,
  });
  console.log(`\nEnrolled ${player.slug} → data/face-descriptors.json`);

  const batch = photos.slice(0, 15);
  let withFace = 0;
  let matched = 0;
  let selfHit = false;

  console.log(
    `\nMatching ${batch.length} photos (threshold=${DEFAULT_MATCH_THRESHOLD}, no tag writes)...\n`,
  );

  for (let i = 0; i < batch.length; i++) {
    const photo = batch[i]!;
    const faces = await detectFaces(photo.imageUrl);
    if (!faces.length) {
      console.log(`[${i + 1}/${batch.length}] no face`);
      continue;
    }
    withFace += 1;
    const matches = matchFaces(faces, catalog, DEFAULT_MATCH_THRESHOLD);
    if (!matches.length) {
      console.log(
        `[${i + 1}/${batch.length}] ${faces.length} face(s), no match`,
      );
      continue;
    }
    matched += 1;
    if (photo.imageUrl === enrollUrl) selfHit = true;
    const detail = matches
      .map((m) => `${m.slug}(${m.distance.toFixed(3)})`)
      .join(", ");
    console.log(`[${i + 1}/${batch.length}] MATCH ${detail}`);
  }

  console.log("\n=== Smoke test summary ===");
  console.log(`Detect:     OK (enrollment face score ${enrollScore.toFixed(3)})`);
  console.log(`Enroll:     OK (${player.slug})`);
  console.log(`Batch:      ${batch.length} photos`);
  console.log(`With face:  ${withFace}`);
  console.log(`Matched:    ${matched}`);
  console.log(`Self-match: ${selfHit ? "YES" : "NO"}`);
  if (selfHit || matched > 0) {
    console.log("Result:     PASS");
  } else {
    console.log("Result:     FAIL (no matches)");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
