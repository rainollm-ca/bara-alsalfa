import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  formatPlayerRange,
  getLibraryCopy,
  readStoredLocale,
  syncDocumentLocale,
  writeStoredLocale,
} from "../src/components/GameLibrary";
import {
  normalizeSetupNames,
  validateDuration,
  validateSetup,
} from "../src/components/SetupShell";
import { resolveGameView } from "../src/lib/ui-state";
import { parseSavedSession, serializeSavedSession } from "../src/lib/session";

describe("game library UI state", () => {
  it("coordinates library, playable, and upcoming game views", () => {
    expect(resolveGameView(null, "local")).toBe("library");
    expect(resolveGameView("out-of-loop", "local")).toBe("out-of-loop");
    expect(resolveGameView("charades", "local")).toBe("charades");
    expect(resolveGameView("forbidden-word", "local")).toBe("forbidden-word");
    expect(resolveGameView("who-am-i", "local")).toBe("who-am-i");
    expect(resolveGameView("rapid-fire", "local")).toBe("rapid-fire");
    expect(resolveGameView("most-likely-to", "local")).toBe("most-likely-to");
    expect(resolveGameView("two-truths-lie", "local")).toBe("two-truths-lie");
    expect(resolveGameView("out-of-loop", "room")).toBe("room-lobby");
    expect(resolveGameView("most-likely-to", "room")).toBe("room-lobby");
  });

  it("provides localized library labels", () => {
    expect(getLibraryCopy("ar")).toMatchObject({
      libraryTitle: "اختاروا لعبتكم",
      localMode: "جهاز واحد",
      roomMode: "غرفة جماعية",
      play: "ابدأ اللعب",
    });
    expect(getLibraryCopy("en")).toMatchObject({
      libraryTitle: "Choose your game",
      localMode: "One device",
      roomMode: "Group room",
      play: "Play now",
    });
  });

  it("formats supported player ranges in either locale", () => {
    expect(formatPlayerRange({ min: 3, max: 12 }, "ar")).toBe("3–12 لاعب");
    expect(formatPlayerRange({ min: 4, max: 16 }, "en")).toBe("4–16 players");
  });

  it("persists and safely restores a supported locale", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    writeStoredLocale("en", storage);
    expect(readStoredLocale(storage)).toBe("en");
    values.set("bara-locale", "fr");
    expect(readStoredLocale(storage)).toBe("ar");
  });

  it("synchronizes document language and direction", () => {
    const root = { lang: "", dir: "" };
    syncDocumentLocale("en", root);
    expect(root).toEqual({ lang: "en", dir: "ltr" });
    syncDocumentLocale("ar", root);
    expect(root).toEqual({ lang: "ar", dir: "rtl" });
  });

  it("exposes selected semantics for setup and language controls", () => {
    const setupSource = readFileSync(resolve("src/components/SetupShell.tsx"), "utf8");
    const topBarSource = readFileSync(resolve("src/components/TopBar.tsx"), "utf8");

    expect(setupSource).toContain('role="radiogroup"');
    expect(setupSource).toContain('role="radio"');
    expect(setupSource).toContain("aria-checked=");
    expect(topBarSource).toContain('role="group"');
    expect(topBarSource).toContain("aria-pressed=");
  });
});

describe("saved local session envelope", () => {
  it("round-trips a supported, recent local game without trusting arbitrary data", () => {
    const now = Date.now();
    const encoded = serializeSavedSession({
      gameId: "charades",
      locale: "en",
      updatedAt: now,
      controller: { phase: "setup" },
    });
    expect(parseSavedSession(encoded, now)).toEqual({
      version: 1,
      mode: "local",
      gameId: "charades",
      locale: "en",
      updatedAt: now,
      controller: { phase: "setup" },
    });
  });

  it("rejects room, malformed, unsupported, and expired payloads", () => {
    const now = Date.now();
    expect(parseSavedSession("nope", now)).toBeNull();
    expect(parseSavedSession(JSON.stringify({ version: 1, mode: "room" }), now)).toBeNull();
    expect(parseSavedSession(JSON.stringify({
      version: 1, mode: "local", gameId: "unknown", locale: "en", updatedAt: now,
    }), now)).toBeNull();
    expect(parseSavedSession(JSON.stringify({
      version: 1, mode: "local", gameId: "charades", locale: "en",
      updatedAt: now - 8 * 24 * 60 * 60 * 1000,
    }), now)).toBeNull();
  });
});

describe("shared setup validation", () => {
  it("accepts player counts inside the selected game's range", () => {
    expect(validateSetup(3, { min: 3, max: 12 })).toEqual({ valid: true });
  });

  it("returns localized guidance below or above the supported range", () => {
    expect(validateSetup(2, { min: 3, max: 12 }, "ar")).toEqual({
      valid: false,
      message: "تحتاجون 3 لاعبين على الأقل",
    });
    expect(validateSetup(17, { min: 4, max: 16 }, "en")).toEqual({
      valid: false,
      message: "This game supports up to 16 players",
    });
  });

  it("normalizes reusable player and team name collections", () => {
    expect(normalizeSetupNames([" Noor ", "", "Noor", " Sami "])).toEqual([
      "Noor",
      "Sami",
    ]);
  });

  it("validates reusable round durations", () => {
    expect(validateDuration(60, { min: 30, max: 180 })).toEqual({ valid: true });
    expect(validateDuration(15, { min: 30, max: 180 }, "en")).toEqual({
      valid: false,
      message: "Choose a duration from 30 to 180 seconds",
    });
  });
});
