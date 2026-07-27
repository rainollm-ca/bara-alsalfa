"use client";

import { ArrowLeft, ArrowRight, RotateCcw, Trophy, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { SetupShell } from "../SetupShell";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../../games/content/categoryChallenge";
import { buildBoard, type CategoryChallengeBoard } from "../../games/engines/categoryChallenge";
import type { Locale } from "../../lib/game";
import { getGameStorage } from "../../lib/useGameSessionState";
import { getSessionStore } from "../../lib/session";

type TeamId = "teamOne" | "teamTwo";
export type QuestionTimer = {
  status: "paused" | "running" | "stopped";
  remainingMs: number;
  startedAt: number | null;
};
type ActiveQuestion = {
  questionId: string;
  points: number;
  revealed: boolean;
  timer: QuestionTimer;
};

export type CategoryChallengeState = {
  selectedCategoryIds: string[];
  teamNames: Record<TeamId, string>;
  scores: Record<TeamId, number>;
  usedQuestionIds: Set<string>;
  activeQuestion: ActiveQuestion | null;
};

type StoredCategoryState = Omit<CategoryChallengeState, "usedQuestionIds"> & { usedQuestionIds: string[] };
type StoredCategoryBoard = Omit<CategoryChallengeBoard, "usedQuestionIds"> & { usedQuestionIds: string[] };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isBoundedText = (value: unknown, max = 300): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const isLocalized = (value: unknown) => isRecord(value) && isBoundedText(value.ar) && isBoundedText(value.en);
const isFiniteBounded = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const isStringArray = (value: unknown, max: number): value is string[] => Array.isArray(value) && value.length <= max && value.every((item) => isBoundedText(item, 100));

function validateStoredBoard(value: unknown): value is StoredCategoryBoard | null {
  if (value === null) return true;
  if (!isRecord(value) || !Array.isArray(value.categories) || value.categories.length !== 6 || !isStringArray(value.usedQuestionIds, 30)) return false;
  const categoryIds = new Set<string>(), questionIds = new Set<string>();
  for (const category of value.categories) {
    if (!isRecord(category) || !isBoundedText(category.categoryId, 100) || categoryIds.has(category.categoryId) || !isLocalized(category.title) || !Array.isArray(category.questions) || category.questions.length !== 5) return false;
    categoryIds.add(category.categoryId);
    for (const entry of category.questions) {
      if (!isRecord(entry) || ![100, 200, 300, 400, 500].includes(Number(entry.points)) || typeof entry.answered !== "boolean" || !isRecord(entry.question)) return false;
      const question = entry.question;
      if (!isBoundedText(question.id, 100) || questionIds.has(question.id) || !isLocalized(question.question) || !isLocalized(question.answer)) return false;
      questionIds.add(question.id);
    }
  }
  return new Set(value.usedQuestionIds).size === value.usedQuestionIds.length && value.usedQuestionIds.every((id) => questionIds.has(id));
}

function validateStoredState(value: unknown, board: StoredCategoryBoard | null, now: number): value is StoredCategoryState {
  if (!isRecord(value) || !isStringArray(value.selectedCategoryIds, 6) || new Set(value.selectedCategoryIds).size !== value.selectedCategoryIds.length || !isRecord(value.teamNames) || !isRecord(value.scores) || !isStringArray(value.usedQuestionIds, 30)) return false;
  if (typeof value.teamNames.teamOne !== "string" || value.teamNames.teamOne.length > 24 || typeof value.teamNames.teamTwo !== "string" || value.teamNames.teamTwo.length > 24) return false;
  if (!isFiniteBounded(value.scores.teamOne, -1_000_000, 1_000_000) || !isFiniteBounded(value.scores.teamTwo, -1_000_000, 1_000_000) || new Set(value.usedQuestionIds).size !== value.usedQuestionIds.length) return false;
  if (board === null) return value.activeQuestion === null && value.usedQuestionIds.length === 0;
  const categoryIds = board.categories.map((category) => category.categoryId);
  const questionIds = new Set(board.categories.flatMap((category) => category.questions.map((entry) => entry.question.id)));
  if (value.selectedCategoryIds.length !== 6 || value.selectedCategoryIds.some((id, index) => id !== categoryIds[index]) || value.usedQuestionIds.some((id) => !questionIds.has(id))) return false;
  if (value.activeQuestion === null) return true;
  const active = value.activeQuestion;
  if (!isRecord(active) || !isBoundedText(active.questionId, 100) || !questionIds.has(active.questionId) || ![100, 200, 300, 400, 500].includes(Number(active.points)) || typeof active.revealed !== "boolean" || !isRecord(active.timer)) return false;
  const timer = active.timer;
  if (!["paused", "running", "stopped"].includes(String(timer.status)) || !isFiniteBounded(timer.remainingMs, 0, 30_000)) return false;
  return timer.status === "running"
    ? isFiniteBounded(timer.startedAt, now - 7 * 86_400_000, now + 60_000)
    : timer.startedAt === null;
}

export function createCategoryChallengeState(): CategoryChallengeState {
  return {
    selectedCategoryIds: [],
    teamNames: { teamOne: "", teamTwo: "" },
    scores: { teamOne: 0, teamTwo: 0 },
    usedQuestionIds: new Set(),
    activeQuestion: null,
  };
}

export function setCategorySelection(state: CategoryChallengeState, categoryId: string) {
  if (state.selectedCategoryIds.includes(categoryId)) {
    return {
      ...state,
      selectedCategoryIds: state.selectedCategoryIds.filter((id) => id !== categoryId),
    };
  }
  if (state.selectedCategoryIds.length === 6) return state;
  return { ...state, selectedCategoryIds: [...state.selectedCategoryIds, categoryId] };
}

export function setTeamName(state: CategoryChallengeState, team: TeamId, name: string) {
  return { ...state, teamNames: { ...state.teamNames, [team]: name.trim() } };
}

export function createQuestionTimer(): QuestionTimer {
  return { status: "paused", remainingMs: 30_000, startedAt: null };
}

const remainingMilliseconds = (timer: QuestionTimer, now: number) =>
  Math.max(
    0,
    Math.min(
      30_000,
      timer.status === "running" && timer.startedAt !== null
        ? timer.remainingMs - Math.max(0, now - timer.startedAt)
        : timer.remainingMs,
    ),
  );

export function startQuestionTimer(timer: QuestionTimer, now: number): QuestionTimer {
  if (timer.status !== "paused") return timer;
  return { ...timer, status: "running", startedAt: now };
}

export function pauseQuestionTimer(timer: QuestionTimer, now: number): QuestionTimer {
  if (timer.status !== "running") return timer;
  return {
    status: "paused",
    remainingMs: remainingMilliseconds(timer, now),
    startedAt: null,
  };
}

export function resumeQuestionTimer(timer: QuestionTimer, now: number): QuestionTimer {
  return startQuestionTimer(timer, now);
}

export function stopQuestionTimer(timer: QuestionTimer, now: number): QuestionTimer {
  return {
    status: "stopped",
    remainingMs: remainingMilliseconds(timer, now),
    startedAt: null,
  };
}

export function openQuestion(
  state: CategoryChallengeState,
  questionId: string,
  points: number,
) {
  if (state.activeQuestion || state.usedQuestionIds.has(questionId)) return state;
  const usedQuestionIds = new Set(state.usedQuestionIds);
  usedQuestionIds.add(questionId);
  return {
    ...state,
    usedQuestionIds,
    activeQuestion: { questionId, points, revealed: false, timer: createQuestionTimer() },
  };
}

export function revealQuestionAnswer(state: CategoryChallengeState, now = Date.now()) {
  if (!state.activeQuestion || state.activeQuestion.revealed) return state;
  return {
    ...state,
    activeQuestion: {
      ...state.activeQuestion,
      revealed: true,
      timer: stopQuestionTimer(state.activeQuestion.timer, now),
    },
  };
}

export function remainingQuestionSeconds(timer: QuestionTimer, now: number) {
  return Math.max(0, Math.min(30, Math.ceil(remainingMilliseconds(timer, now) / 1_000)));
}

export function awardQuestion(
  state: CategoryChallengeState,
  team: TeamId,
  direction: 1 | -1,
) {
  if (!state.activeQuestion) return state;
  return {
    ...state,
    scores: {
      ...state.scores,
      [team]: state.scores[team] + state.activeQuestion.points * direction,
    },
    activeQuestion: null,
  };
}

export function categoryChallengeWinner(scores: Record<TeamId, number>): TeamId | "tie" {
  if (scores.teamOne === scores.teamTwo) return "tie";
  return scores.teamOne > scores.teamTwo ? "teamOne" : "teamTwo";
}

export function restoreCategoryController(
  controller: unknown,
  now = Date.now(),
): { state: CategoryChallengeState; board: CategoryChallengeBoard | null } | null {
  try {
    if (!isRecord(controller) || !validateStoredBoard(controller.board) || !validateStoredState(controller.categoryState, controller.board, now)) return null;
    const storedBoard = controller.board;
    const board = storedBoard === null ? null : { ...storedBoard, usedQuestionIds: new Set(storedBoard.usedQuestionIds) };
    const stored = controller.categoryState;
    const activeQuestion = stored.activeQuestion
      ? {
          ...stored.activeQuestion,
          revealed: false,
          timer: stored.activeQuestion.timer.status === "running"
            ? {
                status: "running" as const,
                remainingMs: remainingMilliseconds(stored.activeQuestion.timer, now),
                startedAt: now,
              }
            : stored.activeQuestion.timer,
        }
      : null;
    return { state: { ...stored, usedQuestionIds: new Set(stored.usedQuestionIds), activeQuestion }, board };
  } catch {
    return null;
  }
}

type Props = {
  locale: Locale;
  onExit: () => void;
  initialSession?: Readonly<{
    state: CategoryChallengeState;
    board: CategoryChallengeBoard;
  }>;
};

export function CategoryChallenge({ locale, onExit, initialSession }: Props) {
  const readSaved = () => {
    const storage = getGameStorage();
    const saved = storage ? getSessionStore(storage).read() : null;
    return saved?.gameId === "category-challenge"
      ? restoreCategoryController(saved.controller)
      : null;
  };
  const [state, setState] = useState<CategoryChallengeState>(
    () => initialSession?.state ?? readSaved()?.state ?? createCategoryChallengeState(),
  );
  const [board, setBoard] = useState<CategoryChallengeBoard | null>(
    () => initialSession?.board ?? readSaved()?.board ?? null,
  );
  const [now, setNow] = useState(0);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const answerHeadingRef = useRef<HTMLHeadingElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const triggeringCellRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const storage = getGameStorage();
    if (!storage) return;
    getSessionStore(storage).replace("category-challenge", locale, {
        categoryState: { ...state, usedQuestionIds: [...state.usedQuestionIds] },
        board: board ? { ...board, usedQuestionIds: [...board.usedQuestionIds] } : null,
    });
  }, [board, locale, state]);

  useEffect(() => {
    if (state.activeQuestion?.timer.status !== "running") return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      setState((current) => {
        if (
          !current.activeQuestion
          || current.activeQuestion.timer.status !== "running"
          || remainingQuestionSeconds(current.activeQuestion.timer, timestamp) > 0
        ) return current;
        return {
          ...current,
          activeQuestion: {
            ...current.activeQuestion,
            timer: stopQuestionTimer(current.activeQuestion.timer, timestamp),
          },
        };
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [state.activeQuestion?.timer.status]);

  useEffect(() => {
    const boardElement = boardRef.current;
    if (state.activeQuestion) {
      boardElement?.setAttribute("inert", "");
      dialogTitleRef.current?.focus();
    } else {
      boardElement?.removeAttribute("inert");
      triggeringCellRef.current?.focus();
    }
    return () => boardElement?.removeAttribute("inert");
  }, [state.activeQuestion?.questionId]);

  useEffect(() => {
    if (state.activeQuestion?.revealed) answerHeadingRef.current?.focus();
  }, [state.activeQuestion?.revealed]);

  const activeBoardQuestion = useMemo(() => {
    if (!board || !state.activeQuestion) return null;
    return board.categories
      .flatMap(({ questions }) => questions)
      .find(({ question }) => question.id === state.activeQuestion?.questionId) ?? null;
  }, [board, state.activeQuestion]);

  const complete = Boolean(board) && state.usedQuestionIds.size === 30 && !state.activeQuestion;
  const winner = categoryChallengeWinner(state.scores);
  const backIcon = locale === "ar" ? <ArrowRight size={20} /> : <ArrowLeft size={20} />;
  const text = locale === "ar" ? {
    setup: "جهّزوا تحدّي الفئات",
    setupHint: "اختاروا ٦ فئات وسمّوا الفريقين.",
    categories: "الفئات",
    selected: "مختارة",
    teamOne: "اسم الفريق الأول",
    teamTwo: "اسم الفريق الثاني",
    start: "ابدأوا التحدّي",
    back: "رجوع",
    reveal: "أظهر الإجابة",
    answer: "الإجابة",
    correct: "إجابة صحيحة",
    wrong: "إجابة خاطئة",
    close: "إغلاق السؤال",
    finished: "انتهى التحدّي!",
    tie: "تعادل!",
    wins: "يفوز",
    restart: "العبوا من جديد",
    seconds: "ث",
    startTimer: "ابدأ المؤقت",
    pauseTimer: "أوقف المؤقت",
    resumeTimer: "تابع المؤقت",
  } : {
    setup: "Set up Category Challenge",
    setupHint: "Choose 6 categories and name both teams.",
    categories: "Categories",
    selected: "selected",
    teamOne: "Team one name",
    teamTwo: "Team two name",
    start: "Start challenge",
    back: "Back",
    reveal: "Reveal answer",
    answer: "Answer",
    correct: "Correct answer",
    wrong: "Wrong answer",
    close: "Close question",
    finished: "Challenge complete!",
    tie: "It's a tie!",
    wins: "wins",
    restart: "Play again",
    seconds: "s",
    startTimer: "Start timer",
    pauseTimer: "Pause timer",
    resumeTimer: "Resume timer",
  };

  function restart() {
    setState(createCategoryChallengeState());
    setBoard(null);
  }

  if (!board) {
    const ready = state.selectedCategoryIds.length === 6
      && Boolean(state.teamNames.teamOne.trim())
      && Boolean(state.teamNames.teamTwo.trim());
    return (
      <SetupShell title={text.setup} hint={text.setupHint}>
        <div className="challengeSetup">
          <fieldset className="setupField categoryField">
            <legend>{text.categories} · {state.selectedCategoryIds.length}/6 {text.selected}</legend>
            <div className="categories challengeCategories">
              {CATEGORY_CHALLENGE_CATEGORIES.map((category) => {
                const selected = state.selectedCategoryIds.includes(category.id);
                return (
                  <button
                    data-action="primary"
                    type="button"
                    key={category.id}
                    className={selected ? "category active" : "category"}
                    aria-pressed={selected}
                    onClick={() => setState((current) => setCategorySelection(current, category.id))}
                  >
                    <span>{category.title[locale]}</span>
                    <b aria-hidden="true">{selected ? "✓" : "+"}</b>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="teamNameGrid">
            {(["teamOne", "teamTwo"] as const).map((team) => (
              <label className="setupField teamNameField" key={team}>
                <span>{text[team]}</span>
                <input
                  value={state.teamNames[team]}
                  maxLength={24}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      teamNames: { ...current.teamNames, [team]: event.target.value },
                    }))
                  }
                  onBlur={() => setState((current) => setTeamName(current, team, current.teamNames[team]))}
                />
              </label>
            ))}
          </div>
          <div className="challengeActions">
            <button type="button" className="ghostButton" onClick={onExit}>{backIcon}{text.back}</button>
            <button
              data-action="primary"
              type="button"
              className="primaryButton"
              disabled={!ready}
              onClick={() => {
                setState((current) => ({
                  ...current,
                  teamNames: {
                    teamOne: current.teamNames.teamOne.trim(),
                    teamTwo: current.teamNames.teamTwo.trim(),
                  },
                }));
                setBoard(buildBoard(state.selectedCategoryIds));
              }}
            >
              {text.start}
            </button>
          </div>
        </div>
      </SetupShell>
    );
  }

  if (complete) {
    return (
      <section className="panel challengeResult" aria-live="polite">
        <Trophy size={54} aria-hidden="true" />
        <h1>{text.finished}</h1>
        <p>{winner === "tie" ? text.tie : `${state.teamNames[winner]} ${text.wins}!`}</p>
        <div className="resultScores">
          <b>{state.teamNames.teamOne}<span>{state.scores.teamOne}</span></b>
          <b>{state.teamNames.teamTwo}<span>{state.scores.teamTwo}</span></b>
        </div>
        <div className="challengeActions">
          <button type="button" className="ghostButton" onClick={onExit}>{backIcon}{text.back}</button>
          <button type="button" className="primaryButton" onClick={restart}><RotateCcw size={19} />{text.restart}</button>
        </div>
      </section>
    );
  }

  const seconds = state.activeQuestion
    ? remainingQuestionSeconds(state.activeQuestion.timer, now)
    : 30;

  function closeQuestion() {
    setState((current) => ({ ...current, activeQuestion: null }));
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && state.activeQuestion?.timer.status !== "running") {
      event.preventDefault();
      closeQuestion();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (
      document.activeElement === first
      || document.activeElement === dialogTitleRef.current
      || document.activeElement === answerHeadingRef.current
    )) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <section className="challengeGame" aria-label={text.setup}>
      <div ref={boardRef} aria-hidden={state.activeQuestion ? "true" : undefined}>
        <div className="scoreStrip">
          {(["teamOne", "teamTwo"] as const).map((team) => (
            <div key={team}><span>{state.teamNames[team]}</span><b>{state.scores[team]}</b></div>
          ))}
        </div>
        <div className="challengeBoard">
          {board.categories.map((category) => (
            <section className="boardColumn" key={category.categoryId}>
              <h2>{category.title[locale]}</h2>
              {category.questions.map(({ points, question }) => {
                const used = state.usedQuestionIds.has(question.id);
                return (
                  <button
                    data-action="primary"
                    type="button"
                    key={question.id}
                    aria-disabled={used}
                    aria-label={`${category.title[locale]} ${points}`}
                    onClick={(event) => {
                      if (used) return;
                      triggeringCellRef.current = event.currentTarget;
                      setState((current) => openQuestion(current, question.id, points));
                    }}
                  >
                    {used ? "✓" : points}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
        <button type="button" className="ghostButton boardBack" onClick={onExit}>{backIcon}{text.back}</button>
      </div>

      {state.activeQuestion && activeBoardQuestion && (
        <div className="questionBackdrop" role="presentation">
          <section className="questionModal" role="dialog" aria-modal="true" aria-labelledby="question-title" onKeyDown={handleDialogKeyDown}>
            <div className="questionMeta">
              <b>{state.activeQuestion.points}</b>
              <span className={seconds === 0 ? "timer expired" : "timer"} aria-live="polite">
                {seconds}{text.seconds}
              </span>
            </div>
            <h2 id="question-title" ref={dialogTitleRef} tabIndex={-1}>{activeBoardQuestion.question.question[locale]}</h2>
            {!state.activeQuestion.revealed && seconds > 0 && (
              <button
                type="button"
                className="timerButton"
                onClick={() => {
                  const timestamp = Date.now();
                  setNow(timestamp);
                  setState((current) => {
                    if (!current.activeQuestion) return current;
                    const timer = current.activeQuestion.timer.status === "running"
                      ? pauseQuestionTimer(current.activeQuestion.timer, timestamp)
                      : current.activeQuestion.timer.remainingMs === 30_000
                        ? startQuestionTimer(current.activeQuestion.timer, timestamp)
                        : resumeQuestionTimer(current.activeQuestion.timer, timestamp);
                    return { ...current, activeQuestion: { ...current.activeQuestion, timer } };
                  });
                }}
              >
                {state.activeQuestion.timer.status === "running"
                  ? text.pauseTimer
                  : state.activeQuestion.timer.remainingMs === 30_000
                    ? text.startTimer
                    : text.resumeTimer}
              </button>
            )}
            {state.activeQuestion.revealed ? (
              <>
                <h3 className="answerLabel" ref={answerHeadingRef} tabIndex={-1}>{text.answer}</h3>
                <p className="answerText">{activeBoardQuestion.question.answer[locale]}</p>
                <div className="scoreButtons">
                  {(["teamOne", "teamTwo"] as const).map((team) => (
                    <div key={team}>
                      <b>{state.teamNames[team]}</b>
                      <button type="button" className="correctButton" onClick={() => setState((current) => awardQuestion(current, team, 1))}>+ {text.correct}</button>
                      <button type="button" className="wrongButton" onClick={() => setState((current) => awardQuestion(current, team, -1))}>− {text.wrong}</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <button type="button" className="primaryButton revealButton" onClick={() => setState((current) => revealQuestionAnswer(current, Date.now()))}>
                {text.reveal}
              </button>
            )}
            <button type="button" className="modalClose" aria-label={text.close} onClick={closeQuestion}>
              <X size={22} />
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
