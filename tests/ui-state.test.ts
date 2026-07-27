import { describe, expect, it } from "vitest";

import {
  formatPlayerRange,
  getLibraryCopy,
  readStoredLocale,
  writeStoredLocale,
} from "../src/components/GameLibrary";
import { validateSetup } from "../src/components/SetupShell";

describe("game library UI state", () => {
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
});
