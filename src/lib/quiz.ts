import { findPlayer, resolvePlayerPhoto } from "./players";
import {
  absenceBreakdown,
  attendanceTimeline,
  computePlayerStats,
  duoConnections,
  recordString,
  resultLabel,
  teamRecord,
  topAssists,
  topConnections,
  topScorers,
} from "./stats";
import type { PhotoCrop, SeedData, SeedMatch } from "./types";

export type ChoiceQuestion = {
  id: string;
  category: string;
  prompt: string;
  choices: string[];
  answer: number;
  reveal: string;
};

export type WhoPuzzle = {
  id: string;
  slug: string;
  name: string;
  clues: string[];
  photoUrl: string | null;
  photoCrop: PhotoCrop | null;
};

export type QuizSummary = {
  matches: number;
  players: number;
  record: string;
  goalsFor: number;
  goalsAgainst: number;
};

export type QuizPack = {
  dayKey: string;
  dayLabel: string;
  summary: QuizSummary;
  daily: ChoiceQuestion[];
  streak: ChoiceQuestion[];
  who: WhoPuzzle[];
  roster: { slug: string; name: string }[];
};

const CATEGORY_LABELS: Record<string, string> = {
  goleo: "Goleo",
  asistencias: "Asistencias",
  presencias: "Presencias",
  racha: "Racha",
  lesiones: "Lesiones",
  viajes: "Viajes",
  ausencias: "Ausencias",
  equipo: "Equipo",
  rival: "Rivales",
  marcador: "Marcador",
  actualidad: "Actualidad",
  dupla: "Duplas",
  campeonato: "Campeonato",
  efectividad: "Efectividad",
  cifras: "Cifras",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function quizDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return dayKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/\./g, "");
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(seed: string): () => number {
  return mulberry32(hashString(seed));
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatIsoDate(iso: string | null): string {
  if (!iso) return "sin fecha";
  return formatDayLabel(iso);
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function pairLabel(a: string, b: string): string {
  return [a, b].sort((left, right) => left.localeCompare(right, "es")).join(" y ");
}

function fourChoices(
  correct: string,
  preferred: string[],
  fallback: string[],
  seed: string,
): string[] | null {
  const answer = correct.trim();
  if (!answer) return null;
  const seen = new Set<string>([answer]);
  const pool: string[] = [];
  for (const name of [...preferred, ...fallback]) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    pool.push(trimmed);
  }
  if (pool.length < 3) return null;
  const rng = rngFor(seed);
  const picked = shuffle(pool.slice(0, 8), rng).slice(0, 3);
  if (picked.length < 3) return null;
  return shuffle([answer, ...picked], rng);
}

function numericChoices(correct: number, seed: string, min = 0): string[] | null {
  if (!Number.isFinite(correct)) return null;
  const rng = rngFor(seed);
  const used = new Set<number>([correct]);
  const pool: number[] = [];
  const offsets = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20], rng);
  for (const offset of offsets) {
    for (const sign of shuffle([-1, 1], rng)) {
      const next = correct + sign * offset;
      if (next < min || used.has(next)) continue;
      used.add(next);
      pool.push(next);
      if (pool.length === 3) break;
    }
    if (pool.length === 3) break;
  }
  if (pool.length < 3) return null;
  return shuffle([correct, ...pool], rng).map((value) => String(value));
}

function makeChoice(options: {
  id: string;
  category: string;
  prompt: string;
  correct: string;
  preferred: string[];
  fallback: string[];
  reveal: string;
}): ChoiceQuestion | null {
  const choices = fourChoices(
    options.correct,
    options.preferred,
    options.fallback,
    options.id,
  );
  if (!choices) return null;
  const answer = choices.indexOf(options.correct.trim());
  if (answer < 0) return null;
  return {
    id: options.id,
    category: options.category,
    prompt: options.prompt,
    choices,
    answer,
    reveal: options.reveal,
  };
}

function makeNumeric(options: {
  id: string;
  category: string;
  prompt: string;
  correct: number;
  reveal: string;
  min?: number;
}): ChoiceQuestion | null {
  const choices = numericChoices(options.correct, options.id, options.min ?? 0);
  if (!choices) return null;
  const answer = choices.indexOf(String(options.correct));
  if (answer < 0) return null;
  return {
    id: options.id,
    category: options.category,
    prompt: options.prompt,
    choices,
    answer,
    reveal: options.reveal,
  };
}

type NamedValue = { name: string; value: number };

function ranked(rows: NamedValue[]): NamedValue[] {
  return [...rows]
    .filter((row) => row.value > 0 && row.name.trim())
    .sort(
      (a, b) => b.value - a.value || a.name.localeCompare(b.name, "es"),
    );
}

function secondLine(second: NamedValue | null, unit: string): string {
  if (!second) return "";
  return ` Le sigue ${second.name} con ${second.value}${unit}.`;
}

