/**
 * Compare Excel Goles sheet vs Neon (or seed.json).
 * Excel is the source of truth.
 *
 * Run: npx tsx scripts/compare-goals.ts
 * Fix:  npx tsx scripts/compare-goals.ts --fix
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const XLSX_PATH = String.raw`E:\Downloads\Asistencia de Jugadores.xlsx`;
const FIX = process.argv.includes("--fix");

type GoalRow = {
  matchIndex: number;
  player: string | null;
  isOwnGoal: boolean;
};

function cell(sheet: XLSX.WorkSheet, col: number, row: number): unknown {
  const addr = XLSX.utils.encode_cell({ c: col, r: row });
  return sheet[addr]?.v ?? null;
}

function normalizeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseExcelGoals(): {
  goals: GoalRow[];
  matches: { index: number; rival: string; goalsFor: number; goalsAgainst: number }[];
} {
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: false });
  const goles = wb.Sheets["Goles"];
  if (!goles) throw new Error("Missing Goles sheet");

  const goals: GoalRow[] = [];
  const matches: {
    index: number;
    rival: string;
    goalsFor: number;
    goalsAgainst: number;
  }[] = [];

  for (let r = 1; r < 300; r++) {
    const idxRaw = cell(goles, 1, r);
    if (idxRaw == null || idxRaw === "") continue;
    const matchIndex = Number(idxRaw);
    if (!Number.isFinite(matchIndex)) continue;

    const rival = String(cell(goles, 2, r) ?? "").trim();
    const goalsFor = Number(cell(goles, 3, r) ?? 0);
    const goalsAgainst = Number(cell(goles, 4, r) ?? 0);
    matches.push({ index: matchIndex, rival, goalsFor, goalsAgainst });

    // Scorers are only in F–M (cols 5–12). N+ is a season summary table.
    const scorers: GoalRow[] = [];
    for (let c = 5; c <= 12; c++) {
      const scorerRaw = cell(goles, c, r);
      if (scorerRaw == null || scorerRaw === "") break;
      const scorer = String(scorerRaw).trim();
      if (!scorer) break;
      if (/^\d+(\.\d+)?$/.test(scorer)) continue;
      if (scorer.toLowerCase().includes("en contra")) {
        scorers.push({ matchIndex, player: null, isOwnGoal: true });
      } else {
        scorers.push({
          matchIndex,
          player: scorer.replace(/\s+\.$/, "").replace(/\s+/g, " "),
          isOwnGoal: false,
        });
      }
    }

    if (scorers.length !== goalsFor) {
      console.warn(
        `Excel match #${matchIndex} vs ${rival}: goalsFor=${goalsFor} scorers=${scorers.length}`,
      );
    }
    goals.push(...scorers);
  }

  return { goals, matches };
}

/** Canonical player key using Neon name when aliases resolve. */
function canonicalPlayer(
  name: string | null,
  players: { name: string; aliases: string[] | null }[],
): string {
  if (!name) return "";
  const idish = resolvePlayerName(name, players);
  return normalizeKey(idish ?? name);
}

function resolvePlayerName(
  excelName: string,
  players: { name: string; aliases: string[] | null }[],
): string | null {
  const key = normalizeKey(excelName);
  for (const p of players) {
    if (normalizeKey(p.name) === key) return p.name;
    for (const a of p.aliases ?? []) {
      if (normalizeKey(a) === key) return p.name;
    }
  }
  for (const p of players) {
    const pn = normalizeKey(p.name);
    if (key.startsWith(pn + " ") || pn.startsWith(key + " ")) return p.name;
    if (key.includes(pn) && pn.length >= 4) return p.name;
  }
  return null;
}

function goalKey(
  g: GoalRow,
  players: { name: string; aliases: string[] | null }[],
): string {
  if (g.isOwnGoal) return `${g.matchIndex}|OWN`;
  return `${g.matchIndex}|${canonicalPlayer(g.player, players)}`;
}

