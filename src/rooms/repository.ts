import {
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  ROOM_CONTRACT_VERSION,
  type CreateRoomInput,
  type JoinRoomInput,
  type JsonValue,
  type Room,
  type RoomAction,
  type RoomEvent,
  type RoomPlayer,
} from "./contracts";
import { initializeGame, nextGameRound, reduceGame } from "./gameplay";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^[A-Z0-9]{6}$/;
const DEFAULT_INACTIVITY_MS = 30 * 60 * 1_000;
const DEFAULT_MAX_PLAYERS = 12;
const GENERATION_ATTEMPTS = 32;

export type RoomErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_EXPIRED"
  | "ROOM_FULL"
  | "INVALID_NAME"
  | "INVALID_PAYLOAD"
  | "INVALID_TOKEN"
  | "HOST_ONLY"
  | "INVALID_ACTION"
  | "CODE_GENERATION_FAILED"
  | "TOKEN_GENERATION_FAILED"
  | "ROOM_CAPACITY"
  | "PLAYER_ONLY";

export class RoomError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export type RoomRepositoryOptions = Readonly<{
  clock?: () => number;
  codeFactory?: () => string;
  tokenFactory?: () => string;
  idFactory?: () => string;
  inactivityMs?: number;
  maxPlayers?: number;
  maxRooms?: number;
  storage?: RoomStorage;
}>;

export interface RoomStorage {
  get(code: string): Room | undefined;
  set(code: string, room: Room): void;
  delete(code: string): void;
  values(): Room[];
  transaction<T>(operation: () => T): T;
  consumeCreate?(ip: string, now: number, limit: number, windowMs: number): boolean;
}

class MemoryRoomStorage implements RoomStorage {
  private readonly rooms = new Map<string, Room>();
  private readonly creates = new Map<string, number[]>();
  get(code: string) { return this.rooms.get(code); }
  set(code: string, room: Room) { this.rooms.set(code, room); }
  delete(code: string) { this.rooms.delete(code); }
  values() { return [...this.rooms.values()]; }
  transaction<T>(operation: () => T) { return operation(); }
  consumeCreate(ip: string, now: number, limit: number, windowMs: number) {
    const recent = (this.creates.get(ip) ?? []).filter((time) => time > now - windowMs);
    if (recent.length >= limit) return false;
    recent.push(now);
    this.creates.set(ip, recent);
    return true;
  }
}

export type CreateRoomResult = Readonly<{
  code: string;
  hostToken: string;
  playerToken: string;
  playerId: string;
  room: Room;
}>;

export type JoinRoomResult = Readonly<{
  playerToken: string;
  playerId: string;
  reconnected: boolean;
  room: Room;
}>;

function defaultCodeFactory(): string {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function defaultTokenFactory(): string {
  return randomBytes(32).toString("base64url");
}

export function constantTimeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    const dummy = Buffer.alloc(leftBuffer.length);
    timingSafeEqual(leftBuffer, dummy);
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function cleanName(name: unknown): string {
  if (typeof name !== "string") {
    throw new RoomError("INVALID_NAME", "Player name must be a string.");
  }
  const cleaned = name.trim();
  if (cleaned.length < 1 || cleaned.length > 40) {
    throw new RoomError("INVALID_NAME", "Player names must be 1–40 characters.");
  }
  return cleaned;
}

function copyJson(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    throw new RoomError("INVALID_PAYLOAD", "JSON numbers must be finite.");
  }
  if (typeof value !== "object") {
    throw new RoomError("INVALID_PAYLOAD", "Payload must contain only JSON values.");
  }
  if (seen.has(value)) {
    throw new RoomError("INVALID_PAYLOAD", "Payload must not contain cycles.");
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => copyJson(entry, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RoomError(
        "INVALID_PAYLOAD",
        "Payload objects must be plain JSON objects.",
      );
    }
    const clone: Record<string, JsonValue> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new RoomError(
          "INVALID_PAYLOAD",
          "Payload keys must be JSON strings.",
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) {
        throw new RoomError(
          "INVALID_PAYLOAD",
          "Payload must not contain accessors.",
        );
      }
      clone[key] = copyJson(descriptor.value, seen);
    }
    return clone;
  } finally {
    seen.delete(value);
  }
}

