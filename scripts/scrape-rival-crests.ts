/**
 * Pull rival crests from Liga Pro tournament standings.
 * Run: npx tsx scripts/scrape-rival-crests.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE = "https://www.ligapro.uy";
const DELAY_MS = 200;

type Gallery = { id: number; name: string };
type Position = { name: string; logo?: string | null; slug?: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeRivalKey(name: string): string {
  return name
    .replace(/\s+F\.?C\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "LigamentosCruzeiroBot/1.0",
    },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function main() {
  const list = await fetchJson<{ data: Gallery[] }>(`${BASE}/api/galleries`);
  const galleries = list?.data ?? [];
  // Prefer Serie 4 (and related) but keep all — more crests never hurts
  const ids = [...new Set(galleries.map((g) => g.id))];

  const crests: Record<string, string> = {};
  const meta: Record<string, { name: string; slug?: string }> = {};

  for (const id of ids) {
    await sleep(DELAY_MS);
    const pos = await fetchJson<{
      data: { name: string; positions: Position[] }[];
    }>(`${BASE}/api/tournaments/${id}/positions`);
    if (!pos?.data) continue;

    for (const group of pos.data) {
      for (const p of group.positions ?? []) {
        if (!p.logo || !p.name) continue;
        const key = normalizeRivalKey(p.name);
        if (!key || /ligamentos/.test(key)) continue;
        if (!crests[key]) {
          crests[key] = p.logo;
          meta[key] = { name: p.name.trim(), slug: p.slug };
        }
        // Also store shortened tokens (e.g. "c a ankara" → also try last word)
        const parts = key.split(" ").filter(Boolean);
        if (parts.length > 1) {
          const short = parts[parts.length - 1];
          if (short.length >= 4 && !crests[short]) {
            crests[short] = p.logo;
          }
        }
      }
    }
    process.stdout.write(".");
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "ligapro.uy /api/tournaments/*/positions",
    count: Object.keys(crests).length,
    crests,
    meta,
  };

  const outPath = path.join(process.cwd(), "data", "rival-crests.json");
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nWrote ${outPath} (${out.count} crests)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
