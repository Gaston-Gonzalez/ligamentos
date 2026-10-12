/**
 * Parses E:\Downloads\Asistencia de Jugadores.xlsx into data/seed.json
 * Run: npx tsx scripts/parse-excel.ts [path-to-xlsx]
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const DEFAULT_XLSX = String.raw`E:\Downloads\Asistencia de Jugadores.xlsx`;

const PLAYER_ALIASES: Record<string, string> = {
  juani: "Juani",
  "juani .": "Juani",
  fuchi: "Fuci",
  fuci: "Fuci",
  pons: "Lea Pons",
  "lea pons": "Lea Pons",
  gordo: "Gordo Azadian",
  "gordo azadian": "Gordo Azadian",
  tomy: "Tomy Presi",
  "tomy presi": "Tomy Presi",
  tonga: "Tonga G",
  "tonga g": "Tonga G",
  pita: "Pita #25",
  "pita #25": "Pita #25",
  more: "More",
  "more .": "More",
  noj: "Nos Obligan a Jugar",
};

const RIVAL_ALIASES: Record<string, string> = {
  "naranja mecanica": "Naranja mecánica",
  "naranja mecánica": "Naranja mecánica",
  intrepidos: "Intrépidos",
  "intrépidos": "Intrépidos",
  "inter mitente": "Inter Mitente",
  intermitente: "Inter Mitente",
  "foca jrs.": "Foca Jrs.",
  "foca juniors": "Foca Jrs.",
  canaima: "Canaima City",
  "canaima city": "Canaima City",
  "san diego": "San Diego fc",
  "san diego fc": "San Diego fc",
  ort: "ORT",
  "universidad ort uruguay": "ORT",
};

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePlayer(name: string): string {
  const key = name.trim().toLowerCase();
  if (PLAYER_ALIASES[key]) return PLAYER_ALIASES[key];
  return name.trim().replace(/\s+\.$/, "").replace(/\s+/g, " ");
}

function normalizeRival(name: string): string {
  const key = name.trim().toLowerCase();
  if (RIVAL_ALIASES[key]) return RIVAL_ALIASES[key];
  return name.trim();
}

function excelDateToIso(serial: number): string {
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.round(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function cell(sheet: XLSX.WorkSheet, col: number, row: number): unknown {
  const addr = XLSX.utils.encode_cell({ c: col, r: row });
  const c = sheet[addr];
  return c?.v ?? null;
}

function parseAttendanceStatus(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (lower === "si" || lower === "sí") return "present";
  if (lower === "no") return "absent";
  if (lower.startsWith("lesi")) return "injury";
  if (lower === "viaje") return "travel";
  if (lower.includes("fichado")) return "not_registered";
  return s;
}

function main() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX;
  if (!fs.existsSync(xlsxPath)) {
    console.error(`Excel not found: ${xlsxPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: false });
  const attendance = wb.Sheets["Attendance"];
  const goles = wb.Sheets["Goles"];
  if (!attendance || !goles) {
    console.error("Missing Attendance or Goles sheet");
    process.exit(1);
  }

  // Match columns start at H (index 7)
  const matchCols: number[] = [];
  for (let c = 7; c < 90; c++) {
    const rival = cell(attendance, c, 0);
    if (rival == null || rival === "") break;
    matchCols.push(c);
  }

  const championshipNames = new Set<string>();
  const matches = matchCols.map((c, i) => {
    const rivalRaw = String(cell(attendance, c, 0));
    const championship = String(cell(attendance, c, 1) ?? "Sin torneo").trim();
    championshipNames.add(championship);
    const pitchRaw = cell(attendance, c, 2);
    const resultRaw = String(cell(attendance, c, 3) ?? "");
    const dateRaw = cell(attendance, c, 4);
    const attendanceCount = String(cell(attendance, c, 5) ?? "");

    const resultMatch = resultRaw.match(/^([WDL])\s+(\d+)\s*-\s*(\d+)/i);
    let result: "W" | "D" | "L" | null = null;
    let goalsFor = 0;
    let goalsAgainst = 0;
    if (resultMatch) {
      result = resultMatch[1].toUpperCase() as "W" | "D" | "L";
      goalsFor = Number(resultMatch[2]);
      goalsAgainst = Number(resultMatch[3]);
    }

    return {
      index: i + 1,
      col: c,
      rival: normalizeRival(rivalRaw),
      championship,
      pitch: pitchRaw != null && pitchRaw !== "" ? Number(pitchRaw) : null,
      result,
      goalsFor,
      goalsAgainst,
      date:
        typeof dateRaw === "number"
          ? excelDateToIso(dateRaw)
          : dateRaw
            ? String(dateRaw).slice(0, 10)
            : null,
      attendanceLabel: attendanceCount,
    };
  });

  // Players rows 6+ (0-indexed row 6 = Excel row 7)
  const players: {
    name: string;
    slug: string;
    aliases: string[];
  }[] = [];
  const playerRows: { name: string; row: number }[] = [];

  for (let r = 6; r < 50; r++) {
    const nameRaw = cell(attendance, 0, r);
    if (nameRaw == null || nameRaw === "") continue;
    const name = normalizePlayer(String(nameRaw));
    if (["player", "mayor racha"].some((x) => name.toLowerCase().includes(x)))
      continue;
    playerRows.push({ name, row: r });
    const aliases = Object.entries(PLAYER_ALIASES)
      .filter(([, v]) => v === name)
      .map(([k]) => k);
    // also include original excel name if different
    const original = String(nameRaw).trim();
    if (original !== name) aliases.push(original);
    players.push({
      name,
      slug: slugify(name),
      aliases: [...new Set(aliases)],
    });
  }

  // Deduplicate players by normalized name
  const playerMap = new Map<string, (typeof players)[0]>();
  for (const p of players) {
    if (!playerMap.has(p.name)) playerMap.set(p.name, p);
    else {
      const existing = playerMap.get(p.name)!;
      existing.aliases = [...new Set([...existing.aliases, ...p.aliases])];
    }
  }
  const uniquePlayers = [...playerMap.values()];

  const attendances: {
    matchIndex: number;
    player: string;
    status: string;
  }[] = [];

  for (const { name, row } of playerRows) {
    for (const m of matches) {
      const status = parseAttendanceStatus(cell(attendance, m.col, row));
      if (!status) continue;
      attendances.push({ matchIndex: m.index, player: name, status });
    }
  }

  // Goles sheet: row 1+ ; B=fecha/index, C=rival, D=a favor, E=en contra, F+=scorers
  const goals: {
    matchIndex: number;
    player: string | null;
    isOwnGoal: boolean;
  }[] = [];

  for (let r = 1; r < 200; r++) {
    const idxRaw = cell(goles, 1, r); // column B
    if (idxRaw == null || idxRaw === "") continue;
    const matchIndex = Number(idxRaw);
    if (!Number.isFinite(matchIndex)) continue;

    const goalsFor = Number(cell(goles, 3, r) ?? 0);
    // scorers start at column F (index 5)
    for (let c = 5; c < 5 + Math.max(goalsFor, 12); c++) {
      const scorerRaw = cell(goles, c, r);
      if (scorerRaw == null || scorerRaw === "") continue;
      const scorer = String(scorerRaw).trim();
      if (!scorer) continue;
      if (scorer.toLowerCase().includes("en contra")) {
        goals.push({ matchIndex, player: null, isOwnGoal: true });
      } else {
        goals.push({
          matchIndex,
          player: normalizePlayer(scorer),
          isOwnGoal: false,
        });
      }
    }

    // Override goals from Goles sheet if present
    const gf = cell(goles, 3, r);
    const ga = cell(goles, 4, r);
    const pitch = cell(goles, 0, r);
    const rival = cell(goles, 2, r);
    const m = matches.find((x) => x.index === matchIndex);
    if (m) {
      if (gf != null && gf !== "") m.goalsFor = Number(gf);
      if (ga != null && ga !== "") m.goalsAgainst = Number(ga);
      if (pitch != null && pitch !== "") m.pitch = Number(pitch);
      if (rival != null && rival !== "") m.rival = normalizeRival(String(rival));
      // recompute result
      if (m.goalsFor > m.goalsAgainst) m.result = "W";
      else if (m.goalsFor < m.goalsAgainst) m.result = "L";
      else m.result = "D";
    }
  }

  const championships = [...championshipNames].map((name) => ({
    name,
    slug: slugify(name),
  }));

  const seed = {
    generatedAt: new Date().toISOString(),
    source: path.basename(xlsxPath),
    team: "Ligamentos Cruzeiro",
    championships,
    players: uniquePlayers,
    matches: matches.map(({ col: _col, ...rest }) => rest),
    attendances,
    goals,
  };

  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "seed.json");
  fs.writeFileSync(outPath, JSON.stringify(seed, null, 2), "utf8");
  console.log(
    `Wrote ${outPath}: ${uniquePlayers.length} players, ${matches.length} matches, ${attendances.length} attendance rows, ${goals.length} goals, ${championships.length} championships`,
  );
}

main();