function deepFreezeJson(value: JsonValue | undefined): void {
  if (value === undefined || value === null || typeof value !== "object") return;
  for (const child of Object.values(value)) deepFreezeJson(child);
  Object.freeze(value);
}

function freezeRoom(room: Room): Room {
  for (const player of room.players) {
    deepFreezeJson(player.privateData);
    Object.freeze(player);
  }
  for (const event of room.events) Object.freeze(event);
  Object.freeze(room.players);
  Object.freeze(room.events);
  if (room.gameState) {
    deepFreezeJson(room.gameState.publicData);
    if (room.gameState.privateByPlayerId) {
      for (const value of Object.values(room.gameState.privateByPlayerId)) {
        deepFreezeJson(value);
      }
      Object.freeze(room.gameState.privateByPlayerId);
    }
    Object.freeze(room.gameState);
  }
  return Object.freeze(room);
}

export class RoomRepository {
  private readonly storage: RoomStorage;
  private readonly clock: () => number;
  private readonly codeFactory: () => string;
  private readonly tokenFactory: () => string;
  private readonly idFactory: () => string;
  private readonly inactivityMs: number;
  private readonly maxPlayers: number;
  private readonly maxRooms: number;

  constructor(options: RoomRepositoryOptions = {}) {
    this.clock = options.clock ?? Date.now;
    this.codeFactory = options.codeFactory ?? defaultCodeFactory;
    this.tokenFactory = options.tokenFactory ?? defaultTokenFactory;
    this.idFactory = options.idFactory ?? randomUUID;
    this.inactivityMs = options.inactivityMs ?? DEFAULT_INACTIVITY_MS;
    this.maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    this.maxRooms = options.maxRooms ?? 10_000;
    this.storage = options.storage ?? new MemoryRoomStorage();
    if (this.inactivityMs <= 0 || this.maxPlayers < 1 || this.maxRooms < 1) {
      throw new RangeError("Room limits must be positive.");
    }
  }

  create(input: CreateRoomInput): CreateRoomResult {
    return this.storage.transaction(() => this.createInternal(input));
  }

  private createInternal(input: CreateRoomInput): CreateRoomResult {
    this.expireInternal();
    if (this.storage.values().length >= this.maxRooms) {
      throw new RoomError("ROOM_CAPACITY", "The room service is at capacity.");
    }
    const hostName = cleanName(input.hostName);
    const privateData =
      input.privateData === undefined ? undefined : copyJson(input.privateData);
    const now = this.clock();
    const code = this.uniqueCode();
    const hostToken = this.uniqueToken();
    const playerToken = this.uniqueToken(new Set([hostToken]));
    const playerId = this.idFactory();
    const host: RoomPlayer = {
      id: playerId,
      name: hostName,
      isHost: true,
      joinedAt: now,
      lastSeenAt: now,
      playerToken,
      ...(input.privateData === undefined
        ? {}
        : { privateData }),
    };
    const room = freezeRoom({
      contractVersion: ROOM_CONTRACT_VERSION,
      code,
      hostToken,
      hostPlayerId: playerId,
      locale: input.locale ?? "ar",
      status: "lobby",
      selectedGame: null,
      players: [host],
      gameState: null,
      events: [{ type: "player/joined", playerId, at: now }],
      createdAt: now,
      updatedAt: now,
      expiresAt: now + this.inactivityMs,
      revision: 1,
    });
    this.storage.set(code, room);
    return { code, hostToken, playerToken, playerId, room };
  }

  join(code: string, input: JoinRoomInput): JoinRoomResult {
    return this.storage.transaction(() => this.joinInternal(code, input));
  }

