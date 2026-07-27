import { describe, expect, it } from "vitest";

import {
  ROOM_CONTRACT_VERSION,
  type RoomAction,
} from "../src/rooms/contracts";
import {
  RoomError,
  RoomRepository,
  type RoomRepositoryOptions,
} from "../src/rooms/repository";
import { toPlayerView } from "../src/rooms/playerView";

function harness(overrides: Partial<RoomRepositoryOptions> = {}) {
  let now = 1_000;
  let tokenNumber = 0;
  const codes = ["ABC123", "XYZ789"];
  const repository = new RoomRepository({
    clock: () => now,
    codeFactory: () => codes.shift() ?? "ZZZ999",
    tokenFactory: () => `secure-token-${++tokenNumber}`,
    inactivityMs: 60_000,
    maxPlayers: 3,
    ...overrides,
  });

  return {
    repository,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("RoomRepository", () => {
  it("creates a versioned room with a six-character code and separate host/player tokens", () => {
    const { repository } = harness();

    const created = repository.create({ hostName: "Host", locale: "ar" });

    expect(created.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.hostToken).toBe("secure-token-1");
    expect(created.playerToken).toBe("secure-token-2");
    expect(created.hostToken).not.toBe(created.playerToken);
    expect(created.room.contractVersion).toBe(ROOM_CONTRACT_VERSION);
    expect(created.room.status).toBe("lobby");
  });

  it("rejects invalid factory output, retries code collisions, and enforces the join limit", () => {
    const collisionCodes = ["ABC123", "ABC123", "DEF456"];
    const { repository } = harness({
      maxPlayers: 2,
      codeFactory: () => collisionCodes.shift() ?? "GHI789",
    });
    const first = repository.create({ hostName: "Host" });
    const second = repository.create({ hostName: "Other host" });

    expect(first.code).toBe("ABC123");
    expect(second.code).toBe("DEF456");
    repository.join(first.code, { name: "Guest" });
    expect(() => repository.join(first.code, { name: "Late guest" })).toThrowError(
      expect.objectContaining({ code: "ROOM_FULL" }),
    );

    const invalid = harness({ codeFactory: () => "__proto__" }).repository;
    expect(() => invalid.create({ hostName: "Host" })).toThrowError(
      expect.objectContaining({ code: "CODE_GENERATION_FAILED" }),
    );
  });

  it("never reuses a token, even when an injected generator collides", () => {
    const tokens = [
      "secure-token-a",
      "secure-token-b",
      "secure-token-a",
      "secure-token-c",
      "secure-token-d",
    ];
    const { repository } = harness({
      tokenFactory: () => tokens.shift() ?? "secure-token-z",
    });
    repository.create({ hostName: "First" });
    const second = repository.create({ hostName: "Second" });

    expect(second.hostToken).toBe("secure-token-c");
    expect(second.playerToken).toBe("secure-token-d");
  });

  it("validates create input before reserving tokens", () => {
    const tokens = ["secure-token-a", "secure-token-b"];
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const { repository } = harness({
      tokenFactory: () => tokens.shift() ?? "unexpected-token",
    });

    expect(() =>
      repository.create({ hostName: 42 as unknown as string }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_NAME" }));
    expect(() =>
      repository.create({
        hostName: "Host",
        privateData: cyclic as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_PAYLOAD" }));
    expect(() =>
      repository.create({
        hostName: "Host",
        privateData: { createdAt: new Date() } as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_PAYLOAD" }));

    const created = repository.create({ hostName: "Valid host" });
    expect(created.hostToken).toBe("secure-token-a");
    expect(created.playerToken).toBe("secure-token-b");
  });

  it("validates join input before reserving its player token", () => {
    const tokens = [
      "secure-token-host",
      "secure-token-player",
      "secure-token-guest",
    ];
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const { repository } = harness({
      tokenFactory: () => tokens.shift() ?? "unexpected-token",
    });
    const created = repository.create({ hostName: "Host" });

    expect(() =>
      repository.join(created.code, { name: null as unknown as string }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_NAME" }));
    expect(() =>
      repository.join(created.code, {
        name: "Guest",
        privateData: cyclic as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_PAYLOAD" }));

    expect(repository.join(created.code, { name: "Valid guest" }).playerToken).toBe(
      "secure-token-guest",
    );
  });

  it("expires inactive rooms and does not refresh activity for reads", () => {
    const { repository, advance } = harness();
    const created = repository.create({ hostName: "Host" });

    advance(59_999);
    expect(repository.get(created.code)).toBeDefined();
    advance(2);

    expect(repository.get(created.code)).toBeUndefined();
    expect(repository.expire()).toEqual([]);
  });

  it("allows only the host to perform host actions and keeps state immutable", () => {
    const { repository } = harness();
    const created = repository.create({ hostName: "Host" });
    const joined = repository.join(created.code, { name: "Guest" });
    const before = repository.get(created.code)!;
    const action: RoomAction = {
      type: "lobby/select-game",
      gameId: "charades",
    };

    expect(() =>
      repository.applyAction(created.code, joined.playerToken, action),
    ).toThrowError(expect.objectContaining({ code: "HOST_ONLY" }));

    const after = repository.applyAction(created.code, created.hostToken, action);
    expect(after.selectedGame).toBe("charades");
    expect(before.selectedGame).toBeNull();
    expect(after).not.toBe(before);
    expect(after.players).not.toBe(before.players);
  });

  it("deeply freezes caller-supplied private state", () => {
    const { repository } = harness();
    const privateData = { nested: { role: "spy" } };
    const created = repository.create({ hostName: "Host", privateData });
    privateData.nested.role = "changed outside";

    const stored = created.room.players[0]?.privateData as {
      nested: { role: string };
    };
    expect(stored.nested.role).toBe("spy");
    expect(Object.isFrozen(stored.nested)).toBe(true);
  });

  it("reconnects by player token without creating a duplicate player", () => {
    const { repository } = harness();
    const created = repository.create({ hostName: "Host" });
    const joined = repository.join(created.code, { name: "Guest" });

    const reconnected = repository.join(created.code, {
      name: "A different submitted name",
      playerToken: joined.playerToken,
    });

    expect(reconnected.reconnected).toBe(true);
    expect(reconnected.playerToken).toBe(joined.playerToken);
    expect(reconnected.room.players).toHaveLength(2);
    expect(reconnected.room.players[1]?.name).toBe("Guest");
  });

  it("projects only the requesting player's private data and leaks no tokens", () => {
    const { repository } = harness();
    const created = repository.create({
      hostName: "Host",
      privateData: { role: "spy" },
    });
    const joined = repository.join(created.code, {
      name: "Guest",
      privateData: { role: "civilian" },
    });
    const room = repository.get(created.code)!;

    const view = toPlayerView(room, joined.playerToken);
    expect(view.self.privateData).toEqual({ role: "civilian" });
    expect(view.players.find((player) => player.id === created.playerId)).not.toHaveProperty(
      "privateData",
    );
    expect(JSON.stringify(view)).not.toContain(created.hostToken);
    expect(JSON.stringify(view)).not.toContain(joined.playerToken);
    expect(() => toPlayerView(room, "not-a-token")).toThrow(RoomError);
  });

  it("rejects malformed, unknown, and non-JSON actions with typed errors", () => {
    const { repository } = harness();
    const created = repository.create({ hostName: "Host" });
    const malformedActions = [
      {},
      { type: 42 },
      { type: "unknown/action" },
    ] as unknown as RoomAction[];

    for (const action of malformedActions) {
      expect(() =>
        repository.applyAction(created.code, created.hostToken, action),
      ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    }

    repository.applyAction(created.code, created.hostToken, {
      type: "lobby/select-game",
      gameId: "charades",
    });
    repository.applyAction(created.code, created.hostToken, {
      type: "lobby/start",
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      repository.applyAction(created.code, created.playerToken, {
        type: "game/action",
        actionType: "submit",
        payload: cyclic as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_PAYLOAD" }));
  });
});
