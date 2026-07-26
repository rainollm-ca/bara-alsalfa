import { describe, expect, it } from "vitest";
import {
  buildRound,
  calculateVote,
  normalizePlayers,
  type Category,
} from "../src/lib/game";

const category: Category = {
  id: "cities",
  title: "مدن",
  emoji: "🏙️",
  words: ["دمشق", "بيروت", "عمّان"],
};

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
    const round = buildRound(["نور", "رقية", "ضحى", "هشام"], category, () => 0);
    expect(round.outsider).toBe("نور");
    expect(round.word).toBe("دمشق");
    expect(round.roles.filter((role) => role.isOutsider)).toHaveLength(1);
    expect(
      round.roles.filter((role) => !role.isOutsider).every((role) => role.word === "دمشق"),
    ).toBe(true);
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
