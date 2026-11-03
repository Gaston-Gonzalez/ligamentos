"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { ChoiceQuestion, QuizPack, WhoPuzzle } from "@/lib/quiz";

type Mode = "hub" | "daily" | "who" | "who-practice" | "streak";
type DailyPhase = "question" | "feedback" | "done";
type WhoStatus = "playing" | "solved" | "failed";

type DailySave = {
  signature: string;
  answers: number[];
  phase: DailyPhase;
};

type WhoSave = {
  puzzleId: string;
  guesses: string[];
  status: WhoStatus;
};

const BEST_KEY = "ligamentosdle:best-streak";

function dailyKey(dayKey: string) {
  return `ligamentosdle:daily:${dayKey}`;
}

function whoKey(dayKey: string) {
  return `ligamentosdle:who:${dayKey}`;
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
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
  return labels[category] ?? category;
}

function triviaRank(score: number, total: number): string {
  if (total <= 0) return "Sin datos";
  if (score === total) return "Crack del plantel";
  if (score / total >= 0.75) return "Titular";
  if (score / total >= 0.5) return "Suplente";
  if (score / total >= 0.25) return "En el banco";
  return "Lesionado";
}

function whoRank(guesses: number, solved: boolean): string {
  if (!solved) return "No estaba convocado";
  if (guesses <= 1) return "Lo tenías claro";
  if (guesses === 2) return "Titular";
  if (guesses === 3) return "Entró en el segundo tiempo";
  if (guesses === 4) return "Pidió el cambio";
  return "Sobre la hora";
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function choiceClass(index: number, picked: number | null, answer: number): string {
  const base =
    "w-full rounded-2xl border px-4 py-3 text-left text-base font-semibold transition disabled:cursor-default";
  if (picked === null) {
    return `${base} border-line bg-white hover:border-gold hover:bg-gold/10`;
  }
  if (index === answer) return `${base} border-emerald-600 bg-emerald-600 text-white`;
  if (index === picked) return `${base} border-rose-500 bg-rose-500 text-white`;
  return `${base} border-line bg-white/70 text-muted`;
}

export function Ligamentosdle({ pack }: { pack: QuizPack }) {
  const [mode, setMode] = useState<Mode>("hub");
  const [daily, setDaily] = useState<DailySave>({
    signature: "",
    answers: [],
    phase: "question",
  });
  const [whoSave, setWhoSave] = useState<WhoSave | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    const signature = pack.daily.map((question) => question.id).join("|");
    const savedDaily = readJson<DailySave>(dailyKey(pack.dayKey));
    const sameTanda = savedDaily?.signature === signature;
    const answers = sameTanda && Array.isArray(savedDaily?.answers)
      ? savedDaily.answers.filter((value) => Number.isInteger(value)).slice(0, pack.daily.length)
      : [];
    let phase: DailyPhase = sameTanda ? (savedDaily?.phase ?? "question") : "question";
    if (phase !== "question" && phase !== "feedback" && phase !== "done") phase = "question";
    if (answers.length === 0) phase = "question";
    if (answers.length >= pack.daily.length && phase === "question") phase = "done";
    if (phase === "feedback" && answers.length === 0) phase = "question";
    setDaily({ signature, answers, phase });

    const puzzle = pack.who[0];
    const savedWho = readJson<WhoSave>(whoKey(pack.dayKey));
    if (puzzle && savedWho?.puzzleId === puzzle.id && Array.isArray(savedWho.guesses)) {
      setWhoSave({
        puzzleId: puzzle.id,
        guesses: savedWho.guesses.filter((guess) => typeof guess === "string"),
        status:
          savedWho.status === "solved" || savedWho.status === "failed"
            ? savedWho.status
            : "playing",
      });
    } else if (puzzle) {
      setWhoSave({ puzzleId: puzzle.id, guesses: [], status: "playing" });
    }

    const storedBest = Number(localStorage.getItem(BEST_KEY));
    setBest(Number.isFinite(storedBest) ? storedBest : 0);
    setReady(true);
  }, [pack.dayKey, pack.daily, pack.who]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(dailyKey(pack.dayKey), JSON.stringify(daily));
  }, [daily, pack.dayKey, ready]);

  useEffect(() => {
    if (!ready || !whoSave) return;
    localStorage.setItem(whoKey(pack.dayKey), JSON.stringify(whoSave));
  }, [whoSave, pack.dayKey, ready]);

  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mode]);

  const dailyCorrect = daily.answers.filter(
    (pick, index) => pack.daily[index]?.answer === pick,
  ).length;
  const whoPuzzle = pack.who[0];
  const whoSolved = whoSave?.status === "solved";
  const whoFailed = whoSave?.status === "failed";
  const whoDone = whoSolved || whoFailed;

  return (
    <div ref={cardRef} className="mt-8 scroll-mt-24">
      {mode === "hub" ? (
        <Hub
          pack={pack}
          ready={ready}
          dailyDone={daily.phase === "done"}
          dailyProgress={daily.answers.length}
          dailyCorrect={dailyCorrect}
          whoDone={whoDone}
          whoSolved={whoSolved}
          whoGuesses={whoSave?.guesses.length ?? 0}
          best={best}
          onDaily={() => setMode("daily")}
          onWho={() => setMode("who")}
          onPractice={() => setMode("who-practice")}
          onStreak={() => setMode("streak")}
        />
      ) : null}

      {mode === "daily" ? (
        <DailyGame
          pack={pack}
          save={daily}
          setSave={setDaily}
          onExit={() => setMode("hub")}
        />
      ) : null}

      {mode === "who" && whoPuzzle && whoSave ? (
        <WhoGame
          puzzle={whoPuzzle}
          roster={pack.roster}
          guesses={whoSave.guesses}
          status={whoSave.status}
          onGuess={(slug) => {
            setWhoSave((current) => {
              if (!current || current.status !== "playing") return current;
              if (current.guesses.includes(slug)) return current;
              const guesses = [...current.guesses, slug];
              const solved = slug === whoPuzzle.slug;
              const failed = !solved && guesses.length >= whoPuzzle.clues.length;
              return {
                ...current,
                guesses,
                status: solved ? "solved" : failed ? "failed" : "playing",
              };
            });
          }}
          onExit={() => setMode("hub")}
          practiceLabel={pack.who.length > 1 ? "Otro jugador" : undefined}
          onPractice={() => setMode("who-practice")}
          shareDay={pack.dayLabel}
        />
      ) : null}

      {mode === "who-practice" ? (
        <WhoPractice
          puzzles={pack.who.slice(1)}
          roster={pack.roster}
          onExit={() => setMode("hub")}
        />
      ) : null}

      {mode === "streak" ? (
        <StreakGame
          questions={pack.streak}
          best={best}
          onBest={(score) => {
            setBest((current) => {
              const next = Math.max(current ?? 0, score);
              localStorage.setItem(BEST_KEY, String(next));
              return next;
            });
          }}
          onExit={() => setMode("hub")}
        />
      ) : null}
    </div>
  );
}

