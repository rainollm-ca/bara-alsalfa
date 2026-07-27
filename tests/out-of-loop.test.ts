import { describe, expect, it } from "vitest";
import {
  buildOutOfLoopRound,
  calculateOutOfLoopVote,
  normalizePlayers,
  type OutOfLoopCategory,
} from "../src/games/engines/outOfLoop";

const category: OutOfLoopCategory = {
  id: "cities",
  title: { ar: "مدن", en: "Cities" },
  emoji: "🏙️",
  words: [{ ar: "دمشق", en: "Damascus" }],
};

describe("out of loop engine", () => {
  it("normalizes players and creates one private outsider", () => {
    expect(normalizePlayers([" Noor ", "", "Aya", "Noor"])).toEqual(["Noor", "Aya"]);
    const round = buildOutOfLoopRound(["Noor", "Aya", "Sam"], category, "en", () => 0);
    expect(round.outsider).toBe("Noor");
    expect(round.roles.filter(({ isOutsider }) => isOutsider)).toHaveLength(1);
    expect(round.roles.filter(({ isOutsider }) => !isOutsider).every(({ word }) => word === "Damascus")).toBe(true);
  });

  it("reports private vote winners and ties", () => {
    expect(calculateOutOfLoopVote({ Noor: "Aya", Aya: "Aya", Sam: "Noor" })).toEqual({
      leaders: ["Aya"],
      tied: false,
    });
    expect(calculateOutOfLoopVote({ Noor: "Aya", Aya: "Noor" })).toEqual({
      leaders: ["Aya", "Noor"],
      tied: true,
    });
  });

  it("preserves the established Arabic minimum-player error", () => {
    expect(() =>
      buildOutOfLoopRound(["Noor", "Aya"], category, "en", () => 0),
    ).toThrowError("تحتاج اللعبة إلى 3 لاعبين على الأقل");
  });
});
