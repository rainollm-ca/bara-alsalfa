import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RoomRepository } from "../src/rooms/repository";
import { SQLiteRoomStorage } from "../src/rooms/sqliteStorage";

function tempDb() {
  return join(mkdtempSync(join(tmpdir(), "bara-rooms-")), "rooms.sqlite");
}

describe("SQLite room persistence", () => {
  it("shares mutations across repository instances and survives reopen", () => {
    const path = tempDb();
    const storageA = new SQLiteRoomStorage(path);
    const storageB = new SQLiteRoomStorage(path);
    const a = new RoomRepository({ storage: storageA, codeFactory: () => "ABC123" });
    const b = new RoomRepository({ storage: storageB });
    const created = a.create({ hostName: "Host" });
    expect(b.get(created.code)?.players).toHaveLength(1);
    b.join(created.code, { name: "Guest" });
    expect(a.get(created.code)?.players.map((player) => player.name)).toEqual(["Host", "Guest"]);
    storageA.close();
    storageB.close();

    const reopened = new SQLiteRoomStorage(path);
    expect(new RoomRepository({ storage: reopened }).get(created.code)?.players).toHaveLength(2);
    reopened.close();
  });

  it("touches authenticated polling transactionally so active rooms remain alive", () => {
    let now = 1_000;
    const storage = new SQLiteRoomStorage(tempDb());
    const rooms = new RoomRepository({
      storage,
      clock: () => now,
      inactivityMs: 100,
      codeFactory: () => "LIVE12",
    });
    const created = rooms.create({ hostName: "Host" });
    now += 80;
    const touched = rooms.touch(created.code, created.playerToken);
    expect(touched.players[0]?.lastSeenAt).toBe(now);
    expect(touched.expiresAt).toBe(1_180);
    now += 80;
    expect(rooms.get(created.code)).toBeDefined();
    now += 21;
    expect(rooms.get(created.code)).toBeUndefined();
    storage.close();
  });

  it("caps event history and active room count while reclaiming expired rooms", () => {
    let now = 1_000;
    let code = 100_000;
    const storage = new SQLiteRoomStorage(tempDb());
    const rooms = new RoomRepository({
      storage,
      clock: () => now,
      inactivityMs: 100,
      maxRooms: 1,
      codeFactory: () => String(++code),
    });
    const created = rooms.create({ hostName: "Host" });
    for (let index = 0; index < 120; index += 1) {
      rooms.join(created.code, { name: "Host", playerToken: created.playerToken });
    }
    expect(rooms.get(created.code)?.events).toHaveLength(100);
    expect(() => rooms.create({ hostName: "Blocked" })).toThrowError(
      expect.objectContaining({ code: "ROOM_CAPACITY" }),
    );
    now += 101;
    expect(rooms.create({ hostName: "After expiry" }).code).toBe("100002");
    storage.close();
  });

  it("finalizes a timed round once across repository instances during authenticated polling", () => {
    let now = 5_000;
    const previousDuration = process.env.ROOM_ROUND_DURATION_MS;
    process.env.ROOM_ROUND_DURATION_MS = "100";
    const path = tempDb();
    const storageA = new SQLiteRoomStorage(path);
    const storageB = new SQLiteRoomStorage(path);
    const options = { clock: () => now, randomInt: () => 0 };
    const a = new RoomRepository({ ...options, storage: storageA, codeFactory: () => "TIME12" });
    const b = new RoomRepository({ ...options, storage: storageB });
    try {
      const created = a.create({ hostName: "Host" });
      const guests = ["One", "Two", "Three"].map((name) => a.join(created.code, { name }));
      a.applyAction(created.code, created.hostToken, { type: "lobby/select-game", gameId: "charades" });
      a.applyAction(created.code, created.hostToken, { type: "lobby/start" });
      now += 100;
      const finalized = b.touch(created.code, guests[0]!.playerToken);
      expect((finalized.gameState!.publicData as any).phase).toBe("result");
      const revision = finalized.gameState!.revision;
      expect((a.get(created.code)!.gameState!.publicData as any).phase).toBe("result");
      expect(a.get(created.code)!.gameState!.revision).toBe(revision);
      expect(() => a.applyAction(created.code, created.hostToken, {
        type: "charades/mark", outcome: "correct",
      })).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
      expect(() => b.applyAction(created.code, created.hostToken, {
        type: "timed/expire",
      })).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    } finally {
      storageA.close();
      storageB.close();
      if (previousDuration === undefined) delete process.env.ROOM_ROUND_DURATION_MS;
      else process.env.ROOM_ROUND_DURATION_MS = previousDuration;
    }
  });

  it("persists randomized cycle state across restart and avoids an outsider boundary duplicate", () => {
    const path = tempDb();
    let storage = new SQLiteRoomStorage(path);
    let rooms = new RoomRepository({
      storage,
      codeFactory: () => "CYCL12",
      randomInt: () => 0,
    });
    const created = rooms.create({ hostName: "Host" });
    const joined = ["One", "Two"].map((name) => rooms.join(created.code, { name }));
    const tokens = [created.playerToken, ...joined.map((entry) => entry.playerToken)];
    rooms.applyAction(created.code, created.hostToken, {
      type: "lobby/select-game", gameId: "out-of-loop",
    });
    rooms.applyAction(created.code, created.hostToken, { type: "lobby/start" });
    const selected: string[] = [];
    for (let round = 0; round < 7; round += 1) {
      const room = rooms.get(created.code)!;
      const outsider = (room.gameState!.privateByPlayerId!.__server as any).outsider as string;
      selected.push(outsider);
      const target = room.players.find((player) => player.id !== outsider)!.id;
      rooms.applyAction(created.code, created.hostToken, { type: "out-of-loop/open-vote" });
      for (const token of tokens) {
        rooms.applyAction(created.code, token, { type: "out-of-loop/vote", playerId: target });
      }
      if (round === 2) {
        storage.close();
        storage = new SQLiteRoomStorage(path);
        rooms = new RoomRepository({ storage, randomInt: () => 0 });
      }
      if (round < 6) {
        rooms.applyAction(created.code, created.hostToken, { type: "game/next-round" });
      }
    }
    expect(selected).toEqual([
      created.playerId, joined[0]!.playerId, joined[1]!.playerId,
      created.playerId, joined[0]!.playerId, joined[1]!.playerId,
      created.playerId,
    ]);
    expect((rooms.get(created.code)!.gameState!.privateByPlayerId!.__server as any).outsiderHistory)
      .toEqual([0]);
    storage.close();
  });
});