  private joinInternal(code: string, input: JoinRoomInput): JoinRoomResult {
    const room = this.requireActive(code);
    const now = this.clock();
    if (input.playerToken) {
      const existing = room.players.find((player) =>
        constantTimeTokenEqual(player.playerToken, input.playerToken!),
      );
      if (!existing) {
        throw new RoomError("INVALID_TOKEN", "Player token is not valid for this room.");
      }
      const players = room.players.map((player) =>
        player.id === existing.id ? { ...player, lastSeenAt: now } : player,
      );
      const updated = this.update(room, {
        players,
        events: [
          ...room.events,
          { type: "player/reconnected", playerId: existing.id, at: now },
        ],
      });
      return {
        playerToken: existing.playerToken,
        playerId: existing.id,
        reconnected: true,
        room: updated,
      };
    }
    if (room.players.length >= this.maxPlayers) {
      throw new RoomError("ROOM_FULL", "This room has reached its player limit.");
    }
    const name = cleanName(input.name);
    const privateData =
      input.privateData === undefined ? undefined : copyJson(input.privateData);
    const playerToken = this.uniqueToken(
      new Set([room.hostToken, ...room.players.map((player) => player.playerToken)]),
    );
    const player: RoomPlayer = {
      id: this.idFactory(),
      name,
      isHost: false,
      joinedAt: now,
      lastSeenAt: now,
      playerToken,
      ...(input.privateData === undefined
        ? {}
        : { privateData }),
    };
    const updated = this.update(room, {
      players: [...room.players, player],
      events: [
        ...room.events,
        { type: "player/joined", playerId: player.id, at: now },
      ],
    });
    return {
      playerToken,
      playerId: player.id,
      reconnected: false,
      room: updated,
    };
  }

  get(code: string): Room | undefined {
    return this.storage.transaction(() => this.getInternal(code));
  }

  private getInternal(code: string): Room | undefined {
    const normalized = code.toUpperCase();
    const room = this.storage.get(normalized);
    if (!room) return undefined;
    if (room.expiresAt <= this.clock()) {
      this.storage.delete(normalized);
      return undefined;
    }
    return room;
  }

  applyAction(code: string, actorToken: string, action: RoomAction): Room {
    return this.storage.transaction(() => this.applyActionInternal(code, actorToken, action));
  }

  private applyActionInternal(code: string, actorToken: string, action: RoomAction): Room {
    const room = this.requireActive(code);
    this.validateAction(action);
    const actor = room.players.find((player) =>
      constantTimeTokenEqual(player.playerToken, actorToken),
    );
    const isHost = constantTimeTokenEqual(room.hostToken, actorToken);
    if (!actor && !isHost) {
      throw new RoomError("INVALID_TOKEN", "Actor token is not valid for this room.");
    }
    if ((action.type.startsWith("lobby/") || action.type.startsWith("game/")) && !isHost) {
      throw new RoomError("HOST_ONLY", "Only the host can perform this action.");
    }
    const now = this.clock();
    switch (action.type) {
      case "lobby/select-game":
        if (room.status !== "lobby") return this.invalidAction("Game already started.");
        return this.update(room, {
          selectedGame: action.gameId,
          events: [
            ...room.events,
            { type: "lobby/game-selected", gameId: action.gameId, at: now },
          ],
        });
      case "lobby/start":
        if (room.status !== "lobby" || !room.selectedGame) {
          return this.invalidAction("Select a game before starting.");
        }
        return this.update(room, {
          status: "playing",
          gameState: initializeGame(room, now),
          events: [
            ...room.events,
            { type: "room/status-changed", status: "playing", at: now },
          ],
        });
      case "lobby/return":
        return this.update(room, {
          status: "lobby",
          gameState: null,
          events: [
            ...room.events,
            { type: "room/status-changed", status: "lobby", at: now },
          ],
        });
      case "lobby/remove-player": {
        if (action.playerId === room.hostPlayerId) {
          return this.invalidAction("The host cannot remove themselves.");
        }
        if (!room.players.some((player) => player.id === action.playerId)) {
          return this.invalidAction("Player does not exist.");
        }
        return this.update(room, {
          players: room.players.filter((player) => player.id !== action.playerId),
          events: [
            ...room.events,
            { type: "player/removed", playerId: action.playerId, at: now },
          ],
        });
      }
      case "game/next-round":
        return this.update(room, {
          gameState: nextGameRound(room, now),
        });
      case "game/return-lobby":
        if (room.status !== "playing") return this.invalidAction("Room is already in the lobby.");
        return this.update(room, {
          status: "lobby",
          gameState: null,
          events: [...room.events, { type: "room/status-changed", status: "lobby", at: now }],
        });
      default:
        return this.update(room, {
          gameState: reduceGame(
            room,
            actor?.id ?? (isHost ? room.hostPlayerId : undefined),
            isHost,
            action,
            now,
          ),
          events: [...room.events, {
            type: "game/action-applied",
            playerId: actor?.id ?? room.hostPlayerId,
            actionType: action.type,
            at: now,
          }],
        });
    }
  }

  expire(): string[] {
    return this.storage.transaction(() => this.expireInternal());
  }