function Hub({
  pack,
  ready,
  dailyDone,
  dailyProgress,
  dailyCorrect,
  whoDone,
  whoSolved,
  whoGuesses,
  best,
  onDaily,
  onWho,
  onPractice,
  onStreak,
}: {
  pack: QuizPack;
  ready: boolean;
  dailyDone: boolean;
  dailyProgress: number;
  dailyCorrect: number;
  whoDone: boolean;
  whoSolved: boolean;
  whoGuesses: number;
  best: number | null;
  onDaily: () => void;
  onWho: () => void;
  onPractice: () => void;
  onStreak: () => void;
}) {
  const dailyLabel = !ready
    ? "Jugar"
    : dailyDone
      ? "Ver resultado"
      : dailyProgress > 0
        ? "Seguir"
        : "Jugar";
  const whoLabel = !ready ? "Adivinar" : whoDone ? "Ver resultado" : whoGuesses > 0 ? "Seguir" : "Adivinar";

  return (
    <div>
      <p className="text-sm text-muted">
        Hoy {pack.dayLabel} · {pack.summary.matches} partidos · récord {pack.summary.record} · goles{" "}
        {pack.summary.goalsFor}:{pack.summary.goalsAgainst} · {pack.summary.players} jugadores
      </p>
      <div className="mt-5 grid gap-4">
        <ModeCard
          kicker="Misma tanda para todos"
          title="Trivia del día"
          text="Ocho preguntas de goleo, partidos, rivales y el resto del historial. Se renueva a la medianoche."
          action={dailyLabel}
          onClick={onDaily}
          disabled={pack.daily.length === 0}
          extra={
            dailyDone ? (
              <p className="text-sm font-semibold text-blue-dark">
                {dailyCorrect}/{pack.daily.length} · {triviaRank(dailyCorrect, pack.daily.length)}
              </p>
            ) : dailyProgress > 0 ? (
              <p className="text-sm text-muted">
                Vas {dailyProgress}/{pack.daily.length}
              </p>
            ) : null
          }
        />
        <ModeCard
          kicker="Un jugador, cinco pistas"
          title="¿Quién es?"
          text="El jugador del día. Cada intento fallido abre una pista más concreta."
          action={whoLabel}
          onClick={onWho}
          disabled={!pack.who[0]}
          extra={
            whoDone ? (
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-blue-dark">
                <span>{whoRank(whoGuesses, whoSolved)}</span>
                {pack.who.length > 1 ? (
                  <button
                    type="button"
                    onClick={onPractice}
                    className="font-semibold text-blue underline-offset-2 hover:underline"
                  >
                    Practicar otro
                  </button>
                ) : null}
              </div>
            ) : null
          }
        />
        <ModeCard
          kicker={best === null ? "Racha libre" : `Mejor racha: ${best}`}
          title="Racha"
          text="Seguí respondiendo hasta fallar. Cada partida mezcla el banco de preguntas."
          action="Empezar"
          onClick={onStreak}
          disabled={pack.streak.length === 0}
        />
      </div>
    </div>
  );
}

