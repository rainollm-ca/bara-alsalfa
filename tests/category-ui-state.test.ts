import { describe, expect, it } from "vitest";

import {
  awardQuestion,
  categoryChallengeWinner,
  createCategoryChallengeState,
  openQuestion,
  remainingQuestionSeconds,
  revealQuestionAnswer,
  setCategorySelection,
  setTeamName,
} from "../src/components/games/CategoryChallenge";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../src/games/content/categoryChallenge";

const categoryIds = CATEGORY_CHALLENGE_CATEGORIES.slice(0, 7).map(({ id }) => id);

describe("Category Challenge UI state", () => {
  it("selects exactly six unique categories and allows replacing a selection", () => {
    let state = createCategoryChallengeState();
    for (const id of categoryIds.slice(0, 6)) state = setCategorySelection(state, id);

    expect(state.selectedCategoryIds).toEqual(categoryIds.slice(0, 6));
    expect(setCategorySelection(state, categoryIds[6]).selectedCategoryIds).toEqual(
      categoryIds.slice(0, 6),
    );
    expect(setCategorySelection(state, categoryIds[2]).selectedCategoryIds).toEqual([
      categoryIds[0],
      categoryIds[1],
      categoryIds[3],
      categoryIds[4],
      categoryIds[5],
    ]);
  });

  it("stores trimmed names for both teams", () => {
    let state = createCategoryChallengeState();
    state = setTeamName(state, "teamOne", "  Falcons ");
    state = setTeamName(state, "teamTwo", " Stars  ");
    expect(state.teamNames).toEqual({ teamOne: "Falcons", teamTwo: "Stars" });
  });

  it("locks a used question as soon as it is opened", () => {
    const state = openQuestion(createCategoryChallengeState(), "science-01", 200, 5_000);
    expect(state.activeQuestion).toMatchObject({ questionId: "science-01", points: 200 });
    expect(state.usedQuestionIds.has("science-01")).toBe(true);
    expect(openQuestion(state, "science-01", 200, 8_000)).toBe(state);
  });

  it("reveals the answer without changing the timer start timestamp", () => {
    const opened = openQuestion(createCategoryChallengeState(), "science-01", 100, 12_000);
    const revealed = revealQuestionAnswer(opened);
    expect(revealed.activeQuestion?.revealed).toBe(true);
    expect(revealed.activeQuestion?.startedAt).toBe(12_000);
  });

  it("derives a 30 second countdown from timestamps", () => {
    expect(remainingQuestionSeconds(10_000, 10_000)).toBe(30);
    expect(remainingQuestionSeconds(10_000, 20_001)).toBe(20);
    expect(remainingQuestionSeconds(10_000, 40_000)).toBe(0);
  });

  it("awards or deducts question points and closes the question", () => {
    const opened = openQuestion(createCategoryChallengeState(), "science-01", 300, 0);
    const awarded = awardQuestion(opened, "teamOne", 1);
    expect(awarded.scores.teamOne).toBe(300);
    expect(awarded.activeQuestion).toBeNull();

    const second = openQuestion(awarded, "history-01", 200, 1);
    const deducted = awardQuestion(second, "teamTwo", -1);
    expect(deducted.scores.teamTwo).toBe(-200);
  });

  it("selects the leading team or a tie", () => {
    expect(categoryChallengeWinner({ teamOne: 500, teamTwo: 200 })).toBe("teamOne");
    expect(categoryChallengeWinner({ teamOne: 200, teamTwo: 500 })).toBe("teamTwo");
    expect(categoryChallengeWinner({ teamOne: 300, teamTwo: 300 })).toBe("tie");
  });
});
