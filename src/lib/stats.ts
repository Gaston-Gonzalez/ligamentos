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
  const assistsByPlayer = new Map<string, number>();
  for (const g of data.goals) {
    if (!relevantIndexes.has(g.matchIndex)) continue;
    if (g.player && !g.isOwnGoal) {
      const resolved = findPlayer(data, g.player);
      const key = resolved?.name ?? g.player;
      goalsByPlayer.set(key, (goalsByPlayer.get(key) ?? 0) + 1);
    }
    if (g.assistPlayer) {
      const resolved = findPlayer(data, g.assistPlayer);
      const key = resolved?.name ?? g.assistPlayer;
      assistsByPlayer.set(key, (assistsByPlayer.get(key) ?? 0) + 1);
    }
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
      assists: assistsByPlayer.get(player.name) ?? 0,
      longestStreak: longestPresenceStreak(streakStatuses),
    };
  });
}

function relevantMatchIndexes(
  data: SeedData,
  championshipSlug?: string,
): Set<number> {
  const championshipName = championshipSlug
    ? data.championships.find((c) => c.slug === championshipSlug)?.name
    : undefined;
  return new Set(
    (championshipName
      ? data.matches.filter((m) => m.championship === championshipName)
      : data.matches
    ).map((m) => m.index),
  );
}

export function topScorers(
  data: SeedData,
  championshipSlug?: string,
  limit = 15,
): { player: SeedPlayer; goals: number }[] {
  const indexes = relevantMatchIndexes(data, championshipSlug);

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

export function topAssists(
  data: SeedData,
  championshipSlug?: string,
  limit = 15,
): { player: SeedPlayer; assists: number }[] {
  const indexes = relevantMatchIndexes(data, championshipSlug);

  const counts = new Map<string, number>();
  for (const g of data.goals) {
    if (!indexes.has(g.matchIndex) || !g.assistPlayer) continue;
    const resolved = findPlayer(data, g.assistPlayer);
    const key = resolved?.name ?? g.assistPlayer;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, assists]) => ({
      player: findPlayer(data, name) ?? data.players.find((p) => p.name === name)!,
      assists,
    }))
    .filter((x) => x.player)
    .sort((a, b) => b.assists - a.assists)
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

export type GoalConnection = {
  scorer: SeedPlayer;
  assister: SeedPlayer;
  goals: number;
};

/** Parejas goleador + asistente, en un solo sentido. */
export function topConnections(
  data: SeedData,
  limit = 12,
): GoalConnection[] {
  const counts = new Map<
    string,
    { scorer: SeedPlayer; assister: SeedPlayer; goals: number }
  >();

  for (const g of data.goals) {
    if (g.isOwnGoal || !g.player || !g.assistPlayer) continue;
    const scorer = findPlayer(data, g.player);
    const assister = findPlayer(data, g.assistPlayer);
    if (!scorer || !assister || scorer.slug === assister.slug) continue;
    const key = `${scorer.slug}|${assister.slug}`;
    const existing = counts.get(key);
    if (existing) existing.goals += 1;
    else counts.set(key, { scorer, assister, goals: 1 });
  }

  return [...counts.values()]
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        a.scorer.name.localeCompare(b.scorer.name) ||
        a.assister.name.localeCompare(b.assister.name),
    )
    .slice(0, limit);
}

export type DuoConnection = {
  playerA: SeedPlayer;
  playerB: SeedPlayer;
  /** Goles en los que uno asistió al otro, en cualquier dirección. */
  goals: number;
  goalsA: number;
  assistsA: number;
  goalsB: number;
  assistsB: number;
};