function ModeCard({
  kicker,
  title,
  text,
  action,
  onClick,
  disabled,
  extra,
}: {
  kicker: string;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <article className="surface rounded-3xl p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue">{kicker}</p>
      <h2 className="display mt-2 text-4xl text-blue-deep">{title}</h2>
      <p className="mt-2 max-w-xl text-sm text-muted md:text-base">{text}</p>
      {extra ? <div className="mt-3">{extra}</div> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-4 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-blue-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {action}
      </button>
    </article>
  );
}

function DailyGame({
  pack,
  save,
  setSave,
  onExit,
}: {
  pack: QuizPack;
  save: DailySave;
  setSave: Dispatch<SetStateAction<DailySave>>;
  onExit: () => void;
}) {
  const total = pack.daily.length;
  const index = save.phase === "feedback" ? save.answers.length - 1 : save.answers.length;
  const question = pack.daily[index];
  const picked = save.phase === "feedback" ? (save.answers[index] ?? null) : null;

  useEffect(() => {
    if (save.phase !== "question" || !question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const choice = Number(event.key) - 1;
      if (!Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) return;
      event.preventDefault();
      setSave((current) =>
        current.phase === "question"
          ? { ...current, answers: [...current.answers, choice], phase: "feedback" }
          : current,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, save.phase, setSave]);

  if (total === 0) {
    return (
      <Panel title="Trivia del día" onExit={onExit}>
        <p className="text-muted">Todavía no hay preguntas suficientes en el historial.</p>
      </Panel>
    );
  }

  if (save.phase === "done") {
    return <DailyResults pack={pack} answers={save.answers} onExit={onExit} />;
  }

  if (!question) return null;

  return (
    <Panel
      title="Trivia del día"
      kicker={`${categoryLabel(question.category)} · ${Math.min(index + 1, total)}/${total}`}
      onExit={onExit}
    >
      <Progress answers={save.answers} questions={pack.daily} current={index} />
      <h3 className="mt-5 text-xl font-bold text-blue-deep md:text-2xl">{question.prompt}</h3>
      <div className="mt-4 grid gap-3">
        {question.choices.map((choice, choiceIndex) => (
          <button
            key={`${question.id}-${choice}`}
            type="button"
            disabled={picked !== null}
            onClick={() =>
              setSave((current) =>
                current.phase === "question"
                  ? { ...current, answers: [...current.answers, choiceIndex], phase: "feedback" }
                  : current,
              )
            }
            className={choiceClass(choiceIndex, picked, question.answer)}
          >
            <span className="mr-2 text-sm opacity-70">{choiceIndex + 1}</span>
            {choice}
          </button>
        ))}
      </div>
      {picked !== null ? (
        <Reveal
          correct={picked === question.answer}
          text={question.reveal}
          action={index + 1 >= total ? "Ver resultado" : "Siguiente"}
          onAction={() =>
            setSave((current) => ({
              ...current,
              phase: current.answers.length >= total ? "done" : "question",
            }))
          }
        />
      ) : (
        <p className="mt-3 text-xs text-muted">También podés usar las teclas 1 a 4.</p>
      )}
    </Panel>
  );
}

function DailyResults({
  pack,
  answers,
  onExit,
}: {
  pack: QuizPack;
  answers: number[];
  onExit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const correctFlags = pack.daily.map((question, index) => answers[index] === question.answer);
  const score = correctFlags.filter(Boolean).length;
  return (
    <Panel title={triviaRank(score, pack.daily.length)} kicker="Trivia del día" onExit={onExit}>
      <p className="display text-6xl text-blue-dark">
        {score}/{pack.daily.length}
      </p>
      <p className="mt-2 text-muted">La tanda de hoy queda cerrada. Mañana hay otra.</p>
      <button
        type="button"
        onClick={async () => {
          const share = `Ligamentosdle · ${pack.dayLabel}\nTrivia del día ${score}/${pack.daily.length}\n${correctFlags
            .map((ok) => (ok ? "🟩" : "🟥"))
            .join("")}\n${window.location.origin}/ligamentosdle`;
          const ok = await copyText(share);
          if (ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }
        }}
        className="mt-4 rounded-full bg-blue-deep px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-dark"
      >
        {copied ? "Copiado" : "Copiar resultado"}
      </button>
      <ul className="mt-6 space-y-3">
        {pack.daily.map((question, index) => {
          const ok = answers[index] === question.answer;
          return (
            <li key={question.id} className="rounded-2xl border border-line bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {ok ? "Bien" : "Mal"} · {categoryLabel(question.category)}
              </p>
              <p className="mt-1 font-semibold text-blue-deep">{question.prompt}</p>
              <p className="mt-1 text-sm text-muted">
                {ok
                  ? question.choices[question.answer]
                  : `Elegiste ${question.choices[answers[index]] ?? "—"}. Era ${question.choices[question.answer]}.`}
              </p>
              <p className="mt-1 text-sm">{question.reveal}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function WhoGame({
  puzzle,
  roster,
  guesses,
  status,
  onGuess,
  onExit,
  practiceLabel,
  onPractice,
  shareDay,
}: {
  puzzle: WhoPuzzle;
  roster: { slug: string; name: string }[];
  guesses: string[];
  status: WhoStatus;
  onGuess: (slug: string) => void;
  onExit: () => void;
  practiceLabel?: string;
  onPractice?: () => void;
  shareDay: string;
}) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleCount = status === "playing" ? guesses.length + 1 : guesses.length;
  const visibleClues = puzzle.clues.slice(0, Math.min(puzzle.clues.length, visibleCount));
  const filtered = useMemo(() => {
    const eliminated = new Set(guesses);
    const needle = normalize(query);
    const pending = roster.filter((player) => !eliminated.has(player.slug));
    if (!needle) return pending;
    return pending
      .filter((player) => normalize(player.name).includes(needle))
      .sort((a, b) => {
        const aStarts = normalize(a.name).startsWith(needle) ? 0 : 1;
        const bStarts = normalize(b.name).startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name, "es");
      });
  }, [guesses, query, roster]);

  useEffect(() => {
    if (status === "playing") inputRef.current?.focus();
  }, [guesses.length, status]);

  const solved = status === "solved";
  const squares = guesses
    .map((_, index) => (solved && index === guesses.length - 1 ? "🟩" : "🟥"))
    .join("");

  const submitFiltered = () => {
    if (status !== "playing" || filtered.length !== 1) return;
    onGuess(filtered[0].slug);
    setQuery("");
  };

  return (
    <Panel title="¿Quién es?" kicker={`${shareDay} · ${guesses.length}/${puzzle.clues.length} intentos`} onExit={onExit}>
      <ol className="space-y-2">
        {visibleClues.map((clue, index) => (
          <li key={clue} className="rounded-2xl border border-line bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue">
              Pista {index + 1}
            </p>
            <p className="mt-1 font-medium text-blue-deep">{clue}</p>
          </li>
        ))}
      </ol>

      {status === "playing" ? (
        <>
          <label className="mt-5 block text-sm font-semibold text-blue-deep" htmlFor="who-search">
            Nombre del jugador
          </label>
          <input
            id="who-search"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitFiltered();
              }
            }}
            placeholder="Escribí un nombre"
            className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none ring-blue focus:ring-2"
            autoComplete="off"
          />
          <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto md:grid-cols-3">
            {filtered.map((player) => (
              <button
                key={player.slug}
                type="button"
                onClick={() => {
                  onGuess(player.slug);
                  setQuery("");
                }}
                className="rounded-xl border border-line bg-white px-3 py-2 text-left text-sm font-semibold text-blue-deep hover:border-gold hover:bg-gold/10"
              >
                {player.name}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Ningún jugador coincide con esa búsqueda.</p>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-3xl border border-line bg-white/80 p-5">
          <div className="flex items-center gap-4">
            <PlayerAvatar
              url={puzzle.photoUrl}
              crop={puzzle.photoCrop}
              name={puzzle.name}
              className="h-20 w-20 rounded-full"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue">
                {whoRank(guesses.length, solved)}
              </p>
              <h3 className="display text-4xl text-blue-deep">{puzzle.name}</h3>
              <Link href={`/jugadores/${puzzle.slug}`} className="text-sm font-semibold text-blue hover:underline">
                Ver ficha
              </Link>
            </div>
          </div>
          <p className="mt-4 font-mono text-lg tracking-widest">{squares}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const text = `Ligamentosdle · ¿Quién es? · ${shareDay}\n${whoRank(guesses.length, solved)}\n${squares}\n${window.location.origin}/ligamentosdle`;
                const ok = await copyText(text);
                if (ok) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="rounded-full bg-blue-deep px-4 py-2 text-sm font-bold text-white"
            >
              {copied ? "Copiado" : "Copiar resultado"}
            </button>
            {practiceLabel && onPractice ? (
              <button
                type="button"
                onClick={onPractice}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-blue-deep"
              >
                {practiceLabel}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
  );
}

function WhoPractice({
  puzzles,
  roster,
  onExit,
}: {
  puzzles: WhoPuzzle[];
  roster: { slug: string; name: string }[];
  onExit: () => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [status, setStatus] = useState<WhoStatus>("playing");
  const puzzle = puzzles[cursor];

  if (!puzzle) {
    return (
      <Panel title="Práctica" onExit={onExit}>
        <p className="text-muted">No hay más jugadores con una pista distinta para hoy.</p>
      </Panel>
    );
  }

  return (
    <div>
      <WhoGame
        puzzle={puzzle}
        roster={roster}
        guesses={guesses}
        status={status}
        shareDay="Práctica"
        onExit={onExit}
        onGuess={(slug) => {
          if (status !== "playing" || guesses.includes(slug)) return;
          const next = [...guesses, slug];
          setGuesses(next);
          if (slug === puzzle.slug) setStatus("solved");
          else if (next.length >= puzzle.clues.length) setStatus("failed");
        }}
        practiceLabel={puzzles.length > 1 ? "Siguiente jugador" : undefined}
        onPractice={() => {
          setCursor((current) => (current + 1) % puzzles.length);
          setGuesses([]);
          setStatus("playing");
        }}
      />
    </div>
  );
}

function StreakGame({
  questions,
  best,
  onBest,
  onExit,
}: {
  questions: ChoiceQuestion[];
  best: number | null;
  onBest: (score: number) => void;
  onExit: () => void;
}) {
  const [order, setOrder] = useState<ChoiceQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const question = order?.[index];
  const correct = picked !== null && question && picked === question.answer;
  const failed = picked !== null && question && picked !== question.answer;

  const choose = (choiceIndex: number) => {
    if (picked !== null || !question) return;
    setPicked(choiceIndex);
    onBest(choiceIndex === question.answer ? score + 1 : score);
  };

  useEffect(() => {
    setOrder(shuffle(questions));
  }, [questions]);

  useEffect(() => {
    if (picked !== null || !question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const choice = Number(event.key) - 1;
      if (!Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) return;
      event.preventDefault();
      setPicked(choice);
      onBest(choice === question.answer ? score + 1 : score);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBest, picked, question, score]);

  const restart = () => {
    setOrder(shuffle(questions));
    setIndex(0);
    setScore(0);
    setPicked(null);
    setCleared(false);
  };

  if (order === null) {
    return (
      <Panel title="Racha" kicker={best === null ? "Racha" : `Mejor: ${best}`} onExit={onExit}>
        <p className="text-muted">Mezclando la tanda…</p>
      </Panel>
    );
  }

  if (!question && !cleared) {
    return (
      <Panel title="Racha" onExit={onExit}>
        <p className="text-muted">No hay preguntas para armar una racha.</p>
      </Panel>
    );
  }

  return (
    <Panel
      title={failed ? "Se cortó la racha" : cleared ? "Recorriste el banco" : `Racha ${score + (correct ? 1 : 0)}`}
      kicker={best === null ? "Racha" : `Mejor: ${best}`}
      onExit={onExit}
    >
      {question && !cleared ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue">
            {categoryLabel(question.category)}
          </p>
          <h3 className="mt-2 text-xl font-bold text-blue-deep md:text-2xl">{question.prompt}</h3>
          <div className="mt-4 grid gap-3">
            {question.choices.map((choice, choiceIndex) => (
              <button
                key={`${question.id}-${choice}`}
                type="button"
                disabled={picked !== null}
                onClick={() => choose(choiceIndex)}
                className={choiceClass(choiceIndex, picked, question.answer)}
              >
                <span className="mr-2 text-sm opacity-70">{choiceIndex + 1}</span>
                {choice}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {correct && question ? (
        <Reveal
          correct
          text={question.reveal}
          action={!order || index + 1 >= order.length ? "Cerrar la racha" : "Siguiente"}
          onAction={() => {
            const nextScore = score + 1;
            if (!order || index + 1 >= order.length) {
              setScore(nextScore);
              setCleared(true);
              setPicked(null);
              onBest(nextScore);
              return;
            }
            setScore(nextScore);
            setIndex((current) => current + 1);
            setPicked(null);
          }}
        />
      ) : null}
      {failed && question ? (
        <div className="mt-4">
          <Reveal correct={false} text={question.reveal} />
          <p className="mt-3 text-lg font-bold text-blue-deep">
            {score === 0
              ? "Ninguna respuesta seguida."
              : `Llegaste a ${score} ${score === 1 ? "respuesta seguida" : "respuestas seguidas"}.`}
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-4 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-blue-deep"
          >
            Otra vez
          </button>
        </div>
      ) : null}
      {cleared ? (
        <div className="mt-2">
          <p className="text-lg font-bold text-blue-deep">
            {score} respuestas sin fallar. No quedaron preguntas en esta tanda.
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-4 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-blue-deep"
          >
            Mezclar de nuevo
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

function Progress({
  answers,
  questions,
  current,
}: {
  answers: number[];
  questions: ChoiceQuestion[];
  current: number;
}) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {questions.map((question, index) => {
        const answered = index < answers.length;
        const ok = answered && answers[index] === question.answer;
        const tone = !answered
          ? index === current
            ? "bg-gold"
            : "bg-blue-deep/15"
          : ok
            ? "bg-emerald-500"
            : "bg-rose-500";
        return <span key={question.id} className={`h-1.5 flex-1 rounded-full ${tone}`} />;
      })}
    </div>
  );
}

function Reveal({
  correct,
  text,
  action,
  onAction,
}: {
  correct: boolean;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/80 px-4 py-3">
      <p className={`text-sm font-bold ${correct ? "text-emerald-700" : "text-rose-600"}`}>
        {correct ? "Correcto" : "Incorrecto"}
      </p>
      <p className="mt-1 text-sm text-blue-deep">{text}</p>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-full bg-blue-deep px-4 py-2 text-sm font-bold text-white"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  kicker,
  onExit,
  children,
}: {
  title: string;
  kicker?: string;
  onExit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="surface animate-rise rounded-3xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          {kicker ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue">{kicker}</p>
          ) : null}
          <h2 className="display text-4xl text-blue-deep">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-blue-deep hover:border-gold"
        >
          Salir
        </button>
      </div>
      <div className="gold-rule mt-3" />
      <div className="mt-4">{children}</div>
    </section>
  );
}
