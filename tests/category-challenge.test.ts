import { describe, expect, expectTypeOf, it } from "vitest";

import { CATEGORY_CHALLENGE_CATEGORIES } from "../src/games/content/categoryChallenge";
import {
  adjustTeamScore,
  answerQuestion,
  buildBoard,
} from "../src/games/engines/categoryChallenge";
import { restoreCategoryController } from "../src/components/games/CategoryChallenge";

const selectedCategoryIds = CATEGORY_CHALLENGE_CATEGORIES.slice(0, 6).map(
  (category) => category.id,
);

describe("category challenge content", () => {
  it("offers at least eight selectable bilingual categories with ten questions each", () => {
    expect(CATEGORY_CHALLENGE_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CATEGORY_CHALLENGE_CATEGORIES.map(({ id }) => id)).size).toBe(
      CATEGORY_CHALLENGE_CATEGORIES.length,
    );

    for (const category of CATEGORY_CHALLENGE_CATEGORIES) {
      expect(category.id.trim()).not.toBe("");
      expect(category.title.ar.trim()).not.toBe("");
      expect(category.title.en.trim()).not.toBe("");
      expect(category.questions.length).toBeGreaterThanOrEqual(10);
      expect(new Set(category.questions.map(({ id }) => id)).size).toBe(
        category.questions.length,
      );

      for (const question of category.questions) {
        expect(question.id.trim()).not.toBe("");
        expect(question.question.ar.trim()).not.toBe("");
        expect(question.question.en.trim()).not.toBe("");
        expect(question.answer.ar.trim()).not.toBe("");
        expect(question.answer.en.trim()).not.toBe("");
      }
    }
  });
});

describe("buildBoard", () => {
  it("builds six selected categories with five unique 100–500 questions each", () => {
    const board = buildBoard(selectedCategoryIds, () => 0);

    expect(board.categories).toHaveLength(6);
    expect(board.categories.map(({ categoryId }) => categoryId)).toEqual(
      selectedCategoryIds,
    );

    for (const category of board.categories) {
      expect(category.questions.map(({ points }) => points)).toEqual([
        100, 200, 300, 400, 500,
      ]);
      expect(new Set(category.questions.map(({ question }) => question.id)).size).toBe(5);
      expect(category.questions.every(({ answered }) => !answered)).toBe(true);
    }
  });

  it("does not repeat questions across successive boards when unused questions remain", () => {
    const first = buildBoard(selectedCategoryIds, () => 0);
    const second = buildBoard(selectedCategoryIds, () => 0, first.usedQuestionIds);

    for (const categoryId of selectedCategoryIds) {
      const firstIds = first.categories
        .find((category) => category.categoryId === categoryId)!
        .questions.map(({ question }) => question.id);
      const secondIds = second.categories
        .find((category) => category.categoryId === categoryId)!
        .questions.map(({ question }) => question.id);

      expect(secondIds).not.toEqual(firstIds);
      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    }
  });

  it("isolates board values from the exported question bank and future boards", () => {
    const first = buildBoard(selectedCategoryIds, () => 0);
    const sourceCategory = CATEGORY_CHALLENGE_CATEGORIES.find(
      ({ id }) => id === first.categories[0].categoryId,
    )!;
    const sourceQuestion = sourceCategory.questions.find(
      ({ id }) => id === first.categories[0].questions[0].question.id,
    )!;

    expect(first.categories[0].title).not.toBe(sourceCategory.title);
    expect(first.categories[0].questions[0].question).not.toBe(sourceQuestion);

    const originalTitle = sourceCategory.title.en;
    const originalQuestion = sourceQuestion.question.en;
    (
      first.categories[0].title as { en: string }
    ).en = "corrupted board title";
    (
      first.categories[0].questions[0].question.question as { en: string }
    ).en = "corrupted board question";

    const second = buildBoard(selectedCategoryIds, () => 0);
    expect(sourceCategory.title.en).toBe(originalTitle);
    expect(sourceQuestion.question.en).toBe(originalQuestion);
    expect(second.categories[0].title.en).toBe(originalTitle);
  });
});

describe("immutable game updates", () => {
  it("marks an answer without mutating the previous board", () => {
    const board = buildBoard(selectedCategoryIds, () => 0);
    const questionId = board.categories[0].questions[0].question.id;

    const updated = answerQuestion(board, questionId);

    expect(updated).not.toBe(board);
    expect(board.categories[0].questions[0].answered).toBe(false);
    expect(updated.categories[0].questions[0].answered).toBe(true);
    expect(answerQuestion(updated, questionId)).toBe(updated);
  });

  it("adjusts a team score without mutating the previous scores", () => {
    const scores = { teamOne: 300, teamTwo: 500 } as const;

    const updated = adjustTeamScore(scores, "teamOne", 200);

    expectTypeOf(updated).toEqualTypeOf<
      Readonly<Record<"teamOne" | "teamTwo", number>>
    >();
    expect(updated).toEqual({ teamOne: 500, teamTwo: 500 });
    expect(updated).not.toBe(scores);
    expect(scores).toEqual({ teamOne: 300, teamTwo: 500 });
  });
});

describe("persisted Category Challenge controller validation", () => {
  const board = buildBoard(selectedCategoryIds, () => 0);
  const storedBoard = { ...board, usedQuestionIds: [...board.usedQuestionIds] };
  const baseState = {
    selectedCategoryIds,
    teamNames: { teamOne: "One", teamTwo: "Two" },
    scores: { teamOne: 0, teamTwo: 0 },
    usedQuestionIds: [],
    activeQuestion: null,
  };

  it("restores a deeply valid board and covers a revealed active question", () => {
    const question = board.categories[0].questions[0];
    const restored = restoreCategoryController({
      board: storedBoard,
      categoryState: {
        ...baseState,
        usedQuestionIds: [question.question.id],
        activeQuestion: {
          questionId: question.question.id,
          points: question.points,
          revealed: true,
          timer: { status: "paused", remainingMs: 20_000, startedAt: null },
        },
      },
    });
    expect(restored?.state.activeQuestion?.revealed).toBe(false);
    expect(restored?.board?.usedQuestionIds).toBeInstanceOf(Set);
  });

  it.each([
    ["null controller", null],
    ["missing active shape", { board: storedBoard, categoryState: { ...baseState, activeQuestion: {} } }],
    ["wrong board array", { board: { ...storedBoard, categories: null }, categoryState: baseState }],
    ["serialized Set object", { board: { ...storedBoard, usedQuestionIds: {} }, categoryState: baseState }],
    ["wrong used IDs", { board: storedBoard, categoryState: { ...baseState, usedQuestionIds: ["unknown"] } }],
    ["NaN score", { board: storedBoard, categoryState: { ...baseState, scores: { teamOne: Number.NaN, teamTwo: 0 } } }],
    ["huge score", { board: storedBoard, categoryState: { ...baseState, scores: { teamOne: 1e99, teamTwo: 0 } } }],
    ["bad timer enum", { board: storedBoard, categoryState: { ...baseState, activeQuestion: { questionId: board.categories[0].questions[0].question.id, points: 100, revealed: false, timer: { status: "oops", remainingMs: 5, startedAt: null } } } }],
    ["future timestamp", { board: storedBoard, categoryState: { ...baseState, activeQuestion: { questionId: board.categories[0].questions[0].question.id, points: 100, revealed: false, timer: { status: "running", remainingMs: 5, startedAt: Date.now() + 100_000 } } } }],
  ])("rejects %s without throwing", (_label, payload) => {
    expect(() => restoreCategoryController(payload)).not.toThrow();
    expect(restoreCategoryController(payload)).toBeNull();
  });
});
