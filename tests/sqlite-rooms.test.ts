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
});
