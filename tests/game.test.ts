import { describe, expect, it } from "vitest";
import {
  buildRound,
  calculateVote,
  DEFAULT_PLAYERS,
  normalizePlayers,
  type Category,
} from "../src/lib/game";

const category: Category = {
  id: "cities",
  title: { ar: "مدن", en: "Cities" },
  emoji: "🏙️",
  words: [
    { ar: "دمشق", en: "Damascus" },
    { ar: "بيروت", en: "Beirut" },
    { ar: "عمّان", en: "Amman" },
  ],
};

describe("default setup", () => {
  it("starts without predefined player names", () => {
    expect(DEFAULT_PLAYERS).toEqual([]);
  });
});

describe("normalizePlayers", () => {
  it("removes blanks and duplicate names while preserving order", () => {
    expect(normalizePlayers(["نور", " ", "رقية", "نور", "ضحى"])).toEqual([
      "نور",
      "رقية",
      "ضحى",
    ]);
  });
});

describe("buildRound", () => {
  it("assigns exactly one outsider and gives everyone else the same word", () => {
    const round = buildRound(["نور", "رقية", "ضحى", "هشام"], category, "ar", () => 0);
    expect(round.outsider).toBe("نور");
    expect(round.word).toBe("دمشق");
    expect(round.roles.filter((role) => role.isOutsider)).toHaveLength(1);
    expect(
      round.roles.filter((role) => !role.isOutsider).every((role) => role.word === "دمشق"),
    ).toBe(true);
  });

  it("uses the English word set when English is selected", () => {
    const round = buildRound(["Noor", "Ruqayya", "Doha"], category, "en", () => 0);
    expect(round.word).toBe("Damascus");
    expect(round.categoryTitle).toBe("Cities");
  });
});

describe("calculateVote", () => {
  it("returns a winner and reports ties", () => {
    expect(calculateVote({ نور: "هشام", رقية: "هشام", ضحى: "نور" })).toEqual({
      leaders: ["هشام"],
      tied: false,
    });
    expect(calculateVote({ نور: "هشام", رقية: "نور" })).toEqual({
      leaders: ["هشام", "نور"],
      tied: true,
    });
  });
});
