import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GET } from "../src/app/api/health/route";
import { checkRoomDatabaseHealth } from "../src/rooms/health";

const originalPath = process.env.ROOM_DB_PATH;

afterEach(() => {
  if (originalPath === undefined) delete process.env.ROOM_DB_PATH;
  else process.env.ROOM_DB_PATH = originalPath;
});

describe("room database health", () => {
  it("proves the configured database is writable without persisting health state", () => {
    const path = join(mkdtempSync(join(tmpdir(), "bara-health-")), "rooms.sqlite");

    expect(checkRoomDatabaseHealth(path)).toBe(true);

    const database = new Database(path, { readonly: true });
    const persistedHealthTables = database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_room_healthcheck'",
    ).all();
    database.close();
    expect(persistedHealthTables).toEqual([]);
  });

  it.each([
    ["unwritable", "/proc/bara-party-health/rooms.sqlite"],
    ["misconfigured", "/dev/null"],
  ])("returns a generic 503 response for an %s database path", async (_label, path) => {
    process.env.ROOM_DB_PATH = path;

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unhealthy",
      error: { code: "DATABASE_UNAVAILABLE" },
    });
  });

  it("returns healthy only after a writable database preflight", async () => {
    process.env.ROOM_DB_PATH = join(
      mkdtempSync(join(tmpdir(), "bara-health-route-")),
      "rooms.sqlite",
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "healthy" });
  });
});
