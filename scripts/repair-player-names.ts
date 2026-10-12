/**
 * One-off repair: map old attendance/goal names to current player names
 * after admin renames that didn't propagate.
 */
import { readFileSync, writeFileSync } from "node:fs";

const RENAMES: Record<string, string> = {
  "Panchein Tauber": "Pancho",
  "Tonga G": "Tonga",
  "Pita #25": "Pita",
  "J R": "Jota",
  "Gordo Azadian": "Gordo",
};

const seed = JSON.parse(readFileSync("data/seed.json", "utf8"));

for (const [oldName, newName] of Object.entries(RENAMES)) {
  const player = seed.players.find(
    (p: { name: string }) => p.name === newName,
  );
  if (player) {
    player.aliases = [
      ...new Set([...(player.aliases ?? []), oldName, oldName.toLowerCase()]),
    ];
  }
  for (const a of seed.attendances) {
    if (a.player === oldName) a.player = newName;
  }
  for (const g of seed.goals) {
    if (g.player === oldName) g.player = newName;
  }
}

// Drop accidental numeric "goals" from Excel summary tables
const before = seed.goals.length;
seed.goals = seed.goals.filter((g: { player: string | null; isOwnGoal: boolean }) => {
  if (g.isOwnGoal) return true;
  if (!g.player) return false;
  if (/^\d+$/.test(g.player)) return false;
  return true;
});

writeFileSync("data/seed.json", JSON.stringify(seed, null, 2));
console.log(
  `Repaired renames. Goals ${before} → ${seed.goals.length}.`,
);
