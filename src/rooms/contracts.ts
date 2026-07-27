import type { GameId, Locale } from "../games/types";

export const ROOM_CONTRACT_VERSION = 1 as const;
export type RoomContractVersion = typeof ROOM_CONTRACT_VERSION;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RoomStatus = "lobby" | "playing";

export type RoomPlayer = Readonly<{
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  lastSeenAt: number;
  playerToken: string;
  privateData?: JsonValue;
}>;

export type RoomEvent =
  | Readonly<{
      type: "player/joined";
      playerId: string;
      at: number;
    }>
  | Readonly<{
      type: "player/reconnected";
      playerId: string;
      at: number;
    }>
  | Readonly<{
      type: "player/removed";
      playerId: string;
      at: number;
    }>
  | Readonly<{
      type: "lobby/game-selected";
      gameId: GameId;
      at: number;
    }>
  | Readonly<{
      type: "room/status-changed";
      status: RoomStatus;
      at: number;
    }>
  | Readonly<{
      type: "game/action-applied";
      playerId: string;
      actionType: string;
      at: number;
    }>;

export type RoomGameState = Readonly<{
  revision: number;
  publicData: JsonValue | null;
  privateByPlayerId?: Readonly<Record<string, JsonValue>>;
}>;

export type Room = Readonly<{
  contractVersion: RoomContractVersion;
  code: string;
  hostToken: string;
  hostPlayerId: string;
  locale: Locale;
  status: RoomStatus;
  selectedGame: GameId | null;
  players: readonly RoomPlayer[];
  gameState: RoomGameState | null;
  events: readonly RoomEvent[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  revision: number;
}>;

export type CreateRoomInput = Readonly<{
  hostName: string;
  locale?: Locale;
  privateData?: JsonValue;
}>;

export type JoinRoomInput = Readonly<{
  name: string;
  playerToken?: string;
  privateData?: JsonValue;
}>;

export type HostRoomAction =
  | Readonly<{ type: "lobby/select-game"; gameId: GameId }>
  | Readonly<{ type: "lobby/start" }>
  | Readonly<{ type: "lobby/return" }>
  | Readonly<{ type: "lobby/remove-player"; playerId: string }>;

export type GameRoomAction =
  | Readonly<{ type: "game/next-round" }>
  | Readonly<{ type: "game/return-lobby" }>
  | Readonly<{ type: "category/score"; correctPlayerId: string | null }>
  | Readonly<{ type: "charades/mark"; outcome: "correct" | "skip" | "failed" }>
  | Readonly<{ type: "forbidden-word/mark"; outcome: "correct" | "skip" | "violation" }>
  | Readonly<{ type: "rapid-fire/mark"; outcome: "correct" | "skip" }>
  | Readonly<{ type: "timed/expire" }>
  | Readonly<{ type: "out-of-loop/vote"; playerId: string }>
  | Readonly<{ type: "out-of-loop/open-vote" }>
  | Readonly<{ type: "out-of-loop/guess"; word: string }>
  | Readonly<{ type: "most-likely/vote"; playerId: string }>
  | Readonly<{ type: "who-am-i/guess"; correct: boolean }>
  | Readonly<{
      type: "two-truths/submit";
      statements: readonly [string, string, string];
      lieIndex: 0 | 1 | 2;
    }>
  | Readonly<{ type: "two-truths/vote"; index: 0 | 1 | 2 }>;

export type RoomAction = HostRoomAction | GameRoomAction;

export type PublicRoomPlayer = Readonly<{
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  lastSeenAt: number;
}>;

export type SelfRoomPlayer = PublicRoomPlayer &
  Readonly<{ privateData?: JsonValue }>;

export type PlayerRoomView = Readonly<{
  contractVersion: RoomContractVersion;
  code: string;
  locale: Locale;
  status: RoomStatus;
  selectedGame: GameId | null;
  players: readonly PublicRoomPlayer[];
  self: SelfRoomPlayer;
  gameState: Readonly<{
    revision: number;
    publicData: JsonValue | null;
    privateData?: JsonValue;
  }> | null;
  events: readonly RoomEvent[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  revision: number;
}>;
