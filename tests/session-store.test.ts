import { describe, expect, it } from "vitest";
import {
  createSessionStore,
  safeStorageGet,
  safeStorageSet,
  SESSION_KEY,
} from "../src/lib/session";
import { readStoredLocale, writeStoredLocale } from "../src/components/GameLibrary";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("safe browser storage", () => {
  const throwing = {
    getItem: () => { throw new DOMException("blocked", "SecurityError"); },
    setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
  };

  it("absorbs unavailable/private/quota storage failures", () => {
    expect(() => safeStorageGet(throwing, SESSION_KEY)).not.toThrow();
    expect(safeStorageGet(throwing, SESSION_KEY)).toBeNull();
    expect(safeStorageSet(throwing, SESSION_KEY, "x")).toBe(false);
    expect(readStoredLocale(throwing)).toBe("ar");
    expect(writeStoredLocale("en", throwing)).toBe(false);
    const store = createSessionStore(throwing, "blocked");
    expect(() => store.writeField("charades", "en", "screen", "round")).not.toThrow();
    expect(store.read()).toBeNull();
  });
});

describe("revisioned multi-tab session store", () => {
  it("re-reads and merges distinct concurrent fields monotonically", async () => {
    const storage = memoryStorage();
    const timestamp = Date.now();
    const tabA = createSessionStore(storage, "a", () => timestamp);
    const tabB = createSessionStore(storage, "b", () => timestamp);
    expect(await tabA.replace("charades", "en")).toBe(true);
    expect(await tabA.writeField("charades", "en", "teams", ["One", "Two"])).toBe(true);
    expect(await tabB.writeField("charades", "en", "screen", "round")).toBe(true);
    expect(await tabA.writeField("charades", "en", "turn", 1)).toBe(true);
    expect(tabA.read()).toMatchObject({
      revision: 4,
      controller: { teams: ["One", "Two"], screen: "round", turn: 1 },
    });
  });

  it("writes a durable tombstone and prevents a stale tab from resurrecting it", async () => {
    const storage = memoryStorage();
    const timestamp = Date.now();
    const stale = createSessionStore(storage, "stale", () => timestamp);
    const clearer = createSessionStore(storage, "clearer", () => timestamp + 1);
    expect(await stale.replace("who-am-i", "en", { players: ["One", "Two"] })).toBe(true);
    expect(await clearer.clear()).toBe(true);
    expect(await stale.writeField("who-am-i", "en", "playing", true)).toBe(false);
    expect(stale.read()).toBeNull();
    expect(await clearer.replace("rapid-fire", "ar", {})).toBe(true);
    expect(clearer.read()).toMatchObject({ gameId: "rapid-fire", generation: 1 });
    expect(await stale.writeField("who-am-i", "en", "playing", true)).toBe(false);
  });
});
