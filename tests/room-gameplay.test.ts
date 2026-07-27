import { describe, expect, it } from "vitest";

import { GAME_CATALOG } from "../src/games/catalog";
import type { GameId } from "../src/games/types";
import type { RoomAction } from "../src/rooms/contracts";
import { RoomRepository } from "../src/rooms/repository";
import { toPlayerView } from "../src/rooms/playerView";

function started(gameId: GameId, players = ["Host", "Guest", "Third", "Fourth"]) {
  let now = 10_000;
  const rooms = new RoomRepository({ codeFactory: () => "PLAY12", clock: () => now, randomInt: () => 0 });
  const created = rooms.create({ hostName: players[0]! });
  const joined = players.slice(1).map((name) => rooms.join(created.code, { name }));
  rooms.applyAction(created.code, created.hostToken, { type: "lobby/select-game", gameId });
  const room = rooms.applyAction(created.code, created.hostToken, { type: "lobby/start" });
  return { rooms, created, joined, room, advance: (ms: number) => { now += ms; } };
}

describe("authoritative room game reducers", () => {
  it("uses the injected random source and avoids previously selected prompts", () => {
    const calls: number[] = [];
    const rooms = new RoomRepository({
      codeFactory: () => "RAND12",
      randomInt: (maxExclusive) => {
        calls.push(maxExclusive);
        return Math.min(1, maxExclusive - 1);
      },
    });
    const created = rooms.create({ hostName: "Host" });
    rooms.join(created.code, { name: "Guest" });
    rooms.applyAction(created.code, created.hostToken, {
      type: "lobby/select-game", gameId: "category-challenge",
    });
    const first = rooms.applyAction(created.code, created.hostToken, { type: "lobby/start" });
    const firstIndex = (first.gameState!.publicData as any).promptIndex;
    rooms.applyAction(created.code, created.hostToken, {
      type: "category/score", correctPlayerId: null,
    });
    const second = rooms.applyAction(created.code, created.hostToken, { type: "game/next-round" });
    expect((second.gameState!.publicData as any).promptIndex).not.toBe(firstIndex);
    expect(calls.some((max) => max > 2)).toBe(true);
  });

  it.each(GAME_CATALOG.map((game) => game.id))("initializes %s with bounded authoritative state", (gameId) => {
    const { room } = started(gameId);
    expect(room.gameState?.publicData).toMatchObject({ gameId, round: 1 });
    expect(room.gameState?.revision).toBe(1);
  });

  it.each([
    ["category-challenge", { type: "category/score", correctPlayerId: "host" }],
  ] as const)("lets only host advance authoritative %s rounds", (gameId, partial) => {
    const { rooms, created, joined, room, advance } = started(gameId);
    const hostId = room.hostPlayerId;
    const action = { ...partial, type: partial.type, ...(gameId === "category-challenge" ? { correctPlayerId: hostId } : {}) } as RoomAction;
    expect(() => rooms.applyAction(created.code, joined[0]!.playerToken, action))
      .toThrowError(expect.objectContaining({ code: "HOST_ONLY" }));
    const after = rooms.applyAction(created.code, created.hostToken, action);
    expect(after.gameState?.revision).toBe(2);
    expect(JSON.stringify(after.gameState?.publicData)).toContain(hostId);
    expect(() => rooms.applyAction(created.code, created.hostToken, action))
      .toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
  });

  it("rejects wrong-game actions and score/state forgery payloads", () => {
    const { rooms, created } = started("charades");
    expect(() => rooms.applyAction(created.code, created.hostToken, {
      type: "rapid-fire/mark", outcome: "correct",
    })).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    expect(() => rooms.applyAction(created.code, created.hostToken, {
      type: "charades/mark", outcome: "correct", score: 999,
    } as never)).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
  });

  it.each(["out-of-loop", "most-likely-to"] as const)("accepts one private vote per player and reveals after all vote in %s", (gameId) => {
    const { rooms, created, joined, room, advance } = started(gameId);
    const targetId = gameId === "out-of-loop"
      ? (room.gameState!.privateByPlayerId!.__server as any).outsider
      : room.players[0]!.id;
    const tokens = [created.playerToken, ...joined.map((entry) => entry.playerToken)];
    if (gameId === "out-of-loop") {
      rooms.applyAction(created.code, created.hostToken, { type: "out-of-loop/open-vote" });
    }
    for (const token of tokens) {
      rooms.applyAction(created.code, token, {
        type: gameId === "out-of-loop" ? "out-of-loop/vote" : "most-likely/vote",
        playerId: targetId,
      });
    }
    const state = rooms.get(created.code)!.gameState!.publicData as Record<string, unknown>;
    expect(state.phase).toBe(gameId === "out-of-loop" ? "outsider-guess" : "result");
    expect(JSON.stringify(state)).toContain(targetId);
    if (gameId === "out-of-loop") {
      const outsiderId = state.outsiderPlayerId as string;
      const outsider = room.players.find((candidate) => candidate.id === outsiderId)!;
      const word = (room.gameState!.privateByPlayerId!.__server as any).word.en;
      rooms.applyAction(created.code, outsider.playerToken, { type: "out-of-loop/guess", word });
      expect((rooms.get(created.code)!.gameState!.publicData as { phase: string }).phase).toBe("result");
    }
  });

  it.each(GAME_CATALOG.map((game) => game.id))("starts a fresh unused round and can return %s to lobby", (gameId) => {
    const { rooms, created, joined, room, advance } = started(gameId);
    const state = room.gameState!.publicData as Record<string, any>;
    const host = created.hostToken;
    if (gameId === "category-challenge") {
      rooms.applyAction(created.code, host, gameId === "category-challenge"
        ? { type: "category/score", correctPlayerId: room.players[1]!.id }
        : { type: "category/score", correctPlayerId: null });
    } else if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) {
      rooms.applyAction(created.code, host, {
        type: `${gameId}/mark`,
        outcome: "correct",
      } as never);
      advance(60_001);
      rooms.applyAction(created.code, host, { type: "timed/expire" });
    } else if (gameId === "who-am-i") {
      rooms.applyAction(created.code, created.playerToken, { type: "who-am-i/guess", correct: true });
    } else if (gameId === "most-likely-to") {
      for (const token of [created.playerToken, ...joined.map((item) => item.playerToken)]) {
        rooms.applyAction(created.code, token, { type: "most-likely/vote", playerId: room.players[0]!.id });
      }
    } else if (gameId === "out-of-loop") {
      const server = room.gameState!.privateByPlayerId!.__server as any;
      const outsider = room.players.find((player) => player.id === server.outsider)!;
      rooms.applyAction(created.code, host, { type: "out-of-loop/open-vote" });
      for (const token of [created.playerToken, ...joined.map((item) => item.playerToken)]) {
        rooms.applyAction(created.code, token, { type: "out-of-loop/vote", playerId: outsider.id });
      }
      rooms.applyAction(created.code, outsider.playerToken, { type: "out-of-loop/guess", word: "wrong" });
    } else {
      rooms.applyAction(created.code, created.playerToken, { type: "two-truths/submit", statements: ["A", "B", "C"], lieIndex: 1 });
      for (const item of joined) rooms.applyAction(created.code, item.playerToken, { type: "two-truths/vote", index: 1 });
    }
    const completed = rooms.get(created.code)!;
    const next = rooms.applyAction(created.code, host, { type: "game/next-round" });
    const nextState = next.gameState!.publicData as Record<string, any>;
    expect(nextState.round).toBe(2);
    const priorTurn = state.turnPlayerId ?? state.activePlayerId;
    if (priorTurn) expect(nextState.turnPlayerId ?? nextState.activePlayerId).not.toBe(priorTurn);
    if (gameId === "out-of-loop") {
      expect(next.gameState!.privateByPlayerId!.__server).not.toEqual(completed.gameState!.privateByPlayerId!.__server);
    }
    expect(nextState.promptIndex ?? 1).not.toBe(state.promptIndex ?? 0);
    expect(() => rooms.applyAction(created.code, joined[0]!.playerToken, { type: "game/return-lobby" }))
      .toThrowError(expect.objectContaining({ code: "HOST_ONLY" }));
    expect(rooms.applyAction(created.code, host, { type: "game/return-lobby" }).status).toBe("lobby");
    expect(completed.status).toBe("playing");
  });

  it.each(["charades", "forbidden-word", "rapid-fire"] as const)("runs a clock-enforced multi-prompt team round for %s", (gameId) => {
    const { rooms, created, room, advance } = started(gameId);
    const first = room.gameState!.publicData as Record<string, any>;
    const mark = (outcome: string) => rooms.applyAction(created.code, created.hostToken, {
      type: `${gameId}/mark`, outcome,
    } as never);
    mark("correct");
    mark("skip");
    if (gameId === "charades") mark("failed");
    if (gameId === "forbidden-word") {
      mark("correct");
      mark("violation");
    }
    const active = rooms.get(created.code)!.gameState!.publicData as Record<string, any>;
    expect(active.promptIndex).toBeGreaterThan(first.promptIndex);
    expect(new Set(active.roundPromptHistory).size).toBe(active.roundPromptHistory.length);
    expect(active.teamScores[active.activeTeamId]).toBeGreaterThanOrEqual(active.roundStartScore);
    expect(() => rooms.applyAction(created.code, created.hostToken, { type: "timed/expire" }))
      .toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    advance(60_001);
    expect(() => mark("correct")).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    const result = rooms.get(created.code)!;
    expect(() => rooms.applyAction(created.code, created.hostToken, { type: "timed/expire" }))
      .toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    expect((result.gameState!.publicData as Record<string, any>).phase).toBe("result");
    const next = rooms.applyAction(created.code, created.hostToken, { type: "game/next-round" });
    const nextState = next.gameState!.publicData as Record<string, any>;
    expect(nextState.activeTeamId).not.toBe(first.activeTeamId);
    expect(nextState.activeActorId).not.toBe(first.activeActorId);
    expect(nextState.timerEndsAt).toBeGreaterThan(active.timerEndsAt);
  });

  it("allows only the intended player to resolve Who Am I without exposing their identity", () => {
    const { rooms, created, joined, room } = started("who-am-i");
    const turn = (room.gameState!.publicData as { turnPlayerId: string }).turnPlayerId;
    const turnPlayer = room.players.find((player) => player.id === turn)!;
    const wrong = turnPlayer.isHost ? joined[0]!.playerToken : created.playerToken;
    expect(() => rooms.applyAction(created.code, wrong, { type: "who-am-i/guess", correct: true }))
      .toThrowError(expect.objectContaining({ code: "PLAYER_ONLY" }));
    const view = toPlayerView(room, turnPlayer.playerToken);
    expect(JSON.stringify(view)).not.toContain("Albert Einstein");
    const after = rooms.applyAction(created.code, turnPlayer.playerToken, { type: "who-am-i/guess", correct: true });
    expect((after.gameState!.publicData as { phase: string }).phase).toBe("result");
    expect(() => rooms.applyAction(created.code, turnPlayer.playerToken, { type: "who-am-i/guess", correct: true }))
      .toThrowError(expect.objectContaining({ code: "PLAYER_ONLY" }));
  });

  it.each(["charades", "forbidden-word", "rapid-fire"] as const)("keeps %s prompts private to host/active actor", (gameId) => {
    const { room, created, joined } = started(gameId);
    expect(JSON.stringify(room.gameState!.publicData)).not.toContain('"prompt"');
    const host = toPlayerView(room, created.playerToken);
    const guesser = toPlayerView(room, joined[0]!.playerToken);
    expect(host.gameState!.privateData).toHaveProperty("prompt");
    expect(guesser.gameState!.privateData).toBeUndefined();
    if (gameId === "forbidden-word") {
      expect(host.gameState!.privateData).toHaveProperty("forbidden");
      expect(guesser.gameState!.privateData).toBeUndefined();
    }
  });

  it("completes a private Two Truths submission, votes, and reveal without leaking the lie early", () => {
    const { rooms, created, joined, room } = started("two-truths-lie");
    const turn = (room.gameState!.publicData as { turnPlayerId: string }).turnPlayerId;
    const turnPlayer = room.players.find((player) => player.id === turn)!;
    rooms.applyAction(created.code, turnPlayer.playerToken, {
      type: "two-truths/submit",
      statements: ["I swim", "I fly", "I cook"],
      lieIndex: 1,
    });
    const voting = rooms.get(created.code)!;
    expect(JSON.stringify(toPlayerView(voting, joined[0]!.playerToken))).not.toContain('"lieIndex"');
    for (const player of voting.players.filter((player) => player.id !== turn)) {
      rooms.applyAction(created.code, player.playerToken, { type: "two-truths/vote", index: 1 });
    }
    const result = rooms.get(created.code)!.gameState!.publicData as Record<string, unknown>;
    expect(result).toMatchObject({
      phase: "result",
      lieIndex: (result.statements as string[]).indexOf("I fly"),
    });
  });

  it("ends Out of Loop immediately with an outsider win when the vote misses", () => {
    const { rooms, created, joined, room } = started("out-of-loop");
    rooms.applyAction(created.code, created.hostToken, { type: "out-of-loop/open-vote" });
    for (const token of [created.playerToken, ...joined.map((item) => item.playerToken)]) {
      rooms.applyAction(created.code, token, { type: "out-of-loop/vote", playerId: room.players[1]!.id });
    }
    const state = rooms.get(created.code)!.gameState!.publicData as Record<string, any>;
    expect(state).toMatchObject({ phase: "result", caught: false, outsiderCorrect: true });
    expect(state.scores[state.outsiderPlayerId]).toBe(1);
    expect(state.word).toBeDefined();
  });
});
