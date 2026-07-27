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
export const isActionPrompt = (value: unknown) =>
  isPlainRecord(value) && isShortString(value.id) && isLocalizedText(value.text) &&
  (!Object.hasOwn(value, "forbidden") || (Array.isArray(value.forbidden) && value.forbidden.length <= 20 && value.forbidden.every(isLocalizedText)));
export const isPromptDrawState = (value: unknown) =>
  isPlainRecord(value) && (value.prompt === null || isActionPrompt(value.prompt)) &&
  isPlainRecord(value.deck) && Array.isArray(value.deck.remaining) &&
  value.deck.remaining.length <= 500 && value.deck.remaining.every(isActionPrompt);
export function getGameStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
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
      return screen === undefined || screen === "home" || screen === "setup" || isPlainRecord(controller.round);
    }
    if (gameId === "who-am-i") {
      return controller.playing !== true || (isStringList(players) && players.length >= 2 && isPlainRecord(controller.identities));
    }
    if (gameId === "most-likely-to") {
      return screen === undefined || screen === "setup" || (isStringList(players) && players.length >= 3);
    }
    if (gameId === "two-truths-lie") {
      if (screen === undefined || screen === "setup") return true;
      if (!isStringList(players) || players.length < 3) return false;
      return !["round-pass", "vote", "reveal"].includes(String(screen)) || isPlainRecord(controller.round);
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
