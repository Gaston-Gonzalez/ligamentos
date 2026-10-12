/**
 * Scrapes ligapro.uy for Ligamentos Cruzeiro match photos via public API.
 * Reviews ALL championship galleries (Serie 4 + related), lists every game,
 * then imports ONLY Ligamentos albums.
 *
 * Run: npm run scrape:ligapro
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SeedData, SeedPhoto } from "../src/lib/types";

const BASE = "https://www.ligapro.uy";
const TEAM = /ligamentos\s*cruzeiro/i;
const DELAY_MS = 250;

type GalleryListItem = { id: number; name: string; photos: number };
type GameRef = { id: number; name: string; img?: string };
type GroupWeek = { name: string; games: GameRef[] };
type GalleryDetail = {
  tournament: string;
  groupweeks: GroupWeek[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "LigamentosCruzeiroBot/1.0 (+https://github.com/Gaston-Gonzalez/ligamentos)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const RIVAL_ALIASES: Record<string, string> = {
  noj: "nos obligan a jugar",
  "nos obligan a jugar": "nos obligan a jugar",
  ort: "universidad ort uruguay",
  "universidad ort uruguay": "universidad ort uruguay",
  intrepidos: "intrepidos",
  "naranja mecanica": "naranja mecanica",
  "la naranja mecanica futbol club": "naranja mecanica",
  "foca juniors": "foca jrs",
  "foca jrs": "foca jrs",
  "san diego": "san diego",
  canaima: "canaima city",
  "canaima city": "canaima city",
  "santa cruz de montevideo": "santa cruz",
  "parador tajes": "tajes",
};

function normalizeRival(name: string): string {
  const base = name
    .replace(/\s+F\.?C\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return RIVAL_ALIASES[base] ?? base;
}

function parseGameName(name: string): {
  home: string;
  away: string;
  goalsHome: number | null;
  goalsAway: number | null;
} {
  const cleaned = name
    .replace(/\s+(Mathias|Gerardo|Aparicio).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = cleaned.match(/^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)$/);
  if (!m) {
    return { home: cleaned, away: "", goalsHome: null, goalsAway: null };
  }
  return {
    home: m[1].trim(),
    away: m[4].trim(),
    goalsHome: Number(m[2]),
    goalsAway: Number(m[3]),
  };
}

function rivalFromGame(home: string, away: string): string {
  if (TEAM.test(home)) return away;
  if (TEAM.test(away)) return home;
  return away || home;
}

function goalsForTeam(
  home: string,
  away: string,
  goalsHome: number | null,
  goalsAway: number | null,
): { goalsFor: number | null; goalsAgainst: number | null } {
  if (goalsHome == null || goalsAway == null) {
    return { goalsFor: null, goalsAgainst: null };
  }
  if (TEAM.test(home)) return { goalsFor: goalsHome, goalsAgainst: goalsAway };
  if (TEAM.test(away)) return { goalsFor: goalsAway, goalsAgainst: goalsHome };
  return { goalsFor: null, goalsAgainst: null };
}

function isRelevantGallery(name: string): boolean {
  // Serie 4 always; also Copa/Verano/Intermedio/Final that mention Serie 4
  if (/serie\s*4/i.test(name)) return true;
  return false;
}

function championshipSlugFromTournament(
  seed: SeedData,
  tournament: string,
): string | null {
  const t = tournament.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const scored = seed.championships.map((c) => {
    const n = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let score = 0;
    if (t.includes("clausura") && n.includes("clausura")) score += 2;
    if (t.includes("apertura") && n.includes("apertura")) score += 2;
    if ((t.includes("verano") || t.includes("super copa")) && n.includes("verano"))
      score += 2;
    if (t.includes("copa del rey") && n.includes("copa del rey")) score += 3;
    if (t.includes("intermedio") && (n.includes("intermedio") || n.includes("intemedio")))
      score += 2;
    if (t.includes("final") && n.includes("final")) score += 2;
    // Year: prefer exact season labels in seed ("Clausura 24", "Clausura 25", bare "Clausura" = 2026)
    if (t.includes("2024")) {
      if (n.includes("24")) score += 4;
      else if (/\b25\b|\b26\b/.test(n) || n === "clausura" || n === "apertura" || n === "intermedio")
        score -= 3;
    } else if (t.includes("2025")) {
      if (n.includes("25")) score += 4;
      else if (n.includes("24") || n.includes("26") || n === "clausura" || n === "apertura")
        score -= 3;
    } else if (t.includes("2026")) {
      if (n.includes("26")) score += 4;
      else if (n === "clausura" || n === "apertura" || n === "intermedio" || n === "intemedio")
        score += 3;
      else if (n.includes("24") || n.includes("25")) score -= 3;
    }
    return { slug: c.slug, score, name: c.name };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].slug : null;
}

function matchSeedMatch(
  seed: SeedData,
  rival: string,
  goalsFor: number | null,
  goalsAgainst: number | null,
  opts?: {
    championshipSlug?: string | null;
    claimed?: Set<number>;
  },
): number | null {
  const nr = normalizeRival(rival);
  if (!nr) return null;

  let candidates = seed.matches.filter((m) => {
    const mr = normalizeRival(m.rival);
    return mr.includes(nr) || nr.includes(mr) || tokenOverlap(mr, nr);
  });

  if (candidates.length === 0) {
    const token = nr.split(" ")[0];
    if (token.length >= 4) {
      candidates = seed.matches.filter((m) =>
        normalizeRival(m.rival).includes(token),
      );
    }
  }

  if (opts?.championshipSlug) {
    const champ = seed.championships.find(
      (c) => c.slug === opts.championshipSlug,
    );
    if (champ) {
      const inChamp = candidates.filter((m) => m.championship === champ.name);
      if (inChamp.length > 0) candidates = inChamp;
    }
  }

  const unclaimed = opts?.claimed
    ? candidates.filter((m) => !opts.claimed!.has(m.index))
    : candidates;
  const pool = unclaimed.length > 0 ? unclaimed : candidates;
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0].index;

  if (goalsFor != null && goalsAgainst != null) {
    const exact = pool.filter(
      (m) => m.goalsFor === goalsFor && m.goalsAgainst === goalsAgainst,
    );
    if (exact.length === 1) return exact[0].index;
    if (exact.length > 1) {
      // Oldest first so newer scrapes keep newer matches when claimed.
      return [...exact].sort((a, b) =>
        (a.date ?? "").localeCompare(b.date ?? ""),
      )[0].index;
    }
    // Soft: same rival/torneo, score off by 1 (Liga Pro typos e.g. 12-1 vs 1-13)
    const soft = pool.filter(
      (m) =>
        Math.abs(m.goalsFor - goalsFor) +
          Math.abs(m.goalsAgainst - goalsAgainst) ===
        1,
    );
    if (soft.length === 1) return soft[0].index;
  }

  // Last resort: single remaining rival in this tournament
  if (pool.length === 1) return pool[0].index;
  return null;
}

function tokenOverlap(a: string, b: string): boolean {
  const ta = new Set(a.split(" ").filter((t) => t.length > 3));
  const tb = b.split(" ").filter((t) => t.length > 3);
  return tb.some((t) => ta.has(t));
}

async function listAllGalleries(): Promise<GalleryListItem[]> {
  const out: GalleryListItem[] = [];
  let page = 1;
  let last = 1;
  do {
    const json = await fetchJson<{
      data: GalleryListItem[];
      last_page: number;
    }>(
      `${BASE}/api/galleries/paginated?page[number]=${page}&page[size]=50&sort[]=-finishDate&sort[]=name`,
    );
    out.push(...json.data);
    last = json.last_page;
    page += 1;
    await sleep(DELAY_MS);
  } while (page <= last);
  return out;
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const seed = JSON.parse(
    await fs.readFile(path.join(dataDir, "seed.json"), "utf8"),
  ) as SeedData;

  console.log("Listing all Liga Pro galleries via API...");
  const galleries = await listAllGalleries();
  const relevant = galleries.filter((g) => isRelevantGallery(g.name));
  console.log(
    `Total galleries: ${galleries.length}. Serie 4 related: ${relevant.length}`,
  );

  const photos: SeedPhoto[] = [];
  const report: {
    galleryId: number;
    galleryName: string;
    gameId: number;
    gameName: string;
    rival: string;
    matchedIndex: number | null;
    images: number;
  }[] = [];
  const matchUpdates: Record<
    number,
    { ligaproAlbumId: string; ligaproAlbumUrl: string; jornada?: number | null }
  > = {};
  const claimedMatchIndexes = new Set<number>();

  // Oldest galleries first so early seasons claim their matches before newer twins.
  const galleriesOrdered = [...relevant].sort((a, b) => a.id - b.id);

  for (const g of galleriesOrdered) {
    console.log(`Gallery ${g.id}: ${g.name}`);
    await sleep(DELAY_MS);
    let detail: GalleryDetail;
    try {
      const res = await fetchJson<{ data: GalleryDetail }>(
        `${BASE}/api/galleries/${g.id}`,
      );
      detail = res.data;
    } catch (err) {
      console.warn(`  Failed gallery detail:`, err);
      continue;
    }

    const champSlug = championshipSlugFromTournament(
      seed,
      detail.tournament || g.name,
    );

    let jornada: number | null = null;
    let foundLigamentos = false;
    for (const week of detail.groupweeks ?? []) {
      const jm = week.name?.match(/jornada\s+(\d+)/i);
      jornada = jm ? Number(jm[1]) : jornada;

      for (const game of week.games ?? []) {
        if (!TEAM.test(game.name)) continue;
        foundLigamentos = true;

        console.log(`  Ligamentos game ${game.id}: ${game.name}`);
        await sleep(DELAY_MS);

        const parsed = parseGameName(game.name);
        const rival = rivalFromGame(parsed.home, parsed.away);
        const { goalsFor, goalsAgainst } = goalsForTeam(
          parsed.home,
          parsed.away,
          parsed.goalsHome,
          parsed.goalsAway,
        );
        const matchIndex = matchSeedMatch(
          seed,
          rival,
          goalsFor,
          goalsAgainst,
          {
            championshipSlug: champSlug,
            claimed: claimedMatchIndexes,
          },
        );
        if (matchIndex != null) claimedMatchIndexes.add(matchIndex);

        let imageUrls: string[] = [];
        try {
          const gallery = await fetchJson<{
            data: { img: string; user?: string }[];
          }>(`${BASE}/api/games/${game.id}/gallery`);
          imageUrls = (gallery.data ?? [])
            .map((x) => x.img)
            .filter(Boolean)
            .map((img) =>
              img.startsWith("http")
                ? img
                : `https://r2.ligapro.uy/${img.replace(/^\/+/, "")}`,
            );
        } catch (err) {
          console.warn(`    Failed photos for game ${game.id}:`, err);
        }

        imageUrls.forEach((imageUrl, i) => {
          photos.push({
            imageUrl,
            sourcePageUrl: `${BASE}/galeria/album/${game.id}`,
            championshipSlug: champSlug,
            matchIndex,
            caption: game.name,
            taggedPlayerSlugs: [],
            sortOrder: i,
          });
        });

        if (matchIndex != null) {
          matchUpdates[matchIndex] = {
            ligaproAlbumId: String(game.id),
            ligaproAlbumUrl: `${BASE}/galeria/album/${game.id}`,
            jornada,
          };
        }

        report.push({
          galleryId: g.id,
          galleryName: g.name,
          gameId: game.id,
          gameName: game.name,
          rival,
          matchedIndex: matchIndex,
          images: imageUrls.length,
        });
      }
    }

    // Solo asociar campeonato a galerías donde jugó Ligamentos
    // (evita que Divisional A pise Divisional B).
    if (foundLigamentos && champSlug) {
      const champ = seed.championships.find((c) => c.slug === champSlug);
      if (champ) {
        champ.ligaproGalleryUrl = `${BASE}/galeria/${g.id}`;
        champ.ligaproUrl = `${BASE}/campeonatos/${g.id}`;
      }
    }
  }

  for (const m of seed.matches) {
    const upd = matchUpdates[m.index];
    if (!upd) {
      // Drop stale album links so wrong-season URLs don't linger.
      m.ligaproAlbumId = null;
      m.ligaproAlbumUrl = null;
      continue;
    }
    m.ligaproAlbumId = upd.ligaproAlbumId;
    m.ligaproAlbumUrl = upd.ligaproAlbumUrl;
    if (upd.jornada != null) m.jornada = upd.jornada;
  }

  // Dedupe photos
  const unique = new Map<string, SeedPhoto>();
  for (const p of photos) unique.set(p.imageUrl, p);

  await fs.writeFile(
    path.join(dataDir, "seed.json"),
    JSON.stringify(seed, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(dataDir, "ligapro-photos.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        team: "Ligamentos Cruzeiro",
        albumsScraped: report.length,
        photos: [...unique.values()],
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.writeFile(
    path.join(dataDir, "ligapro-scrape-report.json"),
    JSON.stringify(
      {
        galleriesChecked: relevant.map((g) => ({ id: g.id, name: g.name })),
        report,
      },
      null,
      2,
    ),
    "utf8",
  );

  const matched = report.filter((r) => r.matchedIndex != null).length;
  console.log(
    `Done. ${report.length} Ligamentos games, ${unique.size} photos, ${matched} matched to Excel.`,
  );
  for (const u of report.filter((r) => r.matchedIndex == null)) {
    console.log(`  Unmatched: ${u.gameId} ${u.gameName} (rival=${u.rival})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
