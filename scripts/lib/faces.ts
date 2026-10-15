/**
 * Shared face-api helpers for local enroll / recognize scripts.
 * Uses WASM TF.js backend (works on Windows without tfjs-node native builds).
 */
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import type { SeedData, SeedPhoto, SeedPlayer } from "../../src/lib/types";

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const canvas = require("canvas") as typeof import("canvas");
// WASM build avoids @tensorflow/tfjs-node (broken on Windows / Node 22).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js") as typeof import("@vladmandic/face-api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setWasmPaths } = require("@tensorflow/tfjs-backend-wasm") as {
  setWasmPaths: (prefix: string) => void;
};

export const DEFAULT_MATCH_THRESHOLD = 0.55;
export const MAX_IMAGE_EDGE = 1280;

export type FaceDescriptorsFile = {
  updatedAt: string;
  players: Record<
    string,
    {
      name: string;
      descriptor: number[];
      sources: string[];
    }
  >;
};

export type RecognitionStateFile = {
  updatedAt: string;
  processed: Record<
    string,
    {
      at: string;
      faces: number;
      matched: { slug: string; distance: number }[];
      skipped?: boolean;
    }
  >;
};

export type DetectedFace = {
  descriptor: Float32Array;
  score: number;
};

export type PlayerMatch = {
  slug: string;
  name: string;
  distance: number;
};

let modelsReady = false;

export function dataPath(...parts: string[]) {
  return path.join(process.cwd(), "data", ...parts);
}

export function modelsPath() {
  return dataPath("face-models");
}

export async function ensureModelsPresent() {
  const manifest = path.join(
    modelsPath(),
    "ssd_mobilenetv1_model-weights_manifest.json",
  );
  try {
    await fs.access(manifest);
  } catch {
    throw new Error(
      `Missing face models in ${modelsPath()}. Run: npm run faces:models`,
    );
  }
}

export async function initFaceApi() {
  if (modelsReady) return faceapi;

  await ensureModelsPresent();

  faceapi.env.monkeyPatch({
    Canvas: canvas.Canvas,
    Image: canvas.Image,
    ImageData: canvas.ImageData,
  });

  const wasmDir = path.join(
    process.cwd(),
    "node_modules",
    "@tensorflow",
    "tfjs-backend-wasm",
    "dist",
  );
  setWasmPaths(`${wasmDir}${path.sep}`);

  await faceapi.tf.setBackend("wasm");
  await faceapi.tf.ready();

  const modelDir = modelsPath();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);

  modelsReady = true;
  console.log(
    `FaceAPI ready (backend=${faceapi.tf.getBackend()}, models=${modelDir})`,
  );
  return faceapi;
}

function resolveLocalOrRemote(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return path.join(process.cwd(), "public", url);
  return url;
}

