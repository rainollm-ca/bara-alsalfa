import { describe, expect, it } from "vitest";

import { GAME_CATALOG } from "../src/games/catalog";

const EXPECTED_GAME_IDS = [
  "category-challenge",
  "out-of-loop",
  "charades",
  "forbidden-word",
  "who-am-i",
  "rapid-fire",
  "most-likely-to",
  "two-truths-lie",
] as const;

describe("GAME_CATALOG", () => {
  it("contains exactly eight uniquely identified bilingual games", () => {
    expect(GAME_CATALOG).toHaveLength(8);

    const ids = GAME_CATALOG.map((game) => game.id);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toEqual(EXPECTED_GAME_IDS);

    for (const game of GAME_CATALOG) {
      expect(game.title.ar.trim()).not.toBe("");
      expect(game.title.en.trim()).not.toBe("");
      expect(game.description.ar.trim()).not.toBe("");
      expect(game.description.en.trim()).not.toBe("");
      expect(game.art.src).toBe(`/games/${game.id}.png`);
      expect(game.art.alt.ar.trim()).not.toBe("");
      expect(game.art.alt.en.trim()).not.toBe("");
      expect(game.contentFamilies.length).toBeGreaterThan(0);
    }
  });
});