function recordChoices(
  wins: number,
  draws: number,
  losses: number,
  seed: string,
): string[] | null {
  const played = wins + draws + losses;
  const correct = recordString(wins, draws, losses);
  const candidates: [number, number, number][] = [
    [wins + 1, draws - 1, losses],
    [wins - 1, draws + 1, losses],
    [wins + 1, draws, losses - 1],
    [wins - 1, draws, losses + 1],
    [wins, draws + 1, losses - 1],
    [wins, draws - 1, losses + 1],
    [wins + 2, draws - 1, losses - 1],
    [wins + 2, draws, losses - 2],
    [wins - 2, draws + 1, losses + 1],
    [wins + 3, draws - 1, losses - 2],
    [wins - 1, draws - 1, losses + 2],
    [wins + 1, draws + 1, losses - 2],
  ];
  const preferred = candidates
    .filter(
      ([win, draw, loss]) =>
        win >= 0 &&
        draw >= 0 &&
        loss >= 0 &&
        win + draw + loss === played &&
        !(win === wins && draw === draws && loss === losses),
    )
    .map(([win, draw, loss]) => recordString(win, draw, loss));
  return fourChoices(correct, preferred, [], seed);
}

function lineChoices(goalsFor: number, goalsAgainst: number, seed: string): string[] | null {
  const correct = `${goalsFor}:${goalsAgainst}`;
  const candidates: [number, number][] = [
    [goalsAgainst, goalsFor],
    [goalsFor + 8, goalsAgainst],
    [goalsFor, goalsAgainst + 15],
    [goalsFor - 6, goalsAgainst + 4],
    [goalsFor + 11, goalsAgainst - 7],
    [goalsFor - 9, goalsAgainst],
    [goalsFor + 4, goalsAgainst + 10],
    [goalsFor - 3, goalsAgainst - 12],
    [goalsFor + 15, goalsAgainst + 5],
  ];
  const preferred = candidates
    .filter(
      ([scored, conceded]) =>
        scored >= 0 &&
        conceded >= 0 &&
        !(scored === goalsFor && conceded === goalsAgainst),
    )
    .map(([scored, conceded]) => `${scored}:${conceded}`);
  return fourChoices(correct, preferred, [], seed);
}

function matchScoreChoices(goalsFor: number, goalsAgainst: number, seed: string): string[] | null {
  const correct = `${goalsFor}-${goalsAgainst}`;
  const candidates = [
    `${goalsAgainst}-${goalsFor}`,
    `${goalsFor + 1}-${goalsAgainst}`,
    `${Math.max(0, goalsFor - 1)}-${goalsAgainst}`,
    `${goalsFor}-${goalsAgainst + 1}`,
    `${goalsFor}-${Math.max(0, goalsAgainst - 1)}`,
    `${goalsFor + 2}-${goalsAgainst}`,
    `${Math.max(0, goalsFor - 1)}-${goalsAgainst + 1}`,
    `${goalsFor + 1}-${goalsAgainst + 1}`,
    "1-1",
    "2-1",
    "1-2",
    "0-1",
    "1-0",
    "3-1",
    "0-2",
    "2-0",
    "0-3",
    "4-1",
  ];
  return fourChoices(correct, candidates, [], seed);
}

function datedMatches(data: SeedData): SeedMatch[] {
  return data.matches
    .filter((match): match is SeedMatch & { date: string } => Boolean(match.date))
    .slice()
    .sort(
      (a, b) =>
        (a.date ?? "").localeCompare(b.date ?? "") || a.index - b.index,
    );
}

function rivalNames(data: SeedData): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of data.matches) {
    if (seen.has(match.rival)) continue;
    seen.add(match.rival);
    names.push(match.rival);
  }
  return names;
}

function pushScoreQuestion(
  bank: ChoiceQuestion[],
  match: SeedMatch,
  options: { id: string; category: string; prompt: string },
): void {
  const choices = matchScoreChoices(match.goalsFor, match.goalsAgainst, options.id);
  if (!choices) return;
  const correct = `${match.goalsFor}-${match.goalsAgainst}`;
  const answer = choices.indexOf(correct);
  if (answer < 0) return;
  const place = match.pitch ? ` · cancha ${match.pitch}` : "";
  bank.push({
    id: options.id,
    category: options.category,
    prompt: options.prompt,
    choices,
    answer,
    reveal: `${resultLabel(match.result)} ${correct}${place}. ${match.championship}, ${formatIsoDate(match.date)}.`,
  });
}

