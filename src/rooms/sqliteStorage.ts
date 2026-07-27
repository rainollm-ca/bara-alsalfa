import Database from "better-sqlite3";

import type { Room } from "./contracts";
import type { RoomStorage } from "./repository";

export class SQLiteRoomStorage implements RoomStorage {
  private readonly database: Database.Database;

  constructor(path: string) {
    this.database = new Database(path);
    this.database.pragma("busy_timeout = 5000");
    this.database.pragma("journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rooms_expires_at ON rooms(expires_at);
      CREATE TABLE IF NOT EXISTS create_attempts (
        ip TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS create_attempts_ip_time ON create_attempts(ip, created_at);
    `);
  }

  get(code: string): Room | undefined {
    const row = this.database.prepare("SELECT payload FROM rooms WHERE code = ?").get(code) as
      | { payload: string }
      | undefined;
    return row ? JSON.parse(row.payload) as Room : undefined;
  }

  set(code: string, room: Room): void {
    this.database.prepare(`
      INSERT INTO rooms(code, expires_at, payload) VALUES (?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET expires_at = excluded.expires_at, payload = excluded.payload
    `).run(code, room.expiresAt, JSON.stringify(room));
  }

  delete(code: string): void {
    this.database.prepare("DELETE FROM rooms WHERE code = ?").run(code);
  }

  values(): Room[] {
    return (this.database.prepare("SELECT payload FROM rooms").all() as { payload: string }[])
      .map((row) => JSON.parse(row.payload) as Room);
  }

  transaction<T>(operation: () => T): T {
    return this.database.transaction(operation).immediate();
  }

  consumeCreate(ip: string, now: number, limit: number, windowMs: number): boolean {
    this.database.prepare("DELETE FROM create_attempts WHERE created_at <= ?").run(now - windowMs);
    const row = this.database.prepare(
      "SELECT COUNT(*) AS count FROM create_attempts WHERE ip = ? AND created_at > ?",
    ).get(ip, now - windowMs) as { count: number };
    if (row.count >= limit) return false;
    this.database.prepare("INSERT INTO create_attempts(ip, created_at) VALUES (?, ?)").run(ip, now);
    return true;
  }

  close(): void {
    this.database.close();
  }
}
