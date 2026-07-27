import {
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  ROOM_CONTRACT_VERSION,
  type CreateRoomInput,
  type GameRoomAction,
  type JoinRoomInput,
  type JsonValue,
  type Room,
  type RoomAction,
  type RoomEvent,
  type RoomPlayer,
} from "./contracts";

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
  | "INVALID_TOKEN"
  | "HOST_ONLY"
  | "INVALID_ACTION"
  | "CODE_GENERATION_FAILED"
  | "TOKEN_GENERATION_FAILED";

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
}>;

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

function cleanName(name: string): string {
  const cleaned = name.trim();
  if (cleaned.length < 1 || cleaned.length > 40) {
    throw new RoomError("INVALID_NAME", "Player names must be 1–40 characters.");
  }
  return cleaned;
}

function copyJson(value: JsonValue | undefined): JsonValue | undefined {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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
  private readonly rooms = new Map<string, Room>();
  private readonly issuedTokens = new Set<string>();
  private readonly clock: () => number;
  private readonly codeFactory: () => string;
  private readonly tokenFactory: () => string;
  private readonly idFactory: () => string;
  private readonly inactivityMs: number;
  private readonly maxPlayers: number;

  constructor(options: RoomRepositoryOptions = {}) {
    this.clock = options.clock ?? Date.now;
    this.codeFactory = options.codeFactory ?? defaultCodeFactory;
    this.tokenFactory = options.tokenFactory ?? defaultTokenFactory;
    this.idFactory = options.idFactory ?? randomUUID;
    this.inactivityMs = options.inactivityMs ?? DEFAULT_INACTIVITY_MS;
    this.maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    if (this.inactivityMs <= 0 || this.maxPlayers < 1) {
      throw new RangeError("Room limits must be positive.");
    }
  }

  create(input: CreateRoomInput): CreateRoomResult {
    const now = this.clock();
    const code = this.uniqueCode();
    const hostToken = this.uniqueToken();
    const playerToken = this.uniqueToken(new Set([hostToken]));
    const playerId = this.idFactory();
    const host: RoomPlayer = {
      id: playerId,
      name: cleanName(input.hostName),
      isHost: true,
      joinedAt: now,
      lastSeenAt: now,
      playerToken,
      ...(input.privateData === undefined
        ? {}
        : { privateData: copyJson(input.privateData) }),
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
    this.rooms.set(code, room);
    return { code, hostToken, playerToken, playerId, room };
  }

  join(code: string, input: JoinRoomInput): JoinRoomResult {
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
    const playerToken = this.uniqueToken(
      new Set([room.hostToken, ...room.players.map((player) => player.playerToken)]),
    );
    const player: RoomPlayer = {
      id: this.idFactory(),
      name: cleanName(input.name),
      isHost: false,
      joinedAt: now,
      lastSeenAt: now,
      playerToken,
      ...(input.privateData === undefined
        ? {}
        : { privateData: copyJson(input.privateData) }),
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
    const normalized = code.toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) return undefined;
    if (room.expiresAt <= this.clock()) {
      this.rooms.delete(normalized);
      return undefined;
    }
    return room;
  }

  applyAction(code: string, actorToken: string, action: RoomAction): Room {
    const room = this.requireActive(code);
    const actor = room.players.find((player) =>
      constantTimeTokenEqual(player.playerToken, actorToken),
    );
    const isHost = constantTimeTokenEqual(room.hostToken, actorToken);
    if (!actor && !isHost) {
      throw new RoomError("INVALID_TOKEN", "Actor token is not valid for this room.");
    }
    if (action.type.startsWith("lobby/") && !isHost) {
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
      case "game/action":
        if (!actor) {
          throw new RoomError(
            "INVALID_TOKEN",
            "Game actions require a player token.",
          );
        }
        return this.applyGameAction(room, actor, action, now);
    }
  }

  expire(): string[] {
    const now = this.clock();
    const expired: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.expiresAt <= now) {
        this.rooms.delete(code);
        expired.push(code);
      }
    }
    return expired;
  }

  private applyGameAction(
    room: Room,
    actor: RoomPlayer,
    action: GameRoomAction,
    now: number,
  ): Room {
    if (room.status !== "playing") {
      return this.invalidAction("Game actions require a started room.");
    }
    if (!action.actionType.trim()) {
      return this.invalidAction("Game action type is required.");
    }
    return this.update(room, {
      gameState: {
        revision: (room.gameState?.revision ?? 0) + 1,
        publicData: copyJson(action.payload) ?? null,
      },
      events: [
        ...room.events,
        {
          type: "game/action-applied",
          playerId: actor.id,
          actionType: action.actionType,
          at: now,
        },
      ],
    });
  }

  private update(room: Room, patch: Partial<Room>): Room {
    const now = this.clock();
    const updated = freezeRoom({
      ...room,
      players: [...room.players],
      events: [...room.events],
      ...patch,
      updatedAt: now,
      expiresAt: now + this.inactivityMs,
      revision: room.revision + 1,
    });
    this.rooms.set(room.code, updated);
    return updated;
  }

  private requireActive(code: string): Room {
    const normalized = code.toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "Room does not exist.");
    if (room.expiresAt <= this.clock()) {
      this.rooms.delete(normalized);
      throw new RoomError("ROOM_EXPIRED", "Room has expired.");
    }
    return room;
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
      const code = this.codeFactory().toUpperCase();
      if (CODE_PATTERN.test(code) && !this.rooms.has(code)) return code;
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
        !this.issuedTokens.has(token)
      ) {
        this.issuedTokens.add(token);
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
}