function buildBank(data: SeedData): ChoiceQuestion[] {
  const bank: ChoiceQuestion[] = [];
  const seen = new Set<string>();
  const push = (question: ChoiceQuestion | null) => {
    if (!question || seen.has(question.id)) return;
    seen.add(question.id);
    bank.push(question);
  };

  const allNames = data.players.map((player) => player.name);
  const stats = computePlayerStats(data);
  const record = teamRecord(data.matches);
  const rivals = rivalNames(data);
  const chronology = datedMatches(data);

  const pushLeader = (options: {
    id: string;
    category: string;
    rows: NamedValue[];
    whoPrompt: string;
    tiePrompt?: (value: number) => string;
    reveal: (leader: NamedValue, second: NamedValue | null) => string;
    preferred?: string[];
  }) => {
    const sorted = ranked(options.rows);
    if (sorted.length === 0) return;
    const leaders = sorted.filter((row) => row.value === sorted[0].value);
    if (leaders.length === 1) {
      push(
        makeChoice({
          id: options.id,
          category: options.category,
          prompt: options.whoPrompt,
          correct: leaders[0].name,
          preferred: options.preferred ?? sorted.map((row) => row.name),
          fallback: allNames,
          reveal: options.reveal(leaders[0], sorted[1] ?? null),
        }),
      );
      return;
    }
    if (options.tiePrompt && leaders.length > 1) {
      push(
        makeNumeric({
          id: `${options.id}-empate`,
          category: options.category,
          prompt: options.tiePrompt(leaders[0].value),
          correct: leaders.length,
          reveal: `${leaders.map((leader) => leader.name).join(", ")} empatan con ${leaders[0].value}.`,
        }),
      );
    }
  };

  const scorers = topScorers(data, undefined, 40).map((row) => ({
    name: row.player.name,
    value: row.goals,
  }));
  pushLeader({
    id: "goleador",
    category: "goleo",
    rows: scorers,
    whoPrompt: "¿Quién es el máximo goleador del plantel?",
    tiePrompt: (value) =>
      `Hay empate en la cima del goleo, con ${value} cada uno. ¿Cuántos jugadores lo comparten?`,
    reveal: (leader, second) =>
      `${leader.name} lleva ${countLabel(leader.value, "gol", "goles")}.${secondLine(second, "")}`,
  });

  const assisters = topAssists(data, undefined, 40).map((row) => ({
    name: row.player.name,
    value: row.assists,
  }));
  pushLeader({
    id: "asistidor",
    category: "asistencias",
    rows: assisters,
    whoPrompt: "¿Quién dio más asistencias?",
    tiePrompt: (value) =>
      `Hay empate en asistencias, con ${value} cada uno. ¿Cuántos jugadores lo comparten?`,
    reveal: (leader, second) =>
      `${leader.name} lleva ${countLabel(leader.value, "asistencia", "asistencias")}.${secondLine(second, "")}`,
  });

  const appearances = stats.map((row) => ({
    name: row.playerName,
    value: row.played,
  }));
  pushLeader({
    id: "presencias",
    category: "presencias",
    rows: appearances,
    whoPrompt: "¿Quién jugó más partidos?",
    tiePrompt: (value) =>
      `Hay empate en presencias, con ${value} partidos. ¿Cuántos jugadores lo comparten?`,
    reveal: (leader, second) =>
      `${leader.name} jugó ${countLabel(leader.value, "partido", "partidos")}.${secondLine(second, "")}`,
  });

  pushLeader({
    id: "racha",
    category: "racha",
    rows: stats.map((row) => ({
      name: row.playerName,
      value: row.longestStreak,
    })),
    whoPrompt: "¿Quién tiene la racha de presencias más larga?",
    reveal: (leader, second) =>
      `${leader.name} sumó ${countLabel(leader.value, "partido seguido", "partidos seguidos")}.${secondLine(second, "")}`,
  });

  const absences = absenceBreakdown(data);
  pushLeader({
    id: "lesiones",
    category: "lesiones",
    rows: absences.byInjury.map((row) => ({
      name: row.player.name,
      value: row.injuries,
    })),
    whoPrompt: "¿Quién faltó más partidos por lesión?",
    tiePrompt: (value) =>
      `Hay empate en lesiones, con ${value} cada uno. ¿Cuántos jugadores lo comparten?`,
    reveal: (leader, second) =>
      `${leader.name} se perdió ${countLabel(leader.value, "partido", "partidos")} por lesión.${secondLine(second, "")}`,
  });
  pushLeader({
    id: "viajes",
    category: "viajes",
    rows: absences.byTravel.map((row) => ({
      name: row.player.name,
      value: row.travels,
    })),
    whoPrompt: "¿Quién faltó más partidos por viaje?",
    tiePrompt: (value) =>
      `Hay empate en viajes, con ${value} cada uno. ¿Cuántos jugadores lo comparten?`,
    reveal: (leader, second) =>
      `${leader.name} estuvo de viaje en ${countLabel(leader.value, "partido", "partidos")}.${secondLine(second, "")}`,
  });
  pushLeader({
    id: "ausencias",
    category: "ausencias",
    rows: absences.byAbsent.map((row) => ({
      name: row.player.name,
      value: row.absent,
    })),
    whoPrompt: "¿Quién acumuló más ausencias?",
    tiePrompt: (value) =>
      `Hay empate en ausencias, con ${value} cada uno. ¿Cuántos jugadores lo comparten?`,
    reveal: (leader, second) =>
      `${leader.name} figuró ausente ${countLabel(leader.value, "vez", "veces")}.${secondLine(second, "")}`,
  });

  pushLeader({
    id: "efectividad",
    category: "efectividad",
    rows: stats
      .filter((row) => row.played >= 8)
      .map((row) => ({
        name: row.playerName,
        value: Math.round(row.winRate * 100),
      })),
    whoPrompt:
      "¿Quién gana más seguido cuando juega? Entran quienes tienen al menos 8 partidos.",
    reveal: (leader, second) => {
      const stat = stats.find((row) => row.playerName === leader.name);
      const detail = stat
        ? ` Ganó ${stat.wins} de ${stat.played}.`
        : "";
      return `${leader.name} gana el ${leader.value}% de los partidos que juega.${detail}${secondLine(second, "%")}`;
    },
  });

  const presenceLeader = ranked(appearances)[0];
  pushLeader({
    id: "presencia-pct",
    category: "presencias",
    rows: stats
      .filter(
        (row) =>
          row.eligible >= 10 && row.playerName !== presenceLeader?.name,
      )
      .map((row) => ({
        name: row.playerName,
        value: Math.round(row.attendancePct * 100),
      })),
    whoPrompt:
      "Sin contar al que más jugó: ¿quién tiene el mayor porcentaje de presencia? Mínimo 10 partidos fichado.",
    reveal: (leader, second) =>
      `${leader.name} estuvo en el ${leader.value}% de los partidos en los que ya estaba fichado.${secondLine(second, "%")}`,
  });

  const goalsByMatch = new Map<number, Map<string, number>>();
  for (const goal of data.goals) {
    if (goal.isOwnGoal || !goal.player) continue;
    const player = findPlayer(data, goal.player);
    if (!player) continue;
    const bucket = goalsByMatch.get(goal.matchIndex) ?? new Map<string, number>();
    bucket.set(player.slug, (bucket.get(player.slug) ?? 0) + 1);
    goalsByMatch.set(goal.matchIndex, bucket);
  }

  const hauls: { name: string; slug: string; goals: number; match: SeedMatch }[] = [];
  for (const [matchIndex, bucket] of goalsByMatch) {
    const match = data.matches.find((item) => item.index === matchIndex);
    if (!match) continue;
    for (const [slug, goals] of bucket) {
      if (goals < 2) continue;
      const player = data.players.find((item) => item.slug === slug);
      if (!player) continue;
      hauls.push({ name: player.name, slug, goals, match });
    }
  }
  const bestHaul = hauls.reduce((best, haul) => Math.max(best, haul.goals), 0);
  const bestHauls = hauls.filter((haul) => haul.goals === bestHaul);
  const haulPlayers = new Set(bestHauls.map((haul) => haul.slug));
  if (bestHaul >= 2 && haulPlayers.size === 1) {
    const name = bestHauls[0].name;
    const where = bestHauls
      .map(
        (haul) =>
          `vs ${haul.match.rival} (${haul.match.goalsFor}-${haul.match.goalsAgainst}, ${formatIsoDate(haul.match.date)})`,
      )
      .join("; ");
    push(
      makeChoice({
        id: "mas-goles-partido",
        category: "goleo",
        prompt: `¿Quién llegó a meter ${bestHaul} goles en un mismo partido?`,
        correct: name,
        preferred: hauls.map((haul) => haul.name),
        fallback: allNames,
        reveal: `${name} lo hizo ${where}.`,
      }),
    );
  }
  if (bestHaul >= 2 && bestHauls.length === 1) {
    const haul = bestHauls[0];
    push(
      makeChoice({
        id: "mas-goles-partido-rival",
        category: "goleo",
        prompt: `¿Contra quién hizo ${haul.name} ${countLabel(haul.goals, "gol", "goles")} en un mismo partido?`,
        correct: haul.match.rival,
        preferred: rivals,
        fallback: rivals,
        reveal: `Fue contra ${haul.match.rival} el ${formatIsoDate(haul.match.date)}, por ${haul.match.championship}. Terminó ${haul.match.goalsFor}-${haul.match.goalsAgainst}.`,
      }),
    );
  }

  const topScorer = ranked(scorers)[0];
  const topScorerTied =
    ranked(scorers).filter((row) => row.value === topScorer?.value).length > 1;
  if (topScorer && !topScorerTied) {
    push(
      makeNumeric({
        id: "goles-puntero",
        category: "cifras",
        prompt: `¿Cuántos goles tiene ${topScorer.name}?`,
        correct: topScorer.value,
        reveal: `${topScorer.name} lleva ${countLabel(topScorer.value, "gol", "goles")} en el historial.`,
      }),
    );
  }
  const topAssister = ranked(assisters)[0];
  const topAssisterTied =
    ranked(assisters).filter((row) => row.value === topAssister?.value).length > 1;
  if (topAssister && !topAssisterTied) {
    push(
      makeNumeric({
        id: "asistencias-puntero",
        category: "cifras",
        prompt: `¿Cuántas asistencias tiene ${topAssister.name}?`,
        correct: topAssister.value,
        reveal: `${topAssister.name} lleva ${countLabel(topAssister.value, "asistencia", "asistencias")}.`,
      }),
    );
  }

  const goalLine = lineChoices(record.goalsFor, record.goalsAgainst, "linea-goles");
  if (goalLine) {
    const correctLine = `${record.goalsFor}:${record.goalsAgainst}`;
    push({
      id: "linea-goles",
      category: "cifras",
      prompt: "¿Cuál es el marcador histórico de goles a favor y en contra?",
      choices: goalLine,
      answer: goalLine.indexOf(correctLine),
      reveal: `Vamos ${record.goalsFor} a favor y ${record.goalsAgainst} en contra. Diferencia ${record.goalsFor - record.goalsAgainst}.`,
    });
  }
  push(
    makeNumeric({
      id: "puntos",
      category: "cifras",
      prompt: "¿Cuántos puntos suma el plantel? Cada victoria vale 3 y cada empate, 1.",
      correct: record.points,
      reveal: `${record.wins} victorias y ${record.draws} empates suman ${record.points} puntos.`,
    }),
  );

  for (const row of ranked(scorers).slice(1, 6)) {
    push(
      makeNumeric({
        id: `goles-${row.name}`,
        category: "cifras",
        prompt: `¿Cuántos goles tiene ${row.name}?`,
        correct: row.value,
        reveal: `${row.name} lleva ${countLabel(row.value, "gol", "goles")}.`,
      }),
    );
  }
  for (const row of ranked(assisters).slice(1, 5)) {
    push(
      makeNumeric({
        id: `asistencias-${row.name}`,
        category: "cifras",
        prompt: `¿Cuántas asistencias tiene ${row.name}?`,
        correct: row.value,
        reveal: `${row.name} lleva ${countLabel(row.value, "asistencia", "asistencias")}.`,
      }),
    );
  }
  for (const row of ranked(appearances).slice(0, 3)) {
    push(
      makeNumeric({
        id: `pj-${row.name}`,
        category: "cifras",
        prompt: `¿Cuántos partidos jugó ${row.name}?`,
        correct: row.value,
        reveal: `${row.name} jugó ${countLabel(row.value, "partido", "partidos")}.`,
      }),
    );
  }

  const teamRecordChoices = recordChoices(
    record.wins,
    record.draws,
    record.losses,
    "record-equipo",
  );
  if (teamRecordChoices) {
    const correctRecord = recordString(record.wins, record.draws, record.losses);
    push({
      id: "record-equipo",
      category: "equipo",
      prompt: "¿Cuál es el récord del plantel? El orden es ganados-empatados-perdidos.",
      choices: teamRecordChoices,
      answer: teamRecordChoices.indexOf(correctRecord),
      reveal: `En ${record.played} partidos: ${record.wins} victorias, ${record.draws} empates y ${record.losses} derrotas.`,
    });
  }
  push(
    makeNumeric({
      id: "partidos-equipo",
      category: "equipo",
      prompt: "¿Cuántos partidos tiene cargados el historial?",
      correct: record.played,
      reveal: `Hay ${record.played} partidos, desde el Clausura 2024.`,
    }),
  );
  push(
    makeNumeric({
      id: "plantel",
      category: "equipo",
      prompt: "¿Cuántos jugadores hay en el plantel?",
      correct: data.players.length,
      reveal: `El plantel tiene ${data.players.length} jugadores cargados.`,
    }),
  );
  push(
    makeNumeric({
      id: "campeonatos-total",
      category: "equipo",
      prompt: "¿Cuántos campeonatos figuran en la historia del equipo?",
      correct: data.championships.length,
      reveal: `Hay ${data.championships.length} campeonatos cargados.`,
    }),
  );
  push(
    makeNumeric({
      id: "victorias",
      category: "equipo",
      prompt: "¿Cuántas victorias acumula el equipo?",
      correct: record.wins,
      reveal: `${record.wins} victorias en ${record.played} partidos.`,
    }),
  );
  push(
    makeNumeric({
      id: "empates",
      category: "equipo",
      prompt: "¿Cuántos empates acumula el equipo?",
      correct: record.draws,
      reveal: `${record.draws} empates en ${record.played} partidos.`,
    }),
  );
  push(
    makeNumeric({
      id: "derrotas",
      category: "equipo",
      prompt: "¿Cuántas derrotas acumula el equipo?",
      correct: record.losses,
      reveal: `${record.losses} derrotas en ${record.played} partidos.`,
    }),
  );
  push(
    makeNumeric({
      id: "valla",
      category: "equipo",
      prompt: "¿En cuántos partidos no nos convirtieron?",
      correct: data.matches.filter((match) => match.goalsAgainst === 0).length,
      reveal: `El arco quedó en cero en ${data.matches.filter((match) => match.goalsAgainst === 0).length} partidos.`,
    }),
  );
  push(
    makeNumeric({
      id: "diferencia",
      category: "equipo",
      prompt: "¿Cuál es la diferencia de gol del historial?",
      correct: record.goalsFor - record.goalsAgainst,
      min: -999,
      reveal: `${record.goalsFor} a favor y ${record.goalsAgainst} en contra.`,
    }),
  );

  const rivalRows = new Map<string, { games: number; goalsFor: number; goalsAgainst: number }>();
  for (const match of data.matches) {
    const row = rivalRows.get(match.rival) ?? { games: 0, goalsFor: 0, goalsAgainst: 0 };
    row.games += 1;
    row.goalsFor += match.goalsFor;
    row.goalsAgainst += match.goalsAgainst;
    rivalRows.set(match.rival, row);
  }
  const rivalList = [...rivalRows.entries()].map(([name, row]) => ({ name, ...row }));
  pushLeader({
    id: "rival-partidos",
    category: "rival",
    rows: rivalList.map((row) => ({ name: row.name, value: row.games })),
    preferred: rivals,
    whoPrompt: "¿Contra quién jugamos más partidos?",
    reveal: (leader, second) =>
      `Jugamos ${countLabel(leader.value, "vez", "veces")} contra ${leader.name}.${secondLine(second, "")}`,
  });
  pushLeader({
    id: "rival-goles-favor",
    category: "rival",
    rows: rivalList.map((row) => ({ name: row.name, value: row.goalsFor })),
    preferred: rivals,
    whoPrompt: "¿A qué rival le metimos más goles, sumando todos los partidos?",
    reveal: (leader, second) =>
      `Le hicimos ${countLabel(leader.value, "gol", "goles")} a ${leader.name}.${secondLine(second, "")}`,
  });
  pushLeader({
    id: "rival-goles-contra",
    category: "rival",
    rows: rivalList.map((row) => ({ name: row.name, value: row.goalsAgainst })),
    preferred: rivals,
    whoPrompt: "¿Qué rival nos hizo más goles en total?",
    reveal: (leader, second) =>
      `${leader.name} nos hizo ${countLabel(leader.value, "gol", "goles")}.${secondLine(second, "")}`,
  });

  const losses = data.matches.filter((match) => match.result === "L");
  const worst = [...losses].sort(
    (a, b) =>
      b.goalsAgainst - b.goalsFor - (a.goalsAgainst - a.goalsFor) ||
      a.index - b.index,
  );
  if (
    worst[0] &&
    worst[0].goalsAgainst > worst[0].goalsFor &&
    (!worst[1] ||
      worst[0].goalsAgainst - worst[0].goalsFor !==
        worst[1].goalsAgainst - worst[1].goalsFor)
  ) {
    const match = worst[0];
    push(
      makeChoice({
        id: "peor-derrota",
        category: "rival",
        prompt: "¿Contra quién fue la derrota por más goles?",
        correct: match.rival,
        preferred: rivals,
        fallback: rivals,
        reveal: `Contra ${match.rival} terminó ${match.goalsFor}-${match.goalsAgainst}, el ${formatIsoDate(match.date)} por ${match.championship}.`,
      }),
    );
  }

  const wins = data.matches.filter((match) => match.result === "W");
  const bestWin = [...wins].sort(
    (a, b) =>
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      a.index - b.index,
  );
  if (
    bestWin[0] &&
    bestWin[0].goalsFor > bestWin[0].goalsAgainst &&
    (!bestWin[1] ||
      bestWin[0].goalsFor - bestWin[0].goalsAgainst !==
        bestWin[1].goalsFor - bestWin[1].goalsAgainst)
  ) {
    const match = bestWin[0];
    push(
      makeChoice({
        id: "mejor-victoria",
        category: "rival",
        prompt: "¿Contra quién fue la victoria por más goles?",
        correct: match.rival,
        preferred: rivals,
        fallback: rivals,
        reveal: `Contra ${match.rival} ganamos ${match.goalsFor}-${match.goalsAgainst}, el ${formatIsoDate(match.date)} por ${match.championship}.`,
      }),
    );
  }

  if (chronology[0]) {
    const debut = chronology[0];
    push(
      makeChoice({
        id: "debut-rival",
        category: "rival",
        prompt: "¿Contra quién fue el primer partido del historial?",
        correct: debut.rival,
        preferred: rivals,
        fallback: rivals,
        reveal: `El ${formatIsoDate(debut.date)} debutamos contra ${debut.rival} por ${debut.championship}. Terminó ${debut.goalsFor}-${debut.goalsAgainst}.`,
      }),
    );
    pushScoreQuestion(bank, debut, {
      id: "debut-marcador",
      category: "marcador",
      prompt: `El primer partido fue contra ${debut.rival}, el ${formatIsoDate(debut.date)}, por ${debut.championship}. ¿Cómo terminó?`,
    });
    seen.add("debut-marcador");
  }

  const last = chronology.at(-1);
  const previous = chronology.at(-2);
  if (last) {
    pushScoreQuestion(bank, last, {
      id: "ultimo-partido",
      category: "actualidad",
      prompt: `El último partido fue contra ${last.rival}, el ${formatIsoDate(last.date)}, por ${last.championship}. ¿Cuál fue el marcador?`,
    });
    seen.add("ultimo-partido");
  }
  if (previous && previous.index !== last?.index) {
    pushScoreQuestion(bank, previous, {
      id: "partido-anterior",
      category: "actualidad",
      prompt: `El partido anterior fue contra ${previous.rival}, el ${formatIsoDate(previous.date)}, por ${previous.championship}. ¿Cuál fue el marcador?`,
    });
    seen.add("partido-anterior");
  }

  const highlighted = new Set<number>([last?.index, previous?.index, chronology[0]?.index].filter(
    (index): index is number => index != null,
  ));
  if (worst[0] && !highlighted.has(worst[0].index)) {
    const match = worst[0];
    pushScoreQuestion(bank, match, {
      id: `marcador-${match.index}`,
      category: "marcador",
      prompt: `¿Cuál fue el marcador contra ${match.rival} el ${formatIsoDate(match.date)} (${match.championship})?`,
    });
    seen.add(`marcador-${match.index}`);
    highlighted.add(match.index);
  }
  if (bestWin[0] && !highlighted.has(bestWin[0].index)) {
    const match = bestWin[0];
    pushScoreQuestion(bank, match, {
      id: `marcador-${match.index}`,
      category: "marcador",
      prompt: `¿Cuál fue el marcador contra ${match.rival} el ${formatIsoDate(match.date)} (${match.championship})?`,
    });
    seen.add(`marcador-${match.index}`);
    highlighted.add(match.index);
  }
  for (const match of [...chronology].reverse()) {
    if (highlighted.has(match.index)) continue;
    if ([...seen].filter((id) => id.startsWith("marcador-")).length >= 4) break;
    pushScoreQuestion(bank, match, {
      id: `marcador-${match.index}`,
      category: "marcador",
      prompt: `¿Cuál fue el marcador contra ${match.rival} el ${formatIsoDate(match.date)} (${match.championship})?`,
    });
    seen.add(`marcador-${match.index}`);
    highlighted.add(match.index);
  }

  const duos = duoConnections(data, 20);
  if (duos[0] && (!duos[1] || duos[0].goals > duos[1].goals)) {
    const correct = pairLabel(duos[0].playerA.name, duos[0].playerB.name);
    const preferred = duos.slice(1).map((duo) => pairLabel(duo.playerA.name, duo.playerB.name));
    const extras: string[] = [];
    const seedNames = ranked(scorers).slice(0, 6).map((row) => row.name);
    for (let i = 0; i < seedNames.length; i += 1) {
      for (let j = i + 1; j < seedNames.length; j += 1) {
        extras.push(pairLabel(seedNames[i], seedNames[j]));
      }
    }
    push(
      makeChoice({
        id: "mejor-dupla",
        category: "dupla",
        prompt: "¿Qué dupla se asistió más veces, sumando los dos sentidos?",
        correct,
        preferred,
        fallback: extras,
        reveal: `${correct} combinaron ${countLabel(duos[0].goals, "gol", "goles")}. ${duos[0].playerA.name} hizo ${duos[0].goalsA} y asistió ${duos[0].assistsA}; ${duos[0].playerB.name} hizo ${duos[0].goalsB} y asistió ${duos[0].assistsB}.`,
      }),
    );
  }

  const feeders = topConnections(data, 30);
  const byScorer = new Map<string, { scorer: string; assister: string; goals: number }[]>();
  for (const pair of feeders) {
    const list = byScorer.get(pair.scorer.slug) ?? [];
    list.push({
      scorer: pair.scorer.name,
      assister: pair.assister.name,
      goals: pair.goals,
    });
    byScorer.set(pair.scorer.slug, list);
  }
  let bestFeed: { scorer: string; assister: string; goals: number } | null = null;
  for (const list of byScorer.values()) {
    const ordered = [...list].sort((a, b) => b.goals - a.goals);
    if (ordered[0].goals < 2) continue;
    if (ordered[1] && ordered[0].goals === ordered[1].goals) continue;
    if (!bestFeed || ordered[0].goals > bestFeed.goals) bestFeed = ordered[0];
  }
  if (bestFeed) {
    push(
      makeChoice({
        id: "mejor-asistencia",
        category: "dupla",
        prompt: `¿Quién asistió más veces a ${bestFeed.scorer}?`,
        correct: bestFeed.assister,
        preferred: allNames,
        fallback: allNames,
        reveal: `${bestFeed.assister} asistió ${countLabel(bestFeed.goals, "vez", "veces")} a ${bestFeed.scorer}.`,
      }),
    );
  }

  const championships = data.championships
    .map((championship) => ({
      ...championship,
      matches: data.matches.filter((match) => match.championship === championship.name),
    }))
    .sort((a, b) => b.matches.length - a.matches.length);

  pushLeader({
    id: "campeonato-mas-partidos",
    category: "campeonato",
    rows: championships.map((championship) => ({
      name: championship.name,
      value: championship.matches.length,
    })),
    preferred: championships.map((championship) => championship.name),
    whoPrompt: "¿De qué campeonato hay más partidos cargados?",
    reveal: (leader, second) =>
      `${leader.name} tiene ${countLabel(leader.value, "partido", "partidos")} en el historial.${secondLine(second, "")}`,
  });

  for (const championship of championships) {
    if (championship.matches.length < 4) continue;
    const champScorers = topScorers(data, championship.slug, 12).map((row) => ({
      name: row.player.name,
      value: row.goals,
    }));
    pushLeader({
      id: `goleo-${championship.slug}`,
      category: "campeonato",
      rows: champScorers.filter((row) => row.value >= 2),
      whoPrompt: `En ${championship.name}, ¿quién metió más goles?`,
      reveal: (leader, second) =>
        `En ${championship.name}, ${leader.name} hizo ${countLabel(leader.value, "gol", "goles")}.${secondLine(second, "")}`,
    });
    const champRecord = teamRecord(championship.matches);
    const choices = recordChoices(
      champRecord.wins,
      champRecord.draws,
      champRecord.losses,
      `record-${championship.slug}`,
    );
    if (!choices) continue;
    const correct = recordString(
      champRecord.wins,
      champRecord.draws,
      champRecord.losses,
    );
    push({
      id: `record-${championship.slug}`,
      category: "campeonato",
      prompt: `¿Cuál es el récord en ${championship.name}? El orden es ganados-empatados-perdidos.`,
      choices,
      answer: choices.indexOf(correct),
      reveal: `${championship.name}: ${champRecord.wins} victorias, ${champRecord.draws} empates y ${champRecord.losses} derrotas en ${champRecord.played} partidos.`,
    });
  }

  const timeline = attendanceTimeline(data);
  const fullest = [...timeline].sort(
    (a, b) => b.present - a.present || a.date.localeCompare(b.date),
  );
  if (fullest[0] && fullest[0].present > 0 && fullest[0].present !== fullest[1]?.present) {
    const match = fullest[0];
    push(
      makeChoice({
        id: "convocatoria-max",
        category: "presencias",
        prompt: "¿Contra quién convocamos más jugadores en un partido?",
        correct: match.rival,
        preferred: rivals,
        fallback: rivals,
        reveal: `Hubo ${match.present} presentes contra ${match.rival} el ${formatIsoDate(match.date)}, por ${match.championship}.`,
      }),
    );
  }

  return bank.filter(
    (question) =>
      question.prompt.trim() &&
      question.reveal.trim() &&
      question.choices.length === 4 &&
      new Set(question.choices).size === 4 &&
      question.answer >= 0 &&
      question.answer < 4,
  );
}

