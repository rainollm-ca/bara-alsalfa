import {
  CATEGORY_CHALLENGE_CATEGORIES,
  type CategoryChallengeQuestion,
} from "../content/categoryChallenge";

export const CATEGORY_CHALLENGE_POINTS = [100, 200, 300, 400, 500] as const;

export type BoardQuestion = {
  points: (typeof CATEGORY_CHALLENGE_POINTS)[number];
  question: CategoryChallengeQuestion;
  answered: boolean;
};

export type BoardCategory = {
  categoryId: string;
  title: { ar: string; en: string };
  questions: BoardQuestion[];
};

export type CategoryChallengeBoard = {
  categories: BoardCategory[];
  usedQuestionIds: ReadonlySet<string>;
};

export type TeamScores = Readonly<Record<string, number>>;

const shuffled = <T>(items: readonly T[], random: () => number): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export function buildBoard(
  selectedCategoryIds: readonly string[],
  random: () => number = Math.random,
  previouslyUsedQuestionIds: ReadonlySet<string> = new Set(),
): CategoryChallengeBoard {
  if (selectedCategoryIds.length !== 6 || new Set(selectedCategoryIds).size !== 6) {
    throw new Error("Category Challenge requires exactly six unique categories.");
  }

  const categories = selectedCategoryIds.map((categoryId) => {
    const source = CATEGORY_CHALLENGE_CATEGORIES.find(({ id }) => id === categoryId);
    if (!source) {
      throw new Error(`Unknown Category Challenge category: ${categoryId}`);
    }

    const available = source.questions.filter(
      ({ id }) => !previouslyUsedQuestionIds.has(id),
    );
    if (available.length < CATEGORY_CHALLENGE_POINTS.length) {
      throw new Error(`Not enough unused questions in category: ${categoryId}`);
    }

    return {
      categoryId,
      title: source.title,
      questions: shuffled(available, random)
        .slice(0, CATEGORY_CHALLENGE_POINTS.length)
        .map((question, index) => ({
          points: CATEGORY_CHALLENGE_POINTS[index],
          question,
          answered: false,
        })),
    };
  });

  const usedQuestionIds = new Set(previouslyUsedQuestionIds);
  for (const boardCategory of categories) {
    for (const { question } of boardCategory.questions) {
      usedQuestionIds.add(question.id);
    }
  }

  return { categories, usedQuestionIds };
}

export function answerQuestion(
  board: CategoryChallengeBoard,
  questionId: string,
): CategoryChallengeBoard {
  const target = board.categories.some(({ questions }) =>
    questions.some(({ question, answered }) => question.id === questionId && !answered),
  );
  if (!target) return board;

  return {
    ...board,
    categories: board.categories.map((category) => ({
      ...category,
      questions: category.questions.map((entry) =>
        entry.question.id === questionId ? { ...entry, answered: true } : entry,
      ),
    })),
  };
}

export function adjustTeamScore<T extends TeamScores>(
  scores: T,
  teamId: keyof T,
  adjustment: number,
): T {
  return { ...scores, [teamId]: scores[teamId] + adjustment };
}
