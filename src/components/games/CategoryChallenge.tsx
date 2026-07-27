"use client";

import { ArrowLeft, ArrowRight, RotateCcw, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SetupShell } from "../SetupShell";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../../games/content/categoryChallenge";
import { buildBoard, type CategoryChallengeBoard } from "../../games/engines/categoryChallenge";
import type { Locale } from "../../lib/game";

type TeamId = "teamOne" | "teamTwo";
type ActiveQuestion = {
  questionId: string;
  points: number;
  startedAt: number;
  revealed: boolean;
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

export function openQuestion(
  state: CategoryChallengeState,
  questionId: string,
  points: number,
  startedAt: number,
) {
  if (state.activeQuestion || state.usedQuestionIds.has(questionId)) return state;
  const usedQuestionIds = new Set(state.usedQuestionIds);
  usedQuestionIds.add(questionId);
  return {
    ...state,
    usedQuestionIds,
    activeQuestion: { questionId, points, startedAt, revealed: false },
  };
}

export function revealQuestionAnswer(state: CategoryChallengeState) {
  if (!state.activeQuestion || state.activeQuestion.revealed) return state;
  return { ...state, activeQuestion: { ...state.activeQuestion, revealed: true } };
}

export function remainingQuestionSeconds(startedAt: number, now: number) {
  return Math.max(0, 30 - Math.floor((now - startedAt) / 1_000));
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
};

export function CategoryChallenge({ locale, onExit }: Props) {
  const [state, setState] = useState(createCategoryChallengeState);
  const [board, setBoard] = useState<CategoryChallengeBoard | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!state.activeQuestion) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state.activeQuestion]);

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
    ? remainingQuestionSeconds(state.activeQuestion.startedAt, now)
    : 30;

  return (
    <section className="challengeGame" aria-label={text.setup}>
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
                  type="button"
                  key={question.id}
                  disabled={used}
                  aria-label={`${category.title[locale]} ${points}`}
                  onClick={() => setState((current) => openQuestion(current, question.id, points, Date.now()))}
                >
                  {used ? "✓" : points}
                </button>
              );
            })}
          </section>
        ))}
      </div>
      <button type="button" className="ghostButton boardBack" onClick={onExit}>{backIcon}{text.back}</button>

      {state.activeQuestion && activeBoardQuestion && (
        <div className="questionBackdrop" role="presentation">
          <section className="questionModal" role="dialog" aria-modal="true" aria-labelledby="question-title">
            <div className="questionMeta">
              <b>{state.activeQuestion.points}</b>
              <span className={seconds === 0 ? "timer expired" : "timer"} aria-live="polite">
                {seconds}{text.seconds}
              </span>
            </div>
            <h2 id="question-title">{activeBoardQuestion.question.question[locale]}</h2>
            {state.activeQuestion.revealed ? (
              <>
                <p className="answerLabel">{text.answer}</p>
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
              <button type="button" className="primaryButton revealButton" onClick={() => setState(revealQuestionAnswer)}>
                {text.reveal}
              </button>
            )}
            <button type="button" className="modalClose" aria-label={text.close} onClick={() => setState((current) => ({ ...current, activeQuestion: null }))}>
              <X size={22} />
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
