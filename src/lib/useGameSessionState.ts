"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { GameId } from "../games/types";
import type { Locale } from "./game";
import { getSessionStore } from "./session";

type Validator<T> = (value: unknown) => value is T;

export const isShortString = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 200;
export const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 20 && value.every(isShortString);
export const isSafeInteger = (min: number, max: number) =>
  (value: unknown): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
export const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const isLocalizedText = (value: unknown) =>
  isPlainRecord(value) && isShortString(value.ar) && isShortString(value.en);
export const isFiniteScoreRecord = (value: unknown): value is Record<string, number> =>
  isPlainRecord(value) && Object.keys(value).length <= 20 &&
  Object.entries(value).every(([key, score]) => key.length > 0 && key.length <= 200 && typeof score === "number" && Number.isFinite(score) && Math.abs(score) <= 1_000_000);
export const isActionPrompt = (value: unknown): value is {
  id: string;
  text: { ar: string; en: string };
  forbidden?: Array<{ ar: string; en: string }>;
} =>
  isPlainRecord(value) && isShortString(value.id) && isLocalizedText(value.text) &&
  (!Object.hasOwn(value, "forbidden") || (Array.isArray(value.forbidden) && value.forbidden.length <= 20 && value.forbidden.every(isLocalizedText)));
export const isPromptDrawState = (value: unknown): value is {
  prompt: { id: string; text: { ar: string; en: string }; forbidden?: Array<{ ar: string; en: string }> } | null;
  deck: { remaining: Array<{ id: string; text: { ar: string; en: string }; forbidden?: Array<{ ar: string; en: string }> }> };
} =>
  isPlainRecord(value) && (value.prompt === null || isActionPrompt(value.prompt)) &&
  isPlainRecord(value.deck) && Array.isArray(value.deck.remaining) &&
  value.deck.remaining.length <= 500 && value.deck.remaining.every(isActionPrompt);
export const isOutOfLoopRound = (value: unknown) => {
  if (!isPlainRecord(value) || !isPlainRecord(value.category) || !isShortString(value.categoryTitle) || !isShortString(value.word) || !isShortString(value.outsider) || !Array.isArray(value.roles) || value.roles.length < 3 || value.roles.length > 12) return false;
  if (!isShortString(value.category.id) || !isLocalizedText(value.category.title) || !Array.isArray(value.category.words) || value.category.words.length > 100 || !value.category.words.every(isLocalizedText)) return false;
  return value.roles.every((role) => isPlainRecord(role) && isShortString(role.player) && typeof role.isOutsider === "boolean" && (role.word === null || isShortString(role.word)));
};
export const isTwoTruthsRound = (value: unknown): value is {
  playerId: string;
  statements: [string, string, string];
  lieIndex: number;
  revealed: boolean;
} =>
  isPlainRecord(value) && isShortString(value.playerId) &&
  Array.isArray(value.statements) && value.statements.length === 3 &&
  value.statements.every(isShortString) && [0, 1, 2].includes(Number(value.lieIndex)) &&
  typeof value.revealed === "boolean";
export function getGameStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

const dangerousObjectKeys = new Set(["__proto__", "prototype", "constructor"]);

export function isWhoAmIController(controller: Record<string, unknown>) {
  try {
    const { players, identities, index, revealed, playing } = controller;
    if (
      !isStringList(players) || players.length < 2 || players.length > 12 ||
      new Set(players).size !== players.length ||
      players.some((player) => !player.trim() || dangerousObjectKeys.has(player)) ||
      !isPlainRecord(identities) ||
      (Object.getPrototypeOf(identities) !== Object.prototype && Object.getPrototypeOf(identities) !== null) ||
      !Number.isInteger(index) || Number(index) < 0 || Number(index) >= players.length ||
      typeof revealed !== "boolean" || typeof playing !== "boolean"
    ) return false;
    const identityKeys = Object.keys(identities);
    if (
      identityKeys.length !== players.length ||
      identityKeys.some((key) => dangerousObjectKeys.has(key)) ||
      [...identityKeys].sort().some((key, itemIndex) => key !== [...players].sort()[itemIndex])
    ) return false;
    const promptIds = new Set<string>();
    for (const player of players) {
      const prompt = identities[player];
      if (!isActionPrompt(prompt) || promptIds.has(prompt.id)) return false;
      promptIds.add(prompt.id);
    }
    return playing ? revealed === true && index === players.length - 1 : true;
  } catch {
    return false;
  }
}

const isUniqueRoster = (value: unknown, min: number, max: number): value is string[] =>
  isStringList(value) && value.length >= min && value.length <= max &&
  new Set(value).size === value.length && value.every((item) => Boolean(item.trim()));

export function isMostLikelyController(controller: Record<string, unknown>) {
  try {
    const phase = controller.phase;
    if (phase === undefined || phase === "setup") return controller.players === undefined || (isStringList(controller.players) && new Set(controller.players).size === controller.players.length);
    if (!["pass", "vote", "result"].includes(String(phase)) || !isUniqueRoster(controller.players, 3, 16)) return false;
    const players = controller.players;
    if (!Number.isInteger(controller.voter) || Number(controller.voter) < 0 || Number(controller.voter) >= players.length || !isStringList(controller.votes) || !isShortString(controller.choice)) return false;
    const voter = Number(controller.voter), votes = controller.votes;
    if (votes.some((vote) => !players.includes(vote))) return false;
    return phase === "result"
      ? votes.length === players.length && voter === players.length - 1
      : votes.length === voter;
  } catch { return false; }
}

