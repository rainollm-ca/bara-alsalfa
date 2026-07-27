import { describe, expect, it } from "vitest";
import {
  isActionPrompt,
  isControllerCoherent,
  isFiniteScoreRecord,
  isPromptDrawState,
  isStringList,
  isWhoAmIController,
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

describe("Who Am I controller coherence", () => {
  const prompt = (id: string) => ({ id, text: { ar: `شخصية ${id}`, en: `Identity ${id}` } });
  const valid = {
    players: ["One", "Two"],
    identities: { One: prompt("one"), Two: prompt("two") },
    index: 0,
    revealed: false,
    playing: false,
  };

  it("accepts the exact player-to-distinct-identity mapping", () => {
    expect(isWhoAmIController(valid)).toBe(true);
  });

  it.each([
    ["reviewer case: playing false cannot bypass an empty roster", { players: [], identities: {}, index: 0, revealed: false, playing: false }],
    ["missing identity", { ...valid, identities: { One: prompt("one") } }],
    ["extra identity", { ...valid, identities: { ...valid.identities, Three: prompt("three") } }],
    ["duplicate identity prompt", { ...valid, identities: { One: prompt("same"), Two: prompt("same") } }],
    ["out-of-range index", { ...valid, index: 2 }],
    ["negative index", { ...valid, index: -1 }],
    ["duplicate players", { ...valid, players: ["One", "One"], identities: { One: prompt("one") } }],
    ["blank player", { ...valid, players: ["One", " "] }],
    ["prototype player key", { ...valid, players: ["One", "__proto__"], identities: { One: prompt("one"), ["__proto__"]: prompt("proto") } }],
    ["prototype-polluted map", { ...valid, identities: Object.assign(Object.create({ injected: true }), valid.identities) }],
    ["playing before final viewer", { ...valid, playing: true, revealed: true, index: 0 }],
    ["playing while covered", { ...valid, playing: true, revealed: false, index: 1 }],
    ["non-boolean reveal", { ...valid, revealed: "yes" }],
  ])("rejects %s safely", (_label, controller) => {
    expect(() => isWhoAmIController(controller as Record<string, unknown>)).not.toThrow();
    expect(isWhoAmIController(controller as Record<string, unknown>)).toBe(false);
  });
});
