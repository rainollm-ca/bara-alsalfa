import type { Locale } from "../types";
import type { Category as OutOfLoopCategory } from "../content/outOfLoop";

export type { Category as OutOfLoopCategory } from "../content/outOfLoop";

export type PlayerRole = { player: string; isOutsider: boolean; word: string | null };
export type GameRound = {
  category: OutOfLoopCategory;
  categoryTitle: string;
  word: string;
  outsider: string;
  roles: PlayerRole[];
};

export function normalizePlayers(players: string[]): string[] {
  const seen = new Set<string>();
  return players.map((name) => name.trim()).filter((name) => {
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

export function buildOutOfLoopRound(
  players: string[],
  category: OutOfLoopCategory,
  locale: Locale = "ar",
  random: () => number = Math.random,
): GameRound {
  const cleanPlayers = normalizePlayers(players);
  if (cleanPlayers.length < 3) throw new Error("تحتاج اللعبة إلى 3 لاعبين على الأقل");
  const outsiderIndex = Math.floor(random() * cleanPlayers.length);
  const word = category.words[Math.floor(random() * category.words.length)][locale];
  return {
    category,
    categoryTitle: category.title[locale],
    word,
    outsider: cleanPlayers[outsiderIndex],
    roles: cleanPlayers.map((player, index) => ({
      player,
      isOutsider: index === outsiderIndex,
      word: index === outsiderIndex ? null : word,
    })),
  };
}

export function calculateOutOfLoopVote(votes: Readonly<Record<string, string>>) {
  const counts = new Map<string, number>();
  for (const name of Object.values(votes)) counts.set(name, (counts.get(name) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, count]) => count === max).map(([name]) => name);
  return { leaders, tied: leaders.length > 1 };
}

export const buildRound = buildOutOfLoopRound;
export const calculateVote = calculateOutOfLoopVote;
