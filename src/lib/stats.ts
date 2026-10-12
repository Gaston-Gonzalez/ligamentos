import { findPlayer } from "./players";
import type {
  AttendanceStatus,
  PlayerStats,
  SeedAttendance,
  SeedData,
  SeedGoal,
  SeedMatch,
  SeedPlayer,
  TeamRecord,
} from "./types";

function playerKeys(player: SeedPlayer): Set<string> {
  return new Set(
    [player.name, player.slug, ...(player.aliases ?? [])]
      .filter(Boolean)
      .map((s) => s.toLowerCase()),
  );
}

function refersToPlayer(player: SeedPlayer, value: string | null | undefined) {
  if (!value) return false;
  return playerKeys(player).has(value.toLowerCase());
}

export function statusLabel(status: string): string {
  switch (status) {
    case "present":
      return "Presente";
    case "absent":
      return "Ausente";
    case "injury":
      return "Lesión";
    case "travel":
      return "Viaje";
    case "not_registered":
      return "No fichado";
    default:
      return status;
  }
}

export function resultLabel(result: string | null | undefined): string {
  if (result === "W") return "Victoria";
  if (result === "D") return "Empate";
  if (result === "L") return "Derrota";
  return "—";
}

export function teamRecord(matches: SeedMatch[]): TeamRecord {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const m of matches) {
    goalsFor += m.goalsFor;
    goalsAgainst += m.goalsAgainst;
    if (m.result === "W") wins += 1;
    else if (m.result === "D") draws += 1;
    else if (m.result === "L") losses += 1;
  }
  return {
    played: matches.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    points: wins * 3 + draws,
  };
}

export function longestPresenceStreak(
  statuses: AttendanceStatus[],
): number {
  let best = 0;
  let cur = 0;
  for (const s of statuses) {
    if (s === "present") {
      cur += 1;
      best = Math.max(best, cur);
    } else if (s === "not_registered") {
      // skip — not eligible, don't break streak? Excel typically only counts eligible matches.
      continue;
    } else {
      cur = 0;
    }
  }
  return best;
}

export function computePlayerStats(
  data: SeedData,
  championshipSlug?: string,
): PlayerStats[] {
  const matchByIndex = new Map(data.matches.map((m) => [m.index, m]));
  const championshipName = championshipSlug
    ? data.championships.find((c) => c.slug === championshipSlug)?.name
    : undefined;

  const relevantMatches = championshipName
    ? data.matches.filter((m) => m.championship === championshipName)
    : data.matches;
  const relevantIndexes = new Set(relevantMatches.map((m) => m.index));

  const goalsByPlayer = new Map<string, number>();
  for (const g of data.goals) {
    if (!relevantIndexes.has(g.matchIndex)) continue;
    if (!g.player || g.isOwnGoal) continue;
    const resolved = findPlayer(data, g.player);
    const key = resolved?.name ?? g.player;
    goalsByPlayer.set(key, (goalsByPlayer.get(key) ?? 0) + 1);
  }

  return data.players.map((player) => {
    const rows = data.attendances.filter(
      (a) =>
        refersToPlayer(player, a.player) &&
        relevantIndexes.has(a.matchIndex),
    );

    // Order by match index for streak
    rows.sort((a, b) => a.matchIndex - b.matchIndex);

    let played = 0;
    let eligible = 0;
    let justified = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    const streakStatuses: AttendanceStatus[] = [];

    for (const row of rows) {
      const status = row.status as AttendanceStatus;
      streakStatuses.push(status);
      if (status === "not_registered") continue;
      eligible += 1;
      if (status === "present") {
        played += 1;
        justified += 1;
        const match = matchByIndex.get(row.matchIndex);
        if (match?.result === "W") wins += 1;
        else if (match?.result === "D") draws += 1;
        else if (match?.result === "L") losses += 1;
      } else if (status === "injury" || status === "travel") {
        justified += 1;
      }
    }

    return {
      playerSlug: player.slug,
      playerName: player.name,
      played,
      eligible,
      attendancePct: eligible ? played / eligible : 0,
      justifiedPct: eligible ? justified / eligible : 0,
      wins,
      draws,
      losses,
      winRate: played ? wins / played : 0,
      goals: goalsByPlayer.get(player.name) ?? 0,
      longestStreak: longestPresenceStreak(streakStatuses),
    };
  });
}

export function topScorers(
  data: SeedData,
  championshipSlug?: string,
  limit = 15,
): { player: SeedPlayer; goals: number }[] {
  const championshipName = championshipSlug
    ? data.championships.find((c) => c.slug === championshipSlug)?.name
    : undefined;
  const indexes = new Set(
    (championshipName
      ? data.matches.filter((m) => m.championship === championshipName)
      : data.matches
    ).map((m) => m.index),
  );

  const counts = new Map<string, number>();
  for (const g of data.goals) {
    if (!indexes.has(g.matchIndex) || !g.player || g.isOwnGoal) continue;
    const resolved = findPlayer(data, g.player);
    const key = resolved?.name ?? g.player;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, goals]) => ({
      player: findPlayer(data, name) ?? data.players.find((p) => p.name === name)!,
      goals,
    }))
    .filter((x) => x.player)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit);
}

export function goalsForMatch(
  data: SeedData,
  matchIndex: number,
): SeedGoal[] {
  return data.goals.filter((g) => g.matchIndex === matchIndex);
}

export function attendanceForMatch(
  data: SeedData,
  matchIndex: number,
): SeedAttendance[] {
  return data.attendances
    .filter((a) => a.matchIndex === matchIndex)
    .sort((a, b) => a.player.localeCompare(b.player));
}

export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function recordString(w: number, d: number, l: number): string {
  return `${w}-${d}-${l}`;
}
