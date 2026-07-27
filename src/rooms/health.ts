import Database from "better-sqlite3";
import { join } from "node:path";

export function configuredRoomDatabasePath(): string {
  return process.env.ROOM_DB_PATH ?? join(process.cwd(), "data", "rooms.sqlite");
}

export function checkRoomDatabaseHealth(path: string): boolean {
  let database: Database.Database | undefined;
  try {
    database = new Database(path, { timeout: 1_000 });
    database.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS _room_healthcheck (
        checked_at INTEGER NOT NULL
      );
      INSERT INTO _room_healthcheck(checked_at) VALUES (unixepoch());
      SELECT checked_at FROM _room_healthcheck LIMIT 1;
      ROLLBACK;
    `);
    return true;
  } catch {
    if (database?.inTransaction) {
      try {
        database.exec("ROLLBACK");
      } catch {}
    }
    return false;
  } finally {
    try {
      database?.close();
    } catch {}
  }
}
