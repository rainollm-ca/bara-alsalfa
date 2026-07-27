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
  revision: number;
  generation: number;
  writerId: string;
};

type NewSavedSession = Omit<SavedLocalSession, "version" | "mode" | "revision" | "generation" | "writerId"> &
  Partial<Pick<SavedLocalSession, "revision" | "generation" | "writerId">>;

export function serializeSavedSession(session: NewSavedSession): string {
  return JSON.stringify({
    version: SESSION_VERSION,
    mode: "local",
    revision: session.revision ?? 1,
    generation: session.generation ?? 0,
    writerId: session.writerId ?? "legacy",
    ...session,
  });
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
      Array.isArray(value.controller) ||
      !Number.isInteger(value.revision) || Number(value.revision) < 1 ||
      !Number.isInteger(value.generation) || Number(value.generation) < 0 ||
      typeof value.writerId !== "string" || !value.writerId
    ) return null;
    return value as SavedLocalSession;
  } catch {
    return null;
  }
}

export function safeStorageGet(storage: Pick<Storage, "getItem"> | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeStorageSet(storage: Pick<Storage, "setItem"> | null | undefined, key: string, value: string): boolean {
  try {
    storage?.setItem(key, value);
    return Boolean(storage);
  } catch {
    return false;
  }
}

type Tombstone = {
  version: 1;
  cleared: true;
  revision: number;
  generation: number;
  updatedAt: number;
  writerId: string;
};

function parseRecord(raw: string | null): SavedLocalSession | Tombstone | null {
  const saved = parseSavedSession(raw);
  if (saved) return saved;
  try {
    const value = JSON.parse(raw ?? "");
    return value?.version === 1 && value.cleared === true &&
      Number.isInteger(value.revision) && value.revision >= 1 &&
      Number.isInteger(value.generation) && value.generation >= 1 &&
      Number.isFinite(value.updatedAt) && typeof value.writerId === "string"
      ? value as Tombstone
      : null;
  } catch {
    return null;
  }
}

export function createSessionStore(
  storage: Pick<Storage, "getItem" | "setItem">,
  writerId = `writer-${Math.random().toString(36).slice(2)}`,
  now: () => number = Date.now,
) {
  let seenGeneration = parseRecord(safeStorageGet(storage, SESSION_KEY))?.generation ?? 0;
  let blocked = false;
  const readRecord = () => parseRecord(safeStorageGet(storage, SESSION_KEY));
  const writeRecord = (record: SavedLocalSession | Tombstone) => {
    const written = safeStorageSet(storage, SESSION_KEY, JSON.stringify(record));
    if (written && typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel("bara-session");
        channel.postMessage({ generation: record.generation, revision: record.revision });
        channel.close();
      } catch {}
    }
    return written;
  };
  const mutate = <T>(operation: () => T): T | Promise<T> => {
    try {
      const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
      return locks ? locks.request("bara-local-session", operation) : operation();
    } catch {
      return operation();
    }
  };

  return {
    read: () => {
      const record = readRecord();
      if (record && record.generation > seenGeneration) {
        seenGeneration = record.generation;
        if ("cleared" in record) blocked = true;
      }
      return record && !("cleared" in record) ? record : null;
    },
    writeField(gameId: GameId, locale: Locale, key: string, value: unknown) {
      return mutate(() => {
        const latest = readRecord();
        if (blocked || (latest && latest.generation > seenGeneration)) {
          seenGeneration = latest?.generation ?? seenGeneration;
          blocked = true;
          return false;
        }
        const controller = latest && !("cleared" in latest) && latest.gameId === gameId ? latest.controller : {};
        return writeRecord({
          version: 1, mode: "local", gameId, locale,
          controller: { ...controller, [key]: value },
          revision: (latest?.revision ?? 0) + 1,
          generation: latest?.generation ?? seenGeneration,
          writerId,
          updatedAt: Math.max(now(), (latest?.updatedAt ?? 0) + 1),
        });
      });
    },
    replace(gameId: GameId, locale: Locale, controller: Record<string, unknown> = {}) {
      return mutate(() => {
        const latest = readRecord();
        if (blocked || (latest && latest.generation > seenGeneration)) return false;
        return writeRecord({
          version: 1, mode: "local", gameId, locale, controller,
          revision: (latest?.revision ?? 0) + 1,
          generation: latest?.generation ?? seenGeneration,
          writerId,
          updatedAt: Math.max(now(), (latest?.updatedAt ?? 0) + 1),
        });
      });
    },
    clear() {
      return mutate(() => {
        const latest = readRecord();
        const tombstone: Tombstone = {
          version: 1, cleared: true,
          revision: (latest?.revision ?? 0) + 1,
          generation: Math.max(seenGeneration, latest?.generation ?? 0) + 1,
          writerId,
          updatedAt: Math.max(now(), (latest?.updatedAt ?? 0) + 1),
        };
        seenGeneration = tombstone.generation;
        blocked = false;
        return writeRecord(tombstone);
      });
    },
  };
}

const stores = new WeakMap<object, ReturnType<typeof createSessionStore>>();
export function getSessionStore(storage: Pick<Storage, "getItem" | "setItem">) {
  const key = storage as object;
  const existing = stores.get(key);
  if (existing) return existing;
  const store = createSessionStore(storage);
  stores.set(key, store);
  return store;
}

export function discardSavedSession(storage: Pick<Storage, "getItem" | "setItem">) {
  return getSessionStore(storage).clear();
}
