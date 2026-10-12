"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { photoTags, photos } from "@/db/schema";
import { resolveDbIds } from "@/lib/data";
import type { SeedPhoto } from "@/lib/types";

async function readPhotos(): Promise<SeedPhoto[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "data", "ligapro-photos.json"),
      "utf8",
    );
    const json = JSON.parse(raw) as { photos: SeedPhoto[] };
    return json.photos ?? [];
  } catch {
    return [];
  }
}

async function writePhotos(list: SeedPhoto[]) {
  const file = path.join(process.cwd(), "data", "ligapro-photos.json");
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    existing = {};
  }
  await fs.writeFile(
    file,
    JSON.stringify(
      { ...existing, photos: list, updatedAt: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );
}

/** Public: anyone can tag players in photos. */
export async function tagPhotoAction(formData: FormData) {
  const imageUrl = String(formData.get("imageUrl") ?? "");
  const tags = formData.getAll("tags").map(String);
  if (!imageUrl) throw new Error("Foto requerida");

  let matchIndex: number | null = null;
  let championshipSlug: string | null = null;

  const ids = await resolveDbIds();
  if (ids) {
    const [photo] = await ids.db
      .select()
      .from(photos)
      .where(eq(photos.imageUrl, imageUrl));
    if (!photo) throw new Error("Foto no encontrada");
    await ids.db.delete(photoTags).where(eq(photoTags.photoId, photo.id));
    for (const tagSlug of tags) {
      const player = ids.playerBySlug.get(tagSlug);
      if (!player) continue;
      await ids.db
        .insert(photoTags)
        .values({ photoId: photo.id, playerId: player.id });
    }
    if (photo.matchId != null) {
      for (const [idx, m] of ids.matchByIndex) {
        if (m.id === photo.matchId) {
          matchIndex = idx;
          break;
        }
      }
    }
  } else {
    const list = await readPhotos();
    const photo = list.find((p) => p.imageUrl === imageUrl);
    if (!photo) throw new Error("Foto no encontrada");
    photo.taggedPlayerSlugs = tags;
    matchIndex = photo.matchIndex ?? null;
    championshipSlug = photo.championshipSlug ?? null;
    await writePhotos(list);
  }

  revalidatePath("/galeria");
  revalidatePath("/admin/fotos");
  if (matchIndex != null) revalidatePath(`/partidos/${matchIndex}`);
  if (championshipSlug) revalidatePath(`/campeonatos/${championshipSlug}`);
  for (const t of tags) revalidatePath(`/jugadores/${t}`);
}
