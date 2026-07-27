import { describe, expect, it } from "vitest";

import { GAME_CATALOG } from "../src/games/catalog";
import type { GameId } from "../src/games/types";
import type { RoomAction } from "../src/rooms/contracts";
import { RoomRepository } from "../src/rooms/repository";
import { toPlayerView } from "../src/rooms/playerView";

function started(gameId: GameId, players = ["Host", "Guest", "Third", "Fourth"]) {
  const rooms = new RoomRepository({ codeFactory: () => "PLAY12" });
  const created = rooms.create({ hostName: players[0]! });
  const joined = players.slice(1).map((name) => rooms.join(created.code, { name }));
  rooms.applyAction(created.code, created.hostToken, { type: "lobby/select-game", gameId });
  const room = rooms.applyAction(created.code, created.hostToken, { type: "lobby/start" });
  return { rooms, created, joined, room };
}

describe("authoritative room game reducers", () => {
  it.each(GAME_CATALOG.map((game) => game.id))("initializes %s with bounded authoritative state", (gameId) => {
    const { room } = started(gameId);
    expect(room.gameState?.publicData).toMatchObject({ gameId, round: 1 });
    expect(room.gameState?.revision).toBe(1);
  });

  it.each([
    ["category-challenge", { type: "category/score", correctPlayerId: "host" }],
    ["charades", { type: "charades/score", correct: true }],
    ["forbidden-word", { type: "forbidden-word/score", correct: true }],
    ["rapid-fire", { type: "rapid-fire/score", correct: true }],
  ] as const)("lets only host advance authoritative %s rounds", (gameId, partial) => {
    const { rooms, created, joined, room } = started(gameId);
    const hostId = room.hostPlayerId;
    const action = { ...partial, type: partial.type, ...(gameId === "category-challenge" ? { correctPlayerId: hostId } : {}) } as RoomAction;
    expect(() => rooms.applyAction(created.code, joined[0]!.playerToken, action))
      .toThrowError(expect.objectContaining({ code: "HOST_ONLY" }));
    const after = rooms.applyAction(created.code, created.hostToken, action);
    expect(after.gameState?.revision).toBe(2);
    expect(JSON.stringify(after.gameState?.publicData)).toContain(hostId);
  });

  it("rejects wrong-game actions and score/state forgery payloads", () => {
    const { rooms, created } = started("charades");
    expect(() => rooms.applyAction(created.code, created.hostToken, {
      type: "rapid-fire/score", correct: true,
    })).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    expect(() => rooms.applyAction(created.code, created.hostToken, {
      type: "charades/score", correct: true, score: 999,
    } as never)).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
  });

  it.each(["out-of-loop", "most-likely-to"] as const)("accepts one private vote per player and reveals after all vote in %s", (gameId) => {
    const { rooms, created, joined, room } = started(gameId);
    const targetId = room.players[0]!.id;
    const tokens = [created.playerToken, ...joined.map((entry) => entry.playerToken)];
    for (const token of tokens) {
      rooms.applyAction(created.code, token, {
        type: gameId === "out-of-loop" ? "out-of-loop/vote" : "most-likely/vote",
        playerId: targetId,
      });
    }
    const state = rooms.get(created.code)!.gameState!.publicData as Record<string, unknown>;
    expect(state.phase).toBe("result");
    expect(JSON.stringify(state)).toContain(targetId);
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
    expect(result).toMatchObject({ phase: "result", lieIndex: 1 });
  });
});
