import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CHARADES_PROMPTS,
  FORBIDDEN_WORD_PROMPTS,
  RAPID_FIRE_PROMPTS,
  WHO_AM_I_PROMPTS,
} from "../src/games/content/actionGames";
import { MOST_LIKELY_TO_PROMPTS } from "../src/games/content/socialGames";
import {
  assignPrivateIdentities,
  createPromptDeck,
  drawPrompt,
  recordForbiddenWordViolation,
  scoreCharades,
  scoreRapidFire,
} from "../src/games/engines/actionGames";
import {
  createTwoTruthsRound,
  revealTwoTruthsLie,
  tallyVotes,
} from "../src/games/engines/socialGames";

describe("party game content", () => {
  it("provides substantial stable bilingual action-game packs", () => {
    for (const prompts of [
      CHARADES_PROMPTS,
      FORBIDDEN_WORD_PROMPTS,
      WHO_AM_I_PROMPTS,
      RAPID_FIRE_PROMPTS,
    ]) {
      expect(prompts.length).toBeGreaterThanOrEqual(60);
      expect(new Set(prompts.map(({ id }) => id)).size).toBe(prompts.length);
      for (const prompt of prompts) {
        expect(prompt.id.trim()).not.toBe("");
        expect(prompt.text.ar.trim()).not.toBe("");
        expect(prompt.text.en.trim()).not.toBe("");
      }
    }

    for (const prompt of FORBIDDEN_WORD_PROMPTS) {
      expect(prompt.forbidden.length).toBeGreaterThanOrEqual(3);
      for (const word of prompt.forbidden) {
        expect(word.ar.trim()).not.toBe("");
        expect(word.en.trim()).not.toBe("");
      }
    }
  });

  it("provides at least forty stable bilingual Most Likely To prompts", () => {
    expect(MOST_LIKELY_TO_PROMPTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(MOST_LIKELY_TO_PROMPTS.map(({ id }) => id)).size).toBe(
      MOST_LIKELY_TO_PROMPTS.length,
    );
    for (const prompt of MOST_LIKELY_TO_PROMPTS) {
      expect(prompt.id.trim()).not.toBe("");
      expect(prompt.text.ar.trim()).not.toBe("");
      expect(prompt.text.en.trim()).not.toBe("");
    }
  });
});

describe("action game engines", () => {
  const prompts = CHARADES_PROMPTS.slice(0, 3);

  it("draws an injected-random deck without repeats and isolates its state", () => {
    const deck = createPromptDeck(prompts, () => 0);
    const first = drawPrompt(deck);
    const second = drawPrompt(first.deck);
    const third = drawPrompt(second.deck);

    expect([first.prompt.id, second.prompt.id, third.prompt.id]).toEqual([
      prompts[1].id,
      prompts[2].id,
      prompts[0].id,
    ]);
    expect(new Set([first.prompt.id, second.prompt.id, third.prompt.id]).size).toBe(3);
    expect(deck.remaining).toHaveLength(3);
    expect(third.deck.remaining).toHaveLength(0);
    expect(() => drawPrompt(third.deck)).toThrow(/empty/i);

    (first.prompt.text as { en: string }).en = "changed";
    expect(prompts[1].text.en).not.toBe("changed");
  });

  it("scores charades guesses immutably", () => {
    const scores = { alpha: 2, beta: 1 } as const;
    const correct = scoreCharades(scores, "alpha", true);
    const skipped = scoreCharades(correct, "beta", false);

    expectTypeOf(correct).toEqualTypeOf<
      Readonly<Record<"alpha" | "beta", number>>
    >();
    expect(correct).toEqual({ alpha: 3, beta: 1 });
    expect(skipped).toEqual(correct);
    expect(scores).toEqual({ alpha: 2, beta: 1 });
  });

  it("records forbidden-word violations without mutating the round", () => {
    const round = { violations: 0, valid: true } as const;
    const updated = recordForbiddenWordViolation(round);

    expect(updated).toEqual({ violations: 1, valid: false });
    expect(round).toEqual({ violations: 0, valid: true });
  });

  it("assigns each player a private, isolated identity deterministically", () => {
    const identities = assignPrivateIdentities(
      ["p1", "p2", "p3"],
      WHO_AM_I_PROMPTS.slice(0, 3),
      () => 0,
    );

    expect(Object.keys(identities)).toEqual(["p1", "p2", "p3"]);
    expect(new Set(Object.values(identities).map(({ id }) => id)).size).toBe(3);
    expect(identities.p1).not.toBe(WHO_AM_I_PROMPTS[1]);
    (identities.p1.text as { en: string }).en = "changed";
    expect(WHO_AM_I_PROMPTS[1].text.en).not.toBe("changed");
    expect(() =>
      assignPrivateIdentities(["p1", "p1"], WHO_AM_I_PROMPTS, () => 0),
    ).toThrow(/unique/i);
  });

  it("scores only correct rapid-fire answers", () => {
    const scores = { player: 4 } as const;
    expect(scoreRapidFire(scores, "player", "correct")).toEqual({ player: 5 });
    expect(scoreRapidFire(scores, "player", "pass")).toBe(scores);
  });
});

describe("social game engines", () => {
  it("tallies votes, reports all tied winners, and isolates vote arrays", () => {
    const result = tallyVotes(["aya", "sam", "aya", "sam", "lee"]);

    expect(result.counts).toEqual({ aya: 2, sam: 2, lee: 1 });
    expect(result.winners).toEqual(["aya", "sam"]);
    expect(result.isTie).toBe(true);
  });

  it("creates a user-entered two-truths round and reveals the lie immutably", () => {
    const round = createTwoTruthsRound(
      "player-1",
      ["I climbed a mountain", "I speak four languages", "I own a tiger"],
      2,
    );
    const revealed = revealTwoTruthsLie(round);

    expect(round.revealed).toBe(false);
    expect(revealed).not.toBe(round);
    expect(revealed.revealed).toBe(true);
    expect(revealed.lieIndex).toBe(2);
    expect(revealed.statements).toEqual(round.statements);
    expect(() =>
      createTwoTruthsRound("player-1", ["one", "two", "three"], 3),
    ).toThrow(/lie/i);
  });
});
