"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  verifyAdminPassword,
} from "@/lib/auth";
import { resolveDbIds } from "@/lib/data";
import {
  attendances,
  championships,
  goals,
  matches,
  photoTags,
  photos,
  players,
} from "@/db/schema";
import type { SeedData, SeedPhoto } from "@/lib/types";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("No autorizado");
  }
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function readSeed(): Promise<SeedData> {
  const raw = await fs.readFile(
    path.join(process.cwd(), "data", "seed.json"),
    "utf8",
  );
  return JSON.parse(raw) as SeedData;
}

async function writeSeed(data: SeedData) {
  await fs.writeFile(
    path.join(process.cwd(), "data", "seed.json"),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

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
    JSON.stringify({ ...existing, photos: list, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function updatePlayerAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const numberRaw = String(formData.get("number") ?? "");
  const position = String(formData.get("position") ?? "").trim() || null;
  const photoUrl = String(formData.get("photoUrl") ?? "").trim() || null;
  const photoCropRaw = String(formData.get("photoCrop") ?? "").trim();
  let photoCropJson: string | null = null;
  if (photoUrl && photoCropRaw) {
    try {
      const parsed = JSON.parse(photoCropRaw) as {
        x?: number;
        y?: number;
        zoom?: number;
      };
      photoCropJson = JSON.stringify({
        x: Number(parsed.x) || 0,
        y: Number(parsed.y) || 0,
        zoom: Math.min(3, Math.max(1, Number(parsed.zoom) || 1)),
      });
    } catch {
      photoCropJson = JSON.stringify({ x: 0, y: 0, zoom: 1 });
    }
  }
  const aliases = String(formData.get("aliases") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const active = formData.get("active") === "on";

  const ids = await resolveDbIds();
  if (ids) {
    const player = ids.playerBySlug.get(slug);
    if (!player) throw new Error("Jugador no encontrado");
    const nextAliases = [...new Set([...aliases, player.name].filter(Boolean))];
    // En DB asistencia/goles ya apuntan por playerId: alcanza con actualizar el nombre.
    await ids.db
      .update(players)
      .set({
        name,
        number: numberRaw ? Number(numberRaw) : null,
        position,
        photoUrl,
        photoCrop: photoCropJson,
        aliases: nextAliases,
        active,
      })
      .where(eq(players.id, player.id));
  } else {
    const seed = await readSeed();
    const p = seed.players.find((x) => x.slug === slug);
    if (!p) throw new Error("Jugador no encontrado");
    const oldName = p.name;
    if (oldName !== name) {
      // Propagar rename a asistencia y goles (guardan el nombre como string).
      for (const a of seed.attendances) {
        if (a.player === oldName) a.player = name;
      }
      for (const g of seed.goals) {
        if (g.player === oldName) g.player = name;
      }
      p.aliases = [
        ...new Set([...(p.aliases ?? []), ...aliases, oldName].filter(Boolean)),
      ];
    } else {
      p.aliases = [...new Set([...(p.aliases ?? []), ...aliases])];
    }
    p.name = name;
    p.number = numberRaw ? Number(numberRaw) : null;
    p.position = position;
    p.photoUrl = photoUrl;
    p.photoCrop = photoCropJson
      ? (JSON.parse(photoCropJson) as { x: number; y: number; zoom: number })
      : null;
    p.active = active;
    await writeSeed(seed);
  }

  revalidatePath("/", "layout");
}

function matchResult(
  goalsFor: number,
  goalsAgainst: number,
): "W" | "D" | "L" {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

function parseGoalEntries(formData: FormData) {
  const players = formData.getAll("goalPlayer").map(String);
  const owns = formData.getAll("goalOwn").map(String);
  return players
    .map((player, i) => ({
      player: player.trim() || null,
      isOwnGoal: owns[i] === "1" || owns[i] === "on",
    }))
    .filter((e) => e.isOwnGoal || e.player);
}

/** Goles a favor y cantidad de goleadores (incl. en contra) deben coincidir. */
function assertGoalsMatchScorers(
  goalsFor: number,
  entries: ReturnType<typeof parseGoalEntries>,
  redirectTo: string,
) {
  const gf = Number.isFinite(goalsFor) ? Math.max(0, Math.trunc(goalsFor)) : 0;
  if (entries.length === gf) return;
  const sep = redirectTo.includes("?") ? "&" : "?";
  redirect(
    `${redirectTo}${sep}error=goals&gf=${gf}&gs=${entries.length}`,
  );
}

function parseAttendanceEntries(formData: FormData) {
  const players = formData.getAll("attPlayer").map(String);
  const statuses = formData.getAll("attStatus").map(String);
  return players.map((player, i) => ({
    player: player.trim(),
    status: statuses[i] || "not_registered",
  })).filter((e) => e.player);
}

type DbIds = NonNullable<Awaited<ReturnType<typeof resolveDbIds>>>;

async function saveMatchGoals(
  ids: DbIds | null,
  matchIndex: number,
  matchDbId: number | null,
  entries: ReturnType<typeof parseGoalEntries>,
  seed?: SeedData,
) {
  if (ids && matchDbId != null) {
    await ids.db.delete(goals).where(eq(goals.matchId, matchDbId));
    for (const e of entries) {
      if (e.isOwnGoal) {
        await ids.db.insert(goals).values({
          matchId: matchDbId,
          playerId: null,
          isOwnGoal: true,
        });
        continue;
      }
      const player = [...ids.players].find((p) => p.name === e.player);
      if (!player) continue;
      await ids.db.insert(goals).values({
        matchId: matchDbId,
        playerId: player.id,
        isOwnGoal: false,
      });
    }
    return;
  }
  if (!seed) return;
  seed.goals = seed.goals.filter((g) => g.matchIndex !== matchIndex);
  for (const e of entries) {
    seed.goals.push({
      matchIndex,
      player: e.isOwnGoal ? null : e.player,
      isOwnGoal: e.isOwnGoal,
    });
  }
}

async function saveMatchAttendance(
  ids: DbIds | null,
  matchIndex: number,
  matchDbId: number | null,
  entries: ReturnType<typeof parseAttendanceEntries>,
  seed?: SeedData,
) {
  if (ids && matchDbId != null) {
    await ids.db.delete(attendances).where(eq(attendances.matchId, matchDbId));
    for (const e of entries) {
      const player = [...ids.players].find((p) => p.name === e.player);
      if (!player) continue;
      await ids.db.insert(attendances).values({
        matchId: matchDbId,
        playerId: player.id,
        status: e.status,
      });
    }
    return;
  }
  if (!seed) return;
  seed.attendances = seed.attendances.filter((a) => a.matchIndex !== matchIndex);
  for (const e of entries) {
    seed.attendances.push({
      matchIndex,
      player: e.player,
      status: e.status,
    });
  }
}

export async function createMatchAction(formData: FormData) {
  await requireAdmin();
  const rival = String(formData.get("rival") ?? "").trim();
  const championshipName = String(formData.get("championship") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim() || null;
  const pitchRaw = String(formData.get("pitch") ?? "");
  const goalsFor = Number(formData.get("goalsFor") ?? 0);
  const goalsAgainst = Number(formData.get("goalsAgainst") ?? 0);
  const jornadaRaw = String(formData.get("jornada") ?? "");
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim() || null;
  const ligaproAlbumUrl =
    String(formData.get("ligaproAlbumUrl") ?? "").trim() || null;
  const goalEntries = parseGoalEntries(formData);
  const attEntries = parseAttendanceEntries(formData);

  if (!rival) throw new Error("Rival requerido");
  if (!championshipName) throw new Error("Campeonato requerido");
  assertGoalsMatchScorers(goalsFor, goalEntries, "/admin/partidos");

  const result = matchResult(goalsFor, goalsAgainst);
  const pitch = pitchRaw ? Number(pitchRaw) : null;
  const jornada = jornadaRaw ? Number(jornadaRaw) : null;

  const ids = await resolveDbIds();
  let newIndex: number;
  if (ids) {
    const champ = [...ids.championshipBySlug.values()].find(
      (c) => c.name === championshipName,
    );
    if (!champ) throw new Error("Campeonato no encontrado");
    const maxIndex = Math.max(
      0,
      ...[...ids.matchByIndex.keys()].map(Number),
    );
    newIndex = maxIndex + 1;
    const [row] = await ids.db
      .insert(matches)
      .values({
        championshipId: champ.id,
        matchIndex: newIndex,
        rival,
        date,
        pitch,
        goalsFor,
        goalsAgainst,
        result,
        jornada,
        youtubeUrl,
        ligaproAlbumUrl,
      })
      .returning();
    await saveMatchGoals(ids, newIndex, row.id, goalEntries);
    await saveMatchAttendance(ids, newIndex, row.id, attEntries);
  } else {
    const seed = await readSeed();
    if (!seed.championships.some((c) => c.name === championshipName)) {
      throw new Error("Campeonato no encontrado");
    }
    newIndex =
      Math.max(0, ...seed.matches.map((m) => m.index)) + 1;
    seed.matches.push({
      index: newIndex,
      rival,
      championship: championshipName,
      pitch,
      result,
      goalsFor,
      goalsAgainst,
      date,
      jornada,
      youtubeUrl,
      ligaproAlbumUrl,
    });
    await saveMatchGoals(null, newIndex, null, goalEntries, seed);
    await saveMatchAttendance(null, newIndex, null, attEntries, seed);
    await writeSeed(seed);
  }

  revalidatePath("/", "layout");
  redirect(`/admin/partidos?edit=${newIndex}`);
}

export async function updateMatchAction(formData: FormData) {
  await requireAdmin();
  const index = Number(formData.get("index"));
  const rival = String(formData.get("rival") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim() || null;
  const pitchRaw = String(formData.get("pitch") ?? "");
  const goalsFor = Number(formData.get("goalsFor") ?? 0);
  const goalsAgainst = Number(formData.get("goalsAgainst") ?? 0);
  const jornadaRaw = String(formData.get("jornada") ?? "");
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim() || null;
  const ligaproAlbumUrl =
    String(formData.get("ligaproAlbumUrl") ?? "").trim() || null;
  const coverImageUrl =
    String(formData.get("coverImageUrl") ?? "").trim() || null;
  const championshipName = String(formData.get("championship") ?? "").trim();
  const goalEntries = parseGoalEntries(formData);
  const attEntries = parseAttendanceEntries(formData);

  assertGoalsMatchScorers(
    goalsFor,
    goalEntries,
    `/admin/partidos?edit=${index}`,
  );

  const result = matchResult(goalsFor, goalsAgainst);
  const jornada = jornadaRaw ? Number(jornadaRaw) : null;

  const ids = await resolveDbIds();
  if (ids) {
    const match = ids.matchByIndex.get(index);
    if (!match) throw new Error("Partido no encontrado");
    const champ = [...ids.championshipBySlug.values()].find(
      (c) => c.name === championshipName,
    );
    await ids.db
      .update(matches)
      .set({
        rival,
        date,
        pitch: pitchRaw ? Number(pitchRaw) : null,
        goalsFor,
        goalsAgainst,
        result,
        jornada,
        youtubeUrl,
        ligaproAlbumUrl,
        coverImageUrl,
        championshipId: champ?.id ?? match.championshipId,
      })
      .where(eq(matches.id, match.id));
    await saveMatchGoals(ids, index, match.id, goalEntries);
    await saveMatchAttendance(ids, index, match.id, attEntries);
  } else {
    const seed = await readSeed();
    const m = seed.matches.find((x) => x.index === index);
    if (!m) throw new Error("Partido no encontrado");
    m.rival = rival;
    m.date = date;
    m.pitch = pitchRaw ? Number(pitchRaw) : null;
    m.goalsFor = goalsFor;
    m.goalsAgainst = goalsAgainst;
    m.result = result;
    m.jornada = jornada;
    m.youtubeUrl = youtubeUrl;
    m.ligaproAlbumUrl = ligaproAlbumUrl;
    m.coverImageUrl = coverImageUrl;
    m.championship = championshipName;
    await saveMatchGoals(null, index, null, goalEntries, seed);
    await saveMatchAttendance(null, index, null, attEntries, seed);
    await writeSeed(seed);
  }

  revalidatePath("/", "layout");
  revalidatePath("/partidos");
  revalidatePath(`/partidos/${index}`);
  revalidatePath("/admin/partidos");
  revalidatePath("/videos");
}

/** Replace all goal scorers for a match. Form fields: goalPlayer[] (name or ""), goalOwn[] ("1" / "0"). */
export async function updateMatchGoalsAction(formData: FormData) {
  await requireAdmin();
  const index = Number(formData.get("index"));
  const entries = parseGoalEntries(formData);

  const ids = await resolveDbIds();
  if (ids) {
    const match = ids.matchByIndex.get(index);
    if (!match) throw new Error("Partido no encontrado");
    await saveMatchGoals(ids, index, match.id, entries);
  } else {
    const seed = await readSeed();
    await saveMatchGoals(null, index, null, entries, seed);
    await writeSeed(seed);
  }

  revalidatePath("/", "layout");
  revalidatePath(`/partidos/${index}`);
  revalidatePath(`/admin/partidos`);
  redirect(`/admin/partidos?edit=${index}`);
}

export async function updateAttendanceAction(formData: FormData) {
  await requireAdmin();
  const index = Number(formData.get("index"));
  const playerName = String(formData.get("player") ?? "");
  const status = String(formData.get("status") ?? "absent");

  const ids = await resolveDbIds();
  if (ids) {
    const match = ids.matchByIndex.get(index);
    const player = [...ids.players].find((p) => p.name === playerName);
    if (!match || !player) throw new Error("No encontrado");
    const existing = await ids.db
      .select()
      .from(attendances)
      .where(eq(attendances.matchId, match.id));
    const row = existing.find((a) => a.playerId === player.id);
    if (row) {
      await ids.db
        .update(attendances)
        .set({ status })
        .where(eq(attendances.id, row.id));
    } else {
      await ids.db
        .insert(attendances)
        .values({ matchId: match.id, playerId: player.id, status });
    }
  } else {
    const seed = await readSeed();
    const row = seed.attendances.find(
      (a) => a.matchIndex === index && a.player === playerName,
    );
    if (row) row.status = status;
    else seed.attendances.push({ matchIndex: index, player: playerName, status });
    await writeSeed(seed);
  }

  revalidatePath(`/partidos/${index}`);
  revalidatePath("/admin/partidos");
}

export async function addPhotoAction(formData: FormData) {
  await requireAdmin();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const sourcePageUrl =
    String(formData.get("sourcePageUrl") ?? "").trim() || null;
  const matchIndexRaw = String(formData.get("matchIndex") ?? "");
  const championshipSlug =
    String(formData.get("championshipSlug") ?? "").trim() || null;
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const tags = formData.getAll("tags").map(String);

  if (!imageUrl) throw new Error("URL requerida");
  const matchIndex = matchIndexRaw ? Number(matchIndexRaw) : null;

  const ids = await resolveDbIds();
  if (ids) {
    const match =
      matchIndex != null ? ids.matchByIndex.get(matchIndex) : null;
    const champ = championshipSlug
      ? ids.championshipBySlug.get(championshipSlug)
      : null;
    const [photo] = await ids.db
      .insert(photos)
      .values({
        imageUrl,
        sourcePageUrl,
        matchId: match?.id ?? null,
        championshipId: champ?.id ?? match?.championshipId ?? null,
        caption,
      })
      .onConflictDoNothing()
      .returning();
    if (photo) {
      for (const tagSlug of tags) {
        const player = ids.playerBySlug.get(tagSlug);
        if (!player) continue;
        await ids.db
          .insert(photoTags)
          .values({ photoId: photo.id, playerId: player.id })
          .onConflictDoNothing();
      }
    }
  } else {
    const list = await readPhotos();
    const existing = list.find((p) => p.imageUrl === imageUrl);
    if (existing) {
      existing.sourcePageUrl = sourcePageUrl;
      existing.matchIndex = matchIndex;
      existing.championshipSlug = championshipSlug;
      existing.caption = caption;
      existing.taggedPlayerSlugs = tags;
    } else {
      list.push({
        imageUrl,
        sourcePageUrl,
        matchIndex,
        championshipSlug,
        caption,
        taggedPlayerSlugs: tags,
      });
    }
    await writePhotos(list);
  }

  revalidatePath("/galeria");
  revalidatePath("/admin/fotos");
  if (matchIndex) revalidatePath(`/partidos/${matchIndex}`);
  for (const t of tags) revalidatePath(`/jugadores/${t}`);
}

export async function updateChampionshipLinksAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  let ligaproUrl = String(formData.get("ligaproUrl") ?? "").trim() || null;
  const ligaproGalleryUrl =
    String(formData.get("ligaproGalleryUrl") ?? "").trim() || null;

  if (!name) throw new Error("Nombre requerido");

  // Si hay galería y no hay URL de campeonato, derivarla (/galeria/ID → /campeonatos/ID)
  if (ligaproGalleryUrl && !ligaproUrl) {
    ligaproUrl = ligaproGalleryUrl.replace("/galeria/", "/campeonatos/");
  }

  const ids = await resolveDbIds();
  if (ids) {
    const champ = ids.championshipBySlug.get(slug);
    if (!champ) throw new Error("Campeonato no encontrado");
    await ids.db
      .update(championships)
      .set({ name, ligaproUrl, ligaproGalleryUrl })
      .where(eq(championships.id, champ.id));
    // Los partidos en DB apuntan por championshipId: el nombre se resuelve al leer.
  } else {
    const seed = await readSeed();
    const c = seed.championships.find((x) => x.slug === slug);
    if (!c) throw new Error("Campeonato no encontrado");
    const oldName = c.name;
    if (oldName !== name) {
      for (const m of seed.matches) {
        if (m.championship === oldName) m.championship = name;
      }
    }
    c.name = name;
    c.ligaproUrl = ligaproUrl;
    c.ligaproGalleryUrl = ligaproGalleryUrl;
    await writeSeed(seed);
  }

  revalidatePath("/", "layout");
}

export async function deleteChampionshipAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  if (!slug) throw new Error("Slug requerido");

  const ids = await resolveDbIds();
  if (ids) {
    const champ = ids.championshipBySlug.get(slug);
    if (!champ) throw new Error("Campeonato no encontrado");

    const champMatches = ids.matches.filter(
      (m) => m.championshipId === champ.id,
    );
    for (const m of champMatches) {
      await ids.db.delete(attendances).where(eq(attendances.matchId, m.id));
      await ids.db.delete(goals).where(eq(goals.matchId, m.id));
      await ids.db.delete(photos).where(eq(photos.matchId, m.id));
      await ids.db.delete(matches).where(eq(matches.id, m.id));
    }
    await ids.db.delete(photos).where(eq(photos.championshipId, champ.id));
    await ids.db.delete(championships).where(eq(championships.id, champ.id));
  } else {
    const seed = await readSeed();
    const champ = seed.championships.find((c) => c.slug === slug);
    if (!champ) throw new Error("Campeonato no encontrado");

    const removedIndexes = new Set(
      seed.matches
        .filter((m) => m.championship === champ.name)
        .map((m) => m.index),
    );

    seed.matches = seed.matches.filter((m) => m.championship !== champ.name);
    seed.attendances = seed.attendances.filter(
      (a) => !removedIndexes.has(a.matchIndex),
    );
    seed.goals = seed.goals.filter((g) => !removedIndexes.has(g.matchIndex));
    seed.championships = seed.championships.filter((c) => c.slug !== slug);
    await writeSeed(seed);

    // Also drop photos tied to this championship / its matches
    const list = await readPhotos();
    const filtered = list.filter(
      (p) =>
        p.championshipSlug !== slug &&
        (p.matchIndex == null || !removedIndexes.has(p.matchIndex)),
    );
    if (filtered.length !== list.length) {
      await writePhotos(filtered);
    }
  }

  revalidatePath("/", "layout");
}

export async function createPlayerAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nombre requerido");
  const slug = slugify(name);

  const ids = await resolveDbIds();
  if (ids) {
    await ids.db.insert(players).values({ name, slug, aliases: [] });
  } else {
    const seed = await readSeed();
    if (seed.players.some((p) => p.slug === slug)) {
      throw new Error("Ya existe");
    }
    seed.players.push({ name, slug, aliases: [] });
    await writeSeed(seed);
  }
  revalidatePath("/jugadores");
  revalidatePath("/admin/jugadores");
}