function pickDaily(bank: ChoiceQuestion[], dayKey: string): ChoiceQuestion[] {
  const byCategory = new Map<string, ChoiceQuestion[]>();
  for (const question of bank) {
    const list = byCategory.get(question.category) ?? [];
    list.push(question);
    byCategory.set(question.category, list);
  }
  const categories = shuffle([...byCategory.keys()], rngFor(`daily-cats:${dayKey}`));
  const chosen: ChoiceQuestion[] = [];
  const used = new Set<string>();
  for (const category of categories) {
    if (chosen.length >= 8) break;
    const list = byCategory.get(category) ?? [];
    if (list.length === 0) continue;
    const index = Math.floor(
      rngFor(`daily-pick:${dayKey}:${category}`)() * list.length,
    );
    const question = list[index];
    if (!question || used.has(question.id)) continue;
    used.add(question.id);
    chosen.push(question);
  }
  if (chosen.length < 8) {
    for (const question of shuffle(
      bank.filter((item) => !used.has(item.id)),
      rngFor(`daily-fill:${dayKey}`),
    )) {
      if (chosen.length >= 8) break;
      chosen.push(question);
    }
  }
  return chosen;
}

function capStreak(bank: ChoiceQuestion[]): ChoiceQuestion[] {
  const groups = new Map<string, ChoiceQuestion[]>();
  for (const question of bank) {
    const list = groups.get(question.category) ?? [];
    if (list.length >= 4) continue;
    list.push(question);
    groups.set(question.category, list);
  }
  return [...groups.values()].flat();
}

