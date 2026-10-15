/**
 * Import assists from goles-asistencias CSV into data/seed.json.
 *
 * Default CSV: E:\Downloads\goles-asistencias1.csv
 * Run: npx tsx scripts/import-assists.ts
 *      npx tsx scripts/import-assists.ts "path\to\file.csv"
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SeedData } from "../src/lib/types";

const DEFAULT_CSV = String.raw`E:\Downloads\goles-asistencias1.csv`;

function findCanonicalName(seed: SeedData, name: string): string | null {
  if (!name || name === "-") return null;
  const lower = name.toLowerCase().trim();
  const special: Record<string, string> = {
    fuchi: "Fuci",
    pons: "Lea Pons",
    "lea pons": "Lea Pons",
    tomy: "Tomy Presi",
    rodri: "RN",
    rn: "RN",
  };
  if (special[lower]) return special[lower];

  const byName = seed.players.find((p) => p.name.toLowerCase() === lower);
  if (byName) return byName.name;
  const byAlias = seed.players.find((p) =>
    (p.aliases ?? []).some((a) => a.toLowerCase() === lower),
  );
  if (byAlias) return byAlias.name;
  const fuzzy = seed.players.find(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      lower.includes(p.name.toLowerCase()),
  );
  return fuzzy?.name ?? name;
}

function normChamp(s: string): string {
  const x = s.toLowerCase().replace(/\s+/g, " ").trim();
  if (x === "intermedio 25") return "copa del rey 25";
  if (x === "apertura") return "apertura 26";
  if (x === "intermedio" || x === "intemedio") return "intermedio 26";
  if (x === "clausura") return "clausura 26";
  return x;
}

function normRival(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/juniors?/, "jrs")
    .replace(/jrs\.?/, "jrs")
    .replace(/inter\s*mitente/, "intermitente");
}

async function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  const dataDir = path.join(process.cwd(), "data");
  const seedPath = path.join(dataDir, "seed.json");
  const seed = JSON.parse(await fs.readFile(seedPath, "utf8")) as SeedData;
  const raw = await fs.readFile(csvPath, "utf8");
  const rows = raw
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [comp, rival, gol, asist] = line.split(",");
      return {
        comp: (comp ?? "").trim(),
        rival: (rival ?? "").trim(),
        gol: (gol ?? "").trim(),
        asist: (asist ?? "").trim(),
      };
    });

  const matches = seed.matches.map((m) => ({
    ...m,
    nChamp: normChamp(m.championship),
    nRival: normRival(m.rival),
  }));

  const used = new Set<number>();
  let matched = 0;
  let withAssist = 0;
  const unmatched: typeof rows = [];

  for (const r of rows) {
    const nc = normChamp(r.comp);
    const nr = normRival(r.rival);
    let ms = matches.filter((m) => m.nChamp === nc && m.nRival === nr);
    if (!ms.length) {
      ms = matches.filter(
        (m) =>
          m.nChamp === nc &&
          (m.nRival.includes(nr) || nr.includes(m.nRival)),
      );
    }
    if (!ms.length) {
      unmatched.push(r);
      continue;
    }

    const isOwn = /en contra/i.test(r.gol);
    const scorerName = isOwn ? null : findCanonicalName(seed, r.gol);
    let foundIdx: number | null = null;

    for (const m of ms) {
      const goals = seed.goals
        .map((g, i) => ({ ...g, i }))
        .filter((g) => g.matchIndex === m.index && !used.has(g.i));
      const hit = isOwn
        ? goals.find((g) => g.isOwnGoal)
        : goals.find(
            (g) =>
              !g.isOwnGoal &&
              g.player &&
              findCanonicalName(seed, g.player) === scorerName,
          );
      if (hit) {
        foundIdx = hit.i;
        break;
      }
    }

    if (foundIdx == null) {
      unmatched.push(r);
      continue;
    }

    used.add(foundIdx);
    const assist = r.asist === "-" ? null : findCanonicalName(seed, r.asist);
    seed.goals[foundIdx].assistPlayer = assist;
    matched += 1;
    if (assist) withAssist += 1;
  }

  for (const g of seed.goals) {
    if (!("assistPlayer" in g)) g.assistPlayer = null;
  }

  if (unmatched.length) {
    console.error("Unmatched rows:", unmatched.length);
    console.error(unmatched.slice(0, 10));
    throw new Error(`Failed to match ${unmatched.length} CSV rows`);
  }

  seed.generatedAt = new Date().toISOString();
  await fs.writeFile(seedPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  console.log(
    `OK: ${matched} goals updated, ${withAssist} with assists → ${seedPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