export function isTwoTruthsController(controller: Record<string, unknown>) {
  try {
    const phase = controller.phase;
    if (phase === undefined || phase === "setup") return controller.players === undefined || (isStringList(controller.players) && new Set(controller.players).size === controller.players.length);
    if (!["entry-pass", "entry", "round-pass", "vote", "reveal"].includes(String(phase)) || !isUniqueRoster(controller.players, 3, 12)) return false;
    const players = controller.players;
    if (!Number.isInteger(controller.storyteller) || Number(controller.storyteller) < 0 || Number(controller.storyteller) >= players.length ||
      !Array.isArray(controller.statements) || controller.statements.length !== 3 || !controller.statements.every(isShortString) ||
      ![0, 1, 2].includes(Number(controller.lie))) return false;
    if (phase === "entry-pass" || phase === "entry") return controller.round === null || controller.round === undefined;
    if (!isTwoTruthsRound(controller.round) || controller.round.playerId !== players[Number(controller.storyteller)] || !isStringList(controller.voters)) return false;
    const expectedVoters = players.filter((_, index) => index !== Number(controller.storyteller));
    if (controller.voters.some((player, index) => player !== expectedVoters[index]) || controller.voters.length !== expectedVoters.length ||
      !Number.isInteger(controller.voter) || Number(controller.voter) < 0 || Number(controller.voter) >= expectedVoters.length ||
      !Array.isArray(controller.votes) || controller.votes.some((vote) => ![0, 1, 2].includes(Number(vote)))) return false;
    return phase === "reveal"
      ? controller.votes.length === expectedVoters.length && Number(controller.voter) === expectedVoters.length - 1
      : controller.votes.length === Number(controller.voter);
  } catch { return false; }
}

export function isTimedGameController(gameId: "charades" | "forbidden-word" | "rapid-fire", controller: Record<string, unknown>) {
  try {
    const screen = controller.screen;
    if (screen === undefined || screen === "setup") return controller.teams === undefined || (isStringList(controller.teams) && new Set(controller.teams).size === controller.teams.length);
    if (!["round", "final"].includes(String(screen)) || !isUniqueRoster(controller.teams, 2, gameId === "rapid-fire" ? 12 : 8) || !isFiniteScoreRecord(controller.scores)) return false;
    const teams = controller.teams;
    if (Object.keys(controller.scores).length !== teams.length || Object.keys(controller.scores).some((team) => !teams.includes(team))) return false;
    const totalTurns = teams.length * (gameId === "rapid-fire" ? 1 : 2);
    if (!Number.isInteger(controller.turn) || Number(controller.turn) < 0 || Number(controller.turn) >= totalTurns) return false;
    if (screen === "final") return Number(controller.turn) === totalTurns - 1;
    if (!isPromptDrawState(controller.drawState) || typeof controller.expired !== "boolean") return false;
    const ids = [
      ...(controller.drawState.prompt ? [controller.drawState.prompt.id] : []),
      ...controller.drawState.deck.remaining.map((prompt) => prompt.id),
    ];
    if (new Set(ids).size !== ids.length) return false;
    if (controller.timer !== undefined) {
      if (!isPlainRecord(controller.timer) || !["ready", "running", "paused", "expired"].includes(String(controller.timer.status)) ||
        typeof controller.timer.remainingMs !== "number" || !Number.isFinite(controller.timer.remainingMs) ||
        controller.timer.remainingMs < 0 || controller.timer.remainingMs > 90_000) return false;
      if (controller.timer.status === "running") {
        if (typeof controller.timer.startedAt !== "number" || !Number.isFinite(controller.timer.startedAt) ||
          controller.timer.startedAt < Date.now() - 7 * 86_400_000 || controller.timer.startedAt > Date.now() + 60_000) return false;
      } else if (controller.timer.startedAt !== null) return false;
    }
    return controller.expired !== true || controller.timer === undefined || controller.timer.status === "expired";
  } catch { return false; }
}

export function isControllerCoherent(gameId: GameId, controller: Record<string, unknown>) {
  try {
    const screen = controller.screen ?? controller.phase;
    if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) {
      return isTimedGameController(gameId as "charades" | "forbidden-word" | "rapid-fire", controller);
    }
    if (gameId === "out-of-loop") {
      return screen === undefined || screen === "home" || screen === "setup" || isOutOfLoopRound(controller.round);
    }
    if (gameId === "who-am-i") {
      if (!Object.hasOwn(controller, "players") && !Object.hasOwn(controller, "identities")) return true;
      return isWhoAmIController(controller);
    }
    if (gameId === "most-likely-to") {
      return isMostLikelyController(controller);
    }
    if (gameId === "two-truths-lie") {
      return isTwoTruthsController(controller);
    }
    return true;
  } catch {
    return false;
  }
}

export function useGameSessionState<T>(
  gameId: GameId,
  locale: Locale,
  key: string,
  initial: T | (() => T),
  validate: Validator<T>,
  privacyRestore: (value: T) => T = (value) => value,
): [T, Dispatch<SetStateAction<T>>] {
  const createInitial = () => typeof initial === "function" ? (initial as () => T)() : initial;
  const [value, setValue] = useState<T>(() => {
    const storage = getGameStorage();
    if (!storage) return createInitial();
    const session = getSessionStore(storage).read();
    const controller = session?.gameId === gameId && isControllerCoherent(gameId, session.controller)
      ? session.controller
      : {};
    const candidate = controller[key];
    try {
      return validate(candidate) ? privacyRestore(candidate) : createInitial();
    } catch {
      return createInitial();
    }
  });

  useEffect(() => {
    const storage = getGameStorage();
    if (!storage) return;
    getSessionStore(storage).writeField(gameId, locale, key, value);
  }, [gameId, key, locale, value]);

  return [value, setValue];
}