  private expireInternal(): string[] {
    const now = this.clock();
    const expired: string[] = [];
    for (const room of this.storage.values()) {
      const code = room.code;
      if (room.expiresAt <= now) {
        this.storage.delete(code);
        expired.push(code);
      }
    }
    return expired;
  }

  touch(code: string, playerToken: string): Room {
    return this.storage.transaction(() => {
      const room = this.requireActive(code);
      const now = this.clock();
      const player = room.players.find((candidate) =>
        constantTimeTokenEqual(candidate.playerToken, playerToken),
      );
      if (!player) throw new RoomError("INVALID_TOKEN", "Player token is not valid for this room.");
      return this.update(room, {
        players: room.players.map((candidate) =>
          candidate.id === player.id ? { ...candidate, lastSeenAt: now } : candidate,
        ),
      });
    });
  }

  consumeCreate(ip: string, limit = 5, windowMs = 60_000): boolean {
    return this.storage.transaction(() =>
      this.storage.consumeCreate?.(ip, this.clock(), limit, windowMs) ?? true,
    );
  }

  private update(room: Room, patch: Partial<Room>): Room {
    const now = this.clock();
    const updated = freezeRoom({
      ...room,
      ...patch,
      players: [...(patch.players ?? room.players)],
      events: [...(patch.events ?? room.events)].slice(-100),
      updatedAt: now,
      expiresAt: now + this.inactivityMs,
      revision: room.revision + 1,
    });
    this.storage.set(room.code, updated);
    return updated;
  }

  private requireActive(code: string): Room {
    const normalized = code.toUpperCase();
    const room = this.storage.get(normalized);
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "Room does not exist.");
    if (room.expiresAt <= this.clock()) {
      this.storage.delete(normalized);
      throw new RoomError("ROOM_EXPIRED", "Room has expired.");
    }
    return room;
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
      const code = this.codeFactory().toUpperCase();
      if (CODE_PATTERN.test(code) && !this.storage.get(code)) return code;
    }
    throw new RoomError(
      "CODE_GENERATION_FAILED",
      "Unable to generate a unique six-character room code.",
    );
  }

  private uniqueToken(excluded = new Set<string>()): string {
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
      const token = this.tokenFactory();
      if (
        token.length >= 12 &&
        !excluded.has(token) &&
        !this.storage.values().some((room) =>
          room.hostToken === token || room.players.some((player) => player.playerToken === token),
        )
      ) {
        return token;
      }
    }
    throw new RoomError(
      "TOKEN_GENERATION_FAILED",
      "Unable to generate a unique secure token.",
    );
  }

  private invalidAction(message: string): never {
    throw new RoomError("INVALID_ACTION", message);
  }

  private validateAction(action: unknown): asserts action is RoomAction {
    if (
      action === null ||
      typeof action !== "object" ||
      !("type" in action) ||
      typeof action.type !== "string"
    ) {
      return this.invalidAction("Action must have a string type.");
    }
    switch (action.type) {
      case "lobby/select-game":
        if (
          !("gameId" in action) ||
          typeof action.gameId !== "string" ||
          ![
            "category-challenge",
            "out-of-loop",
            "charades",
            "forbidden-word",
            "who-am-i",
            "rapid-fire",
            "most-likely-to",
            "two-truths-lie",
          ].includes(action.gameId)
        ) {
          return this.invalidAction("Select-game action requires a valid game ID.");
        }
        return;
      case "lobby/start":
      case "lobby/return":
        return;
      case "lobby/remove-player":
        if (!("playerId" in action) || typeof action.playerId !== "string") {
          return this.invalidAction("Remove-player action requires a player ID.");
        }
        return;
      case "category/score":
      case "charades/mark":
      case "forbidden-word/mark":
      case "rapid-fire/mark":
      case "timed/expire":
      case "out-of-loop/vote":
      case "most-likely/vote":
      case "who-am-i/guess":
      case "two-truths/submit":
      case "two-truths/vote":
      case "out-of-loop/open-vote":
      case "out-of-loop/guess":
      case "game/next-round":
      case "game/return-lobby":
        if ((action.type === "game/next-round" || action.type === "game/return-lobby") &&
          Object.keys(action).length !== 1) {
          return this.invalidAction("Lifecycle actions do not accept payload fields.");
        }
        return;
      default:
        return this.invalidAction("Unknown room action.");
    }
  }
}
