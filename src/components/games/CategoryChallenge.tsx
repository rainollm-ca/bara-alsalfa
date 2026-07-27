"use client";

import { ArrowLeft, ArrowRight, RotateCcw, Trophy, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { SetupShell } from "../SetupShell";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../../games/content/categoryChallenge";
import { buildBoard, type CategoryChallengeBoard } from "../../games/engines/categoryChallenge";
import type { Locale } from "../../lib/game";
import { getGameStorage, useGameSessionState } from "../../lib/useGameSessionState";
import { parseSavedSession, serializeSavedSession, SESSION_KEY } from "../../lib/session";

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

type Props = {
  locale: Locale;
  onExit: () => void;
  initialSession?: Readonly<{
    state: CategoryChallengeState;
    board: CategoryChallengeBoard;
  }>;
};

export function CategoryChallenge({ locale, onExit, initialSession }: Props) {
  const [state, setState] = useState<CategoryChallengeState>(
    () => {
      if (initialSession?.state) return initialSession.state;
      const storage = getGameStorage();
      if (!storage) return createCategoryChallengeState();
      const saved = parseSavedSession(storage.getItem(SESSION_KEY));
      const value = saved?.gameId === "category-challenge" ? saved.controller.categoryState : null;
      if (!value || typeof value !== "object") return createCategoryChallengeState();
      const candidate = value as Omit<CategoryChallengeState, "usedQuestionIds"> & { usedQuestionIds: string[] };
      if (!Array.isArray(candidate.selectedCategoryIds) || !Array.isArray(candidate.usedQuestionIds)) return createCategoryChallengeState();
      const activeQuestion = candidate.activeQuestion
        ? {
            ...candidate.activeQuestion,
            revealed: false,
            timer: candidate.activeQuestion.timer.status === "running" && remainingQuestionSeconds(candidate.activeQuestion.timer, Date.now()) === 0
              ? stopQuestionTimer(candidate.activeQuestion.timer, Date.now())
              : candidate.activeQuestion.timer,
          }
        : null;
      return { ...candidate, usedQuestionIds: new Set(candidate.usedQuestionIds), activeQuestion };
    },
  );
  const [board, setBoard] = useGameSessionState<CategoryChallengeBoard | null>(
    "category-challenge",
    locale,
    "board",
    () => initialSession?.board ?? null,
    (value): value is CategoryChallengeBoard | null => value === null || (typeof value === "object" && value !== null && Array.isArray((value as CategoryChallengeBoard).categories)),
  );
  const [now, setNow] = useState(0);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const answerHeadingRef = useRef<HTMLHeadingElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const triggeringCellRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const storage = getGameStorage();
    if (!storage) return;
    const existing = parseSavedSession(storage.getItem(SESSION_KEY));
    const controller = existing?.gameId === "category-challenge" ? existing.controller : {};
    storage.setItem(SESSION_KEY, serializeSavedSession({
      gameId: "category-challenge",
      locale,
      updatedAt: Date.now(),
      controller: { ...controller, categoryState: { ...state, usedQuestionIds: [...state.usedQuestionIds] } },
    }));
  }, [locale, state]);

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
