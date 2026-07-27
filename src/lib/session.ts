import type { GameId } from "../games/types";
import type { Locale } from "./game";

export const SESSION_KEY = "bara-local-session";
const SESSION_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const GAME_IDS = new Set<GameId>([
  "category-challenge", "out-of-loop", "charades", "forbidden-word",
  "who-am-i", "rapid-fire", "most-likely-to", "two-truths-lie",
]);

export type SavedLocalSession = {
  version: 1;
  mode: "local";
  gameId: GameId;
  locale: Locale;
  updatedAt: number;
  controller: Record<string, unknown>;
};

type NewSavedSession = Omit<SavedLocalSession, "version" | "mode">;

export function serializeSavedSession(session: NewSavedSession): string {
  return JSON.stringify({ version: SESSION_VERSION, mode: "local", ...session });
}

export function parseSavedSession(raw: string | null, now = Date.now()): SavedLocalSession | null {
  if (!raw || raw.length > 100_000) return null;
  try {
    const value = JSON.parse(raw) as Partial<SavedLocalSession>;
    if (
      value.version !== SESSION_VERSION ||
      value.mode !== "local" ||
      !GAME_IDS.has(value.gameId as GameId) ||
      (value.locale !== "ar" && value.locale !== "en") ||
      typeof value.updatedAt !== "number" ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt > now + 60_000 ||
      now - value.updatedAt > MAX_AGE_MS ||
      !value.controller ||
      typeof value.controller !== "object" ||
      Array.isArray(value.controller)
    ) return null;
    return value as SavedLocalSession;
  } catch {
    return null;
  }
}

export function discardSavedSession(storage: Pick<Storage, "setItem">) {
  storage.setItem(SESSION_KEY, "");
}
