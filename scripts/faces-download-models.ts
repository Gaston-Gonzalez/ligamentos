/**
 * Copy face-api model weights into data/face-models/ (from the installed package).
 * Run: npx tsx scripts/faces-download-models.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const NEEDED = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin",
];

async function main() {
  const srcDir = path.join(
    process.cwd(),
    "node_modules",
    "@vladmandic",
    "face-api",
    "model",
  );
  const destDir = path.join(process.cwd(), "data", "face-models");
  await fs.mkdir(destDir, { recursive: true });

  for (const name of NEEDED) {
    const from = path.join(srcDir, name);
    const to = path.join(destDir, name);
    await fs.copyFile(from, to);
    console.log(`Copied ${name}`);
  }
  console.log(`Models ready at ${destDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
