import type { GameId, LocalizedText } from "../types";
import { CATEGORY_CHALLENGE_CATEGORIES } from "./categoryChallenge";
import { CATEGORIES } from "./outOfLoop";
import {
  CHARADES_PROMPTS,
  CONTENT_CATEGORY_LABELS,
  FORBIDDEN_WORD_PROMPTS,
  RAPID_FIRE_PROMPTS,
  WHO_AM_I_PROMPTS,
} from "./actionGames";

export type SelectableContentCategory = {
  id: string;
  title: LocalizedText;
};

const actionSources = {
  charades: CHARADES_PROMPTS,
  "forbidden-word": FORBIDDEN_WORD_PROMPTS,
  "rapid-fire": RAPID_FIRE_PROMPTS,
  "who-am-i": WHO_AM_I_PROMPTS,
} as const;

export function selectableCategories(gameId: GameId): SelectableContentCategory[] {
  if (gameId === "category-challenge") {
    return CATEGORY_CHALLENGE_CATEGORIES.map(({ id, title }) => ({ id, title }));
  }
  if (gameId === "out-of-loop") {
    return CATEGORIES.map(({ id, title }) => ({ id, title }));
  }
  if (gameId in actionSources) {
    const source = actionSources[gameId as keyof typeof actionSources];
    return [...new Set(source.map((prompt) => prompt.categoryId).filter(Boolean))]
      .map((id) => ({
        id: id!,
        title: CONTENT_CATEGORY_LABELS[id! as keyof typeof CONTENT_CATEGORY_LABELS] ?? { ar: id!, en: id! },
      }));
  }
  return [];
}

export function validCategorySelection(gameId: GameId, value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20 ||
    value.some((id) => typeof id !== "string")) return false;
  const allowed = new Set(selectableCategories(gameId).map((category) => category.id));
  return new Set(value).size === value.length && value.every((id) => allowed.has(id));
}