function absenceBySlug(data: SeedData) {
  const breakdown = absenceBreakdown(data);
  const map = new Map<string, { injuries: number; travels: number; absent: number }>();
  for (const row of [
    ...breakdown.byInjury,
    ...breakdown.byTravel,
    ...breakdown.byAbsent,
  ]) {
    map.set(row.player.slug, row);
  }
  return map;
}

function buildWho(data: SeedData): WhoPuzzle[] {
  const stats = computePlayerStats(data);
  const absences = absenceBySlug(data);
  const drafts: WhoPuzzle[] = [];
  const signatures = new Map<string, number>();

  for (const stat of stats) {
    if (stat.played < 1 && stat.eligible < 4) continue;
    const absence = absences.get(stat.playerSlug) ?? {
      injuries: 0,
      travels: 0,
      absent: 0,
    };
    const clues = [
      `Cuando juega, su récord es ${recordString(stat.wins, stat.draws, stat.losses)}.`,
      `Lesiones ${absence.injuries} · viajes ${absence.travels} · ausencias ${absence.absent}.`,
      `Racha más larga: ${countLabel(stat.longestStreak, "partido seguido", "partidos seguidos")}.`,
      `${countLabel(stat.played, "partido jugado", "partidos jugados")} (${Math.round(stat.attendancePct * 100)}% de presencia).`,
      `${countLabel(stat.goals, "gol", "goles")} y ${countLabel(stat.assists, "asistencia", "asistencias")}.`,
    ];
    const signature = clues.join("\n");
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
    const player = data.players.find((item) => item.slug === stat.playerSlug);
    if (!player) continue;
    const photo = resolvePlayerPhoto(player, data.photos);
    drafts.push({
      id: `who-${player.slug}`,
      slug: player.slug,
      name: player.name,
      clues,
      photoUrl: photo?.url ?? null,
      photoCrop: photo?.crop ?? null,
    });
  }

  return drafts.filter(
    (puzzle) => signatures.get(puzzle.clues.join("\n")) === 1,
  );
}