function countMap(
  goals: GoalRow[],
  players: { name: string; aliases: string[] | null }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of goals) {
    const k = goalKey(g, players);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function playerTotals(
  goals: GoalRow[],
  players: { name: string; aliases: string[] | null }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of goals) {
    if (g.isOwnGoal || !g.player) continue;
    const k = canonicalPlayer(g.player, players);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

async function loadNeonGoals(): Promise<{
  goals: GoalRow[];
  players: { id: number; name: string; aliases: string[] | null }[];
  matches: { id: number; matchIndex: number; rival: string; goalsFor: number }[];
}> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  const matchRows = await db.select().from(schema.matches);
  const playerRows = await db.select().from(schema.players);
  const goalRows = await db.select().from(schema.goals);

  const matchById = new Map(matchRows.map((m) => [m.id, m]));
  const playerById = new Map(playerRows.map((p) => [p.id, p]));

  const goals: GoalRow[] = goalRows.map((g) => {
    const match = matchById.get(g.matchId);
    const player = g.playerId != null ? playerById.get(g.playerId) : null;
    return {
      matchIndex: match?.matchIndex ?? -1,
      player: player?.name ?? null,
      isOwnGoal: g.isOwnGoal,
    };
  });

  return {
    goals,
    players: playerRows.map((p) => ({
      id: p.id,
      name: p.name,
      aliases: (p.aliases as string[] | null) ?? null,
    })),
    matches: matchRows.map((m) => ({
      id: m.id,
      matchIndex: m.matchIndex ?? -1,
      rival: m.rival,
      goalsFor: m.goalsFor,
    })),
  };
}

function resolvePlayerId(
  excelName: string,
  players: { id: number; name: string; aliases: string[] | null }[],
): number | null {
  const key = normalizeKey(excelName);
  for (const p of players) {
    if (normalizeKey(p.name) === key) return p.id;
    for (const a of p.aliases ?? []) {
      if (normalizeKey(a) === key) return p.id;
    }
  }
  // fuzzy: excel "Gordo Azadian" vs neon "Gordo"
  for (const p of players) {
    const pn = normalizeKey(p.name);
    if (key.startsWith(pn + " ") || pn.startsWith(key + " ")) return p.id;
    if (key.includes(pn) && pn.length >= 4) return p.id;
  }
  return null;
}

async function main() {
  console.log("Parsing Excel:", XLSX_PATH);
  const excel = parseExcelGoals();
  console.log(
    `Excel: ${excel.matches.length} matches, ${excel.goals.length} goal rows`,
  );

  console.log("Loading Neon…");
  const neonData = await loadNeonGoals();
  console.log(
    `Neon: ${neonData.matches.length} matches, ${neonData.goals.length} goal rows, ${neonData.players.length} players`,
  );

  const excelCounts = countMap(excel.goals, neonData.players);
  const neonCounts = countMap(neonData.goals, neonData.players);

  const allKeys = new Set([...excelCounts.keys(), ...neonCounts.keys()]);
  const diffs: {
    key: string;
    excel: number;
    neon: number;
    delta: number;
  }[] = [];

  for (const k of allKeys) {
    const e = excelCounts.get(k) ?? 0;
    const n = neonCounts.get(k) ?? 0;
    if (e !== n) diffs.push({ key: k, excel: e, neon: n, delta: n - e });
  }

  diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log("\n=== Diffs por partido|jugador (neon - excel) ===");
  if (diffs.length === 0) {
    console.log("Sin diferencias.");
  } else {
    for (const d of diffs) {
      console.log(
        `${d.key}: excel=${d.excel} neon=${d.neon} (neon tiene ${d.delta > 0 ? "+" : ""}${d.delta})`,
      );
    }
  }

  const excelTot = playerTotals(excel.goals, neonData.players);
  const neonTot = playerTotals(neonData.goals, neonData.players);
  const players = new Set([...excelTot.keys(), ...neonTot.keys()]);
  const playerDiffs: { player: string; excel: number; neon: number }[] = [];
  for (const p of players) {
    const e = excelTot.get(p) ?? 0;
    const n = neonTot.get(p) ?? 0;
    if (e !== n) playerDiffs.push({ player: p, excel: e, neon: n });
  }
  playerDiffs.sort((a, b) => b.neon - b.excel - (a.neon - a.excel));

  console.log("\n=== Totales por jugador ===");
  for (const d of playerDiffs) {
    console.log(
      `${d.player}: excel=${d.excel} neon=${d.neon} (Δ ${d.neon - d.excel})`,
    );
  }

  // Match scoreboard vs scorer count in Neon
  console.log("\n=== Neon: partidos donde goalsFor ≠ #goleadores ===");
  const neonByMatch = new Map<number, number>();
  for (const g of neonData.goals) {
    neonByMatch.set(g.matchIndex, (neonByMatch.get(g.matchIndex) ?? 0) + 1);
  }
  for (const m of neonData.matches) {
    const n = neonByMatch.get(m.matchIndex) ?? 0;
    if (n !== m.goalsFor) {
      console.log(
        `#${m.matchIndex} vs ${m.rival}: goalsFor=${m.goalsFor} scorers=${n}`,
      );
    }
  }

  // Unmatched excel names
  console.log("\n=== Nombres Excel sin match en Neon ===");
  const unresolved = new Set<string>();
  for (const g of excel.goals) {
    if (g.isOwnGoal || !g.player) continue;
    if (resolvePlayerId(g.player, neonData.players) == null) {
      unresolved.add(g.player);
    }
  }
  for (const n of unresolved) console.log(" -", n);

  const outPath = path.join("data", "goals-diff.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        excelGoals: excel.goals.length,
        neonGoals: neonData.goals.length,
        diffs,
        playerDiffs,
        unresolved: [...unresolved],
      },
      null,
      2,
    ),
  );
  console.log("\nWrote", outPath);

  if (!FIX) {
    console.log("\nDry-run only. Re-run with --fix to replace Neon goals from Excel.");
    return;
  }

  console.log("\n=== FIX: replacing Neon goals from Excel ===");
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  const matchByIndex = new Map(
    neonData.matches.map((m) => [m.matchIndex, m]),
  );
  let playerRows = [...neonData.players];

  // Create any Excel scorers missing from Neon (e.g. Rodri).
  const missingNames = new Set<string>();
  for (const g of excel.goals) {
    if (g.isOwnGoal || !g.player) continue;
    if (resolvePlayerId(g.player, playerRows) == null) {
      missingNames.add(g.player);
    }
  }
  for (const name of missingNames) {
    const slug = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const [row] = await db
      .insert(schema.players)
      .values({ name, slug, aliases: [name] })
      .returning();
    console.log(`Created player ${row.name} (#${row.id})`);
    playerRows.push({
      id: row.id,
      name: row.name,
      aliases: (row.aliases as string[] | null) ?? [name],
    });
  }

  // Sync scoreboard from Excel for matches that exist in Neon.
  for (const em of excel.matches) {
    const nm = matchByIndex.get(em.index);
    if (!nm) continue;
    await db
      .update(schema.matches)
      .set({
        goalsFor: em.goalsFor,
        goalsAgainst: em.goalsAgainst,
        result:
          em.goalsFor > em.goalsAgainst
            ? "W"
            : em.goalsFor < em.goalsAgainst
              ? "L"
              : "D",
      })
      .where(eq(schema.matches.id, nm.id));
  }

  await db.delete(schema.goals);

  let inserted = 0;
  let skipped = 0;
  for (const g of excel.goals) {
    const match = matchByIndex.get(g.matchIndex);
    if (!match) {
      skipped += 1;
      continue;
    }
    if (g.isOwnGoal) {
      await db.insert(schema.goals).values({
        matchId: match.id,
        playerId: null,
        isOwnGoal: true,
      });
      inserted += 1;
      continue;
    }
    const playerId = g.player ? resolvePlayerId(g.player, playerRows) : null;
    if (playerId == null) {
      console.warn(`Skip unresolved scorer: match ${g.matchIndex} ${g.player}`);
      skipped += 1;
      continue;
    }
    await db.insert(schema.goals).values({
      matchId: match.id,
      playerId,
      isOwnGoal: false,
    });
    inserted += 1;
  }

  console.log(`Inserted ${inserted} goals, skipped ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
