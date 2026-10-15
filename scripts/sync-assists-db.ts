/**
 * Sync assistPlayer from seed.json onto Neon goals (no truncate).
 * Run: npx tsx scripts/sync-assists-db.ts
 */
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { SeedData } from "../src/lib/types";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

  const seed = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "seed.json"), "utf8"),
  ) as SeedData;

  const db = drizzle(neon(process.env.DATABASE_URL), { schema });
  const [playerRows, matchRows, goalRows] = await Promise.all([
    db.select().from(schema.players),
    db.select().from(schema.matches),
    db.select().from(schema.goals),
  ]);

  const playerByName = new Map(playerRows.map((p) => [p.name, p]));
  const matchByIndex = new Map(
    matchRows
      .filter((m) => m.matchIndex != null)
      .map((m) => [m.matchIndex!, m]),
  );

  const dbGoalsByMatch = new Map<number, typeof goalRows>();
  for (const g of goalRows) {
    const list = dbGoalsByMatch.get(g.matchId) ?? [];
    list.push(g);
    dbGoalsByMatch.set(g.matchId, list);
  }

  let withAssist = 0;
  let missing = 0;
  const used = new Set<number>();

  for (const sg of seed.goals) {
    const match = matchByIndex.get(sg.matchIndex);
    if (!match) {
      missing += 1;
      continue;
    }
    const list = (dbGoalsByMatch.get(match.id) ?? []).filter(
      (g) => !used.has(g.id),
    );
    const hit = sg.isOwnGoal
      ? list.find((g) => g.isOwnGoal)
      : list.find((g) => {
          const scorer = sg.player ? playerByName.get(sg.player) : null;
          return !g.isOwnGoal && g.playerId === (scorer?.id ?? null);
        });
    if (!hit) {
      missing += 1;
      continue;
    }
    used.add(hit.id);
    const assistId = sg.assistPlayer
      ? (playerByName.get(sg.assistPlayer)?.id ?? null)
      : null;
    await db
      .update(schema.goals)
      .set({ assistPlayerId: assistId })
      .where(eq(schema.goals.id, hit.id));
    if (assistId) withAssist += 1;
  }

  console.log(
    `Synced assists: ${withAssist} with assist, ${missing} unmatched, seed=${seed.goals.length}, db=${goalRows.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