/** Load image URL or local public path into a canvas, optionally downscaled. */
export async function loadImageCanvas(
  imageUrl: string,
  maxEdge = MAX_IMAGE_EDGE,
): Promise<import("canvas").Canvas> {
  const src = resolveLocalOrRemote(imageUrl);
  const img = await canvas.loadImage(src);
  let { width, height } = img;
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid image dimensions for ${imageUrl}`);
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const c = canvas.createCanvas(width, height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return c;
}

export async function detectFaces(
  imageUrl: string,
  opts?: { minConfidence?: number; maxResults?: number },
): Promise<DetectedFace[]> {
  await initFaceApi();
  const img = await loadImageCanvas(imageUrl);
  const options = new faceapi.SsdMobilenetv1Options({
    minConfidence: opts?.minConfidence ?? 0.4,
    maxResults: opts?.maxResults ?? 20,
  });
  const results = await faceapi
    .detectAllFaces(img, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results.map((r) => ({
    descriptor: r.descriptor,
    score: r.detection.score,
  }));
}

/** Prefer the largest / highest-scoring single face (for enrollment refs). */
export async function detectBestFace(
  imageUrl: string,
): Promise<DetectedFace | null> {
  const faces = await detectFaces(imageUrl, { maxResults: 5 });
  if (!faces.length) return null;
  return faces.reduce((best, f) => (f.score > best.score ? f : best));
}

export function averageDescriptors(list: Float32Array[]): Float32Array {
  if (!list.length) throw new Error("No descriptors to average");
  const len = list[0]!.length;
  const out = new Float32Array(len);
  for (const d of list) {
    for (let i = 0; i < len; i++) out[i] += d[i]!;
  }
  for (let i = 0; i < len; i++) out[i]! /= list.length;
  return out;
}

export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  return faceapi.euclideanDistance(a, b);
}

export function matchDescriptor(
  descriptor: Float32Array,
  catalog: FaceDescriptorsFile["players"],
  threshold: number,
): PlayerMatch | null {
  let best: PlayerMatch | null = null;
  for (const [slug, entry] of Object.entries(catalog)) {
    const dist = euclideanDistance(
      descriptor,
      new Float32Array(entry.descriptor),
    );
    if (dist > threshold) continue;
    if (!best || dist < best.distance) {
      best = { slug, name: entry.name, distance: dist };
    }
  }
  return best;
}

export function matchFaces(
  faces: DetectedFace[],
  catalog: FaceDescriptorsFile["players"],
  threshold: number,
): PlayerMatch[] {
  const bySlug = new Map<string, PlayerMatch>();
  for (const face of faces) {
    const m = matchDescriptor(face.descriptor, catalog, threshold);
    if (!m) continue;
    const prev = bySlug.get(m.slug);
    if (!prev || m.distance < prev.distance) bySlug.set(m.slug, m);
  }
  return [...bySlug.values()].sort((a, b) => a.distance - b.distance);
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function loadSeedPlayers(): Promise<SeedPlayer[]> {
  const seed = await readJsonFile<SeedData>(dataPath("seed.json"), {
    players: [],
    matches: [],
    championships: [],
    attendances: [],
    goals: [],
  });
  return seed.players ?? [];
}

export async function loadPhotos(): Promise<SeedPhoto[]> {
  const pack = await readJsonFile<{ photos: SeedPhoto[] }>(
    dataPath("ligapro-photos.json"),
    { photos: [] },
  );
  return pack.photos ?? [];
}

export async function savePhotos(photos: SeedPhoto[]) {
  const file = dataPath("ligapro-photos.json");
  const existing = await readJsonFile<Record<string, unknown>>(file, {});
  await writeJsonFile(file, {
    ...existing,
    photos,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadDescriptors(): Promise<FaceDescriptorsFile> {
  return readJsonFile<FaceDescriptorsFile>(dataPath("face-descriptors.json"), {
    updatedAt: "",
    players: {},
  });
}

export async function saveDescriptors(data: FaceDescriptorsFile) {
  await writeJsonFile(dataPath("face-descriptors.json"), data);
}

export async function loadRecognitionState(): Promise<RecognitionStateFile> {
  return readJsonFile<RecognitionStateFile>(
    dataPath("face-recognition-state.json"),
    { updatedAt: "", processed: {} },
  );
}

export async function saveRecognitionState(data: RecognitionStateFile) {
  await writeJsonFile(dataPath("face-recognition-state.json"), data);
}

/** Merge player slugs into a photo (never removes existing tags). */
export async function mergePhotoTags(
  imageUrl: string,
  newSlugs: string[],
): Promise<{ added: string[]; all: string[] }> {
  const uniqueNew = [...new Set(newSlugs.filter(Boolean))];
  if (!uniqueNew.length) {
    return { added: [], all: [] };
  }

  if (process.env.DATABASE_URL) {
    const db = drizzle(neon(process.env.DATABASE_URL), { schema });
    const [photo] = await db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.imageUrl, imageUrl));
    if (!photo) {
      // Fall through to JSON so local scrapes still get tagged.
    } else {
      const players = await db.select().from(schema.players);
      const bySlug = new Map(players.map((p) => [p.slug, p]));
      const existing = await db
        .select()
        .from(schema.photoTags)
        .where(eq(schema.photoTags.photoId, photo.id));
      const existingIds = new Set(existing.map((t) => t.playerId));
      const existingSlugs = players
        .filter((p) => existingIds.has(p.id))
        .map((p) => p.slug);
      const added: string[] = [];
      for (const slug of uniqueNew) {
        const player = bySlug.get(slug);
        if (!player) continue;
        if (existingIds.has(player.id)) continue;
        await db
          .insert(schema.photoTags)
          .values({ photoId: photo.id, playerId: player.id });
        added.push(slug);
        existingIds.add(player.id);
      }
      const all = [...new Set([...existingSlugs, ...added])];
      // Keep JSON in sync when present
      await mergePhotoTagsJson(imageUrl, uniqueNew);
      return { added, all };
    }
  }

  return mergePhotoTagsJson(imageUrl, uniqueNew);
}

async function mergePhotoTagsJson(
  imageUrl: string,
  newSlugs: string[],
): Promise<{ added: string[]; all: string[] }> {
  const photos = await loadPhotos();
  const photo = photos.find((p) => p.imageUrl === imageUrl);
  if (!photo) {
    return { added: [], all: [] };
  }
  const current = new Set(photo.taggedPlayerSlugs ?? []);
  const added: string[] = [];
  for (const slug of newSlugs) {
    if (current.has(slug)) continue;
    current.add(slug);
    added.push(slug);
  }
  photo.taggedPlayerSlugs = [...current];
  await savePhotos(photos);
  return { added, all: [...current] };
}

export function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const body = a.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      values.set(body.slice(0, eq), body.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      values.set(body, next);
      i += 1;
    } else {
      flags.add(body);
    }
  }
  return {
    has: (k: string) => flags.has(k),
    get: (k: string, fallback?: string) => values.get(k) ?? fallback,
    getNumber: (k: string, fallback: number) => {
      const raw = values.get(k);
      if (raw == null || raw === "") return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    },
  };
}
