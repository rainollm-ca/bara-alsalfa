import type { GameId, Locale } from "../games/types";
import { ROOM_CONTRACT_VERSION, type PlayerRoomView, type RoomAction } from "./contracts";

export type RoomSession = {
  code: string;
  playerToken: string;
  hostToken?: string;
  name: string;
};

export type RoomEnvelope = {
  contractVersion: 1;
  room: PlayerRoomView;
  code?: string;
  playerToken?: string;
  hostToken?: string;
  reconnected?: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Fetcher = typeof fetch;

export const roomSessionKey = (code: string) => `bara-room:${code.toUpperCase()}`;

export function readRoomSession(storage: StorageLike, code: string): RoomSession | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(roomSessionKey(code)) ?? "null");
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<RoomSession>;
    if (
      !/^[A-Z0-9]{6}$/.test(session.code ?? "") ||
      session.code !== code.toUpperCase() ||
      typeof session.playerToken !== "string" ||
      session.playerToken.length < 12 ||
      typeof session.name !== "string"
    ) return null;
    if (session.hostToken !== undefined && session.hostToken.length < 12) return null;
    return session as RoomSession;
  } catch {
    return null;
  }
}

export function writeRoomSession(storage: StorageLike, session: RoomSession) {
  const normalized = { ...session, code: session.code.toUpperCase() };
  storage.setItem(roomSessionKey(normalized.code), JSON.stringify(normalized));
}

export class RoomClientError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export function createRoomClient({
  fetcher = fetch,
  pollIntervalMs = 2_000,
}: {
  fetcher?: Fetcher;
  pollIntervalMs?: number;
} = {}) {
  async function request(url: string, init: RequestInit): Promise<RoomEnvelope> {
    const response = await fetcher(url, init);
    const payload = await response.json().catch(() => null) as
      | RoomEnvelope
      | { error?: { code?: string; message?: string } }
      | null;
    if (!response.ok) {
      const error = payload && "error" in payload ? payload.error : undefined;
      throw new RoomClientError(
        error?.code ?? "NETWORK_ERROR",
        error?.message ?? "Room request failed.",
        response.status,
      );
    }
    return payload as RoomEnvelope;
  }

  return {
    create(input: { hostName: string; locale: Locale; gameId: GameId }, signal?: AbortSignal) {
      return request("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractVersion: ROOM_CONTRACT_VERSION, ...input }),
        signal,
      });
    },
    join(code: string, input: { name: string; playerToken?: string }, signal?: AbortSignal) {
      return request(`/api/rooms/${code.toUpperCase()}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractVersion: ROOM_CONTRACT_VERSION, ...input }),
        signal,
      });
    },
    state(code: string, playerToken: string) {
      return request(`/api/rooms/${code.toUpperCase()}/state`, {
        headers: { authorization: `Bearer ${playerToken}` },
      });
    },
    action(code: string, token: string, action: RoomAction) {
      return request(`/api/rooms/${code.toUpperCase()}/action`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contractVersion: ROOM_CONTRACT_VERSION, action }),
      });
    },
    poll(
      code: string,
      token: string,
      onState: (room: PlayerRoomView) => void,
      onError: (error: RoomClientError) => void,
    ) {
      let active = true;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const run = async () => {
        try {
          const result = await this.state(code, token);
          if (active) onState(result.room);
        } catch (error) {
          if (active) onError(
            error instanceof RoomClientError
              ? error
              : new RoomClientError("NETWORK_ERROR", "Connection lost.", 0),
          );
        } finally {
          if (active) timeout = setTimeout(run, pollIntervalMs);
        }
      };
      void run();
      return () => {
        active = false;
        if (timeout) clearTimeout(timeout);
      };
    },
  };
}

export type RoomClient = ReturnType<typeof createRoomClient>;
