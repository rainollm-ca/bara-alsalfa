"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { GameId } from "../games/types";
import type { Locale } from "./game";
import { parseSavedSession, serializeSavedSession, SESSION_KEY } from "./session";

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
export const isPromptDrawState = (value: unknown) =>
  isPlainRecord(value) && (value.prompt === null || isActionPrompt(value.prompt)) &&
  isPlainRecord(value.deck) && Array.isArray(value.deck.remaining) &&
  value.deck.remaining.length <= 500 && value.deck.remaining.every(isActionPrompt);
export const isOutOfLoopRound = (value: unknown) => {
  if (!isPlainRecord(value) || !isPlainRecord(value.category) || !isShortString(value.categoryTitle) || !isShortString(value.word) || !isShortString(value.outsider) || !Array.isArray(value.roles) || value.roles.length < 3 || value.roles.length > 12) return false;
  if (!isShortString(value.category.id) || !isLocalizedText(value.category.title) || !Array.isArray(value.category.words) || value.category.words.length > 100 || !value.category.words.every(isLocalizedText)) return false;
  return value.roles.every((role) => isPlainRecord(role) && isShortString(role.player) && typeof role.isOutsider === "boolean" && (role.word === null || isShortString(role.word)));
};
export const isTwoTruthsRound = (value: unknown) =>
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

export function isControllerCoherent(gameId: GameId, controller: Record<string, unknown>) {
  try {
    const screen = controller.screen ?? controller.phase;
    const players = controller.players;
    const teams = controller.teams;
    if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) {
      return screen === undefined || screen === "setup" || (isStringList(teams) && teams.length >= 2);
    }
    if (gameId === "out-of-loop") {
      return screen === undefined || screen === "home" || screen === "setup" || isOutOfLoopRound(controller.round);
    }
    if (gameId === "who-am-i") {
      if (!Object.hasOwn(controller, "players") && !Object.hasOwn(controller, "identities")) return true;
      return isWhoAmIController(controller);
    }
    if (gameId === "most-likely-to") {
      return screen === undefined || screen === "setup" || (isStringList(players) && players.length >= 3);
    }
    if (gameId === "two-truths-lie") {
      if (screen === undefined || screen === "setup") return true;
      if (!isStringList(players) || players.length < 3) return false;
      return !["round-pass", "vote", "reveal"].includes(String(screen)) || isTwoTruthsRound(controller.round);
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
    const session = parseSavedSession(storage.getItem(SESSION_KEY));
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
    const existing = parseSavedSession(storage.getItem(SESSION_KEY));
    const controller = existing?.gameId === gameId ? existing.controller : {};
    storage.setItem(SESSION_KEY, serializeSavedSession({
      gameId,
      locale,
      updatedAt: Date.now(),
      controller: { ...controller, [key]: value },
    }));
  }, [gameId, key, locale, value]);

  return [value, setValue];
}