export function buildQuizPack(data: SeedData, dayKey = quizDayKey()): QuizPack {
  const bank = buildBank(data);
  const record = teamRecord(data.matches);
  return {
    dayKey,
    dayLabel: formatDayLabel(dayKey),
    summary: {
      matches: record.played,
      players: data.players.length,
      record: recordString(record.wins, record.draws, record.losses),
      goalsFor: record.goalsFor,
      goalsAgainst: record.goalsAgainst,
    },
    daily: pickDaily(bank, dayKey),
    streak: capStreak(bank),
    who: shuffle(buildWho(data), rngFor(`who:${dayKey}`)),
    roster: [...data.players]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((player) => ({ slug: player.slug, name: player.name })),
  };
}

export function triviaRank(score: number, total: number): string {
  if (total <= 0) return "Sin datos";
  if (score === total) return "Crack del plantel";
  if (score / total >= 0.75) return "Titular";
  if (score / total >= 0.5) return "Suplente";
  if (score / total >= 0.25) return "En el banco";
  return "Lesionado";
}

export function whoRank(guesses: number, solved: boolean): string {
  if (!solved) return "No estaba convocado";
  if (guesses <= 1) return "Lo tenías claro";
  if (guesses === 2) return "Titular";
  if (guesses === 3) return "Entró en el segundo tiempo";
  if (guesses === 4) return "Pidió el cambio";
  return "Sobre la hora";
}
