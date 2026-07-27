import { describe, expect, it } from "vitest";
import {
  isActionPrompt,
  isControllerCoherent,
  isFiniteScoreRecord,
  isPromptDrawState,
  isStringList,
} from "../src/lib/useGameSessionState";

describe("restored controller data guards", () => {
  it.each([
    ["charades", { screen: "round", teams: null }],
    ["forbidden-word", { screen: "round", teams: ["Only one"] }],
    ["rapid-fire", { screen: "final", teams: {} }],
    ["out-of-loop", { screen: "reveal", round: null }],
    ["who-am-i", { playing: true, players: [], identities: null }],
    ["most-likely-to", { phase: "vote", players: ["One"] }],
    ["two-truths-lie", { phase: "vote", players: ["One", "Two", "Three"], round: null }],
  ] as const)("rejects incoherent %s state without throwing", (gameId, controller) => {
    expect(() => isControllerCoherent(gameId, controller)).not.toThrow();
    expect(isControllerCoherent(gameId, controller)).toBe(false);
  });

  it.each([
    [isStringList, [null]],
    [isStringList, new Array(21).fill("x")],
    [isFiniteScoreRecord, { team: Number.NaN }],
    [isFiniteScoreRecord, { team: Number.POSITIVE_INFINITY }],
    [isFiniteScoreRecord, { team: 1e99 }],
    [isActionPrompt, { id: "x", text: null }],
    [isPromptDrawState, { prompt: null, deck: {} }],
    [isPromptDrawState, { prompt: {}, deck: { remaining: [] } }],
    [isPromptDrawState, { prompt: null, deck: { remaining: [null] } }],
  ])("totally rejects malformed field payload %#", (guard, payload) => {
    expect(() => guard(payload)).not.toThrow();
    expect(guard(payload)).toBe(false);
  });
});
