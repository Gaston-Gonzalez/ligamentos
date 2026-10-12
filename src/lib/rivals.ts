import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

export type RivalCrestMap = Record<string, string>;

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

const ALIASES: Record<string, string> = {
  "naranja mecanica": "naranja mecanica",
  "la naranja mecanica futbol club": "naranja mecanica",
  intrepidos: "intrepidos",
  "inter mitente": "inter mitente",
  intermitente: "inter mitente",
  "foca jrs": "foca jrs",
  "foca juniors": "foca jrs",
  "canaima city": "canaima city",
  canaima: "canaima city",
  "san diego fc": "san diego",
  "san diego": "san diego",
  ort: "universidad ort uruguay",
  "universidad ort uruguay": "universidad ort uruguay",
  noj: "nos obligan a jugar",
  "nos obligan a jugar": "nos obligan a jugar",
  "c a ankara": "ankara",
  "ca ankara": "ankara",
  ankara: "ankara",
};

export function rivalCrestKey(name: string): string {
  const base = normalizeRivalKey(name);
  return ALIASES[base] ?? base;
}

export const loadRivalCrests = cache(async (): Promise<RivalCrestMap> => {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "data", "rival-crests.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as {
      crests?: RivalCrestMap;
    } & RivalCrestMap;
    return parsed.crests ?? parsed;
  } catch {
    return {};
  }
});

export function resolveCrestUrl(
  rivalName: string,
  crests: RivalCrestMap,
): string | null {
  const key = rivalCrestKey(rivalName);
  if (crests[key]) return crests[key];
  for (const [k, url] of Object.entries(crests)) {
    if (k.length < 3) continue;
    if (k.includes(key) || key.includes(k)) return url;
  }
  return null;
}

export async function getRivalCrestUrl(
  rivalName: string,
): Promise<string | null> {
  return resolveCrestUrl(rivalName, await loadRivalCrests());
}
