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
export function getGameStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
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
    const candidate = session?.gameId === gameId ? session.controller[key] : undefined;
    return validate(candidate) ? privacyRestore(candidate) : createInitial();
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