/** Parejas sin dirección: suma los goles en que cualquiera asistió al otro. */
export function duoConnections(data: SeedData, limit = 12): DuoConnection[] {
  const counts = new Map<string, DuoConnection>();

  for (const g of data.goals) {
    if (g.isOwnGoal || !g.player || !g.assistPlayer) continue;
    const scorer = findPlayer(data, g.player);
    const assister = findPlayer(data, g.assistPlayer);
    if (!scorer || !assister || scorer.slug === assister.slug) continue;

    const [playerA, playerB] = [scorer, assister].sort((a, b) =>
      a.slug.localeCompare(b.slug),
    );
    const key = `${playerA.slug}|${playerB.slug}`;
    const row = counts.get(key) ?? {
      playerA,
      playerB,
      goals: 0,
      goalsA: 0,
      assistsA: 0,
      goalsB: 0,
      assistsB: 0,
    };
    row.goals += 1;
    if (scorer.slug === playerA.slug) {
      row.goalsA += 1;
      row.assistsB += 1;
    } else {
      row.goalsB += 1;
      row.assistsA += 1;
    }
    counts.set(key, row);
  }

  return [...counts.values()]
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        a.playerA.name.localeCompare(b.playerA.name) ||
        a.playerB.name.localeCompare(b.playerB.name),
    )
    .slice(0, limit);
}

export type AttendancePoint = {
  matchIndex: number;
  date: string;
  rival: string;
  championship: string;
  present: number;
  injury: number;
  travel: number;
};

/** Presentes, lesiones y viajes por partido, en orden cronológico. */
export function attendanceTimeline(data: SeedData): AttendancePoint[] {
  const byMatch = new Map<
    number,
    { present: number; injury: number; travel: number }
  >();
  for (const a of data.attendances) {
    const bucket = byMatch.get(a.matchIndex) ?? {
      present: 0,
      injury: 0,
      travel: 0,
    };
    if (a.status === "present") bucket.present += 1;
    else if (a.status === "injury") bucket.injury += 1;
    else if (a.status === "travel") bucket.travel += 1;
    byMatch.set(a.matchIndex, bucket);
  }

  return data.matches
    .filter((m): m is SeedMatch & { date: string } => Boolean(m.date))
    .map((m) => ({
      matchIndex: m.index,
      date: m.date,
      rival: m.rival,
      championship: m.championship,
      ...(byMatch.get(m.index) ?? { present: 0, injury: 0, travel: 0 }),
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.matchIndex - b.matchIndex,
    );
}

export type AbsenceLeader = {
  player: SeedPlayer;
  injuries: number;
  travels: number;
  absent: number;
};

export function absenceBreakdown(data: SeedData): {
  injuries: number;
  travels: number;
  absent: number;
  playersInjured: number;
  playersTraveling: number;
  playersAbsent: number;
  byInjury: AbsenceLeader[];
  byTravel: AbsenceLeader[];
  byAbsent: AbsenceLeader[];
} {
  const map = new Map<string, AbsenceLeader>();
  for (const a of data.attendances) {
    if (a.status !== "injury" && a.status !== "travel" && a.status !== "absent") {
      continue;
    }
    const player = findPlayer(data, a.player);
    if (!player) continue;
    const row = map.get(player.slug) ?? {
      player,
      injuries: 0,
      travels: 0,
      absent: 0,
    };
    if (a.status === "injury") row.injuries += 1;
    else if (a.status === "travel") row.travels += 1;
    else row.absent += 1;
    map.set(player.slug, row);
  }

  const rows = [...map.values()];
  return {
    injuries: rows.reduce((sum, row) => sum + row.injuries, 0),
    travels: rows.reduce((sum, row) => sum + row.travels, 0),
    absent: rows.reduce((sum, row) => sum + row.absent, 0),
    playersInjured: rows.filter((row) => row.injuries > 0).length,
    playersTraveling: rows.filter((row) => row.travels > 0).length,
    playersAbsent: rows.filter((row) => row.absent > 0).length,
    byInjury: rows
      .filter((row) => row.injuries > 0)
      .sort(
        (a, b) =>
          b.injuries - a.injuries ||
          a.player.name.localeCompare(b.player.name),
      ),
    byTravel: rows
      .filter((row) => row.travels > 0)
      .sort(
        (a, b) =>
          b.travels - a.travels ||
          a.player.name.localeCompare(b.player.name),
      ),
    byAbsent: rows
      .filter((row) => row.absent > 0)
      .sort(
        (a, b) =>
          b.absent - a.absent || a.player.name.localeCompare(b.player.name),
      ),
  };
}

export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function recordString(w: number, d: number, l: number): string {
  return `${w}-${d}-${l}`;
}
