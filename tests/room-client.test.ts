import { describe, expect, it, vi } from "vitest";

import {
  createRoomClient,
  readRoomSession,
  roomSessionKey,
  writeRoomSession,
} from "../src/rooms/client";

describe("room browser client", () => {
  it("stores only validated reconnect credentials and ignores corrupt storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    writeRoomSession(storage, {
      code: "abc123",
      playerToken: "player-secret-token",
      hostToken: "host-secret-token",
      name: "Host",
    });
    expect(readRoomSession(storage, "ABC123")).toMatchObject({
      code: "ABC123",
      playerToken: "player-secret-token",
    });
    values.set(roomSessionKey("ABC123"), '{"code":"wrong"}');
    expect(readRoomSession(storage, "ABC123")).toBeNull();
  });

  it("uses bearer auth for polling and stops polling cleanly", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ contractVersion: 1, room: { revision: 2 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createRoomClient({ fetcher, pollIntervalMs: 20 });
    const onState = vi.fn();
    const stop = client.poll("ABC123", "secret", onState, vi.fn());
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/rooms/ABC123/state",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
      }),
    );
    expect(onState).toHaveBeenCalled();
    stop();
    const calls = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(fetcher).toHaveBeenCalledTimes(calls);
    vi.useRealTimers();
  });
});
