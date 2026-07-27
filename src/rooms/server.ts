import { GAME_CATALOG } from "../games/catalog";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { isIP } from "node:net";
import type { GameId, Locale } from "../games/types";
import { ROOM_CONTRACT_VERSION, type RoomAction } from "./contracts";
import { toPlayerView } from "./playerView";
import { RoomError, RoomRepository, constantTimeTokenEqual } from "./repository";
import { SQLiteRoomStorage } from "./sqliteStorage";

const MAX_BODY_BYTES = 64 * 1024;
function defaultRepository() {
  if (process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "build") {
    return new RoomRepository();
  }
  const path = process.env.ROOM_DB_PATH ?? join(process.cwd(), "data", "rooms.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  return new RoomRepository({ storage: new SQLiteRoomStorage(path) });
}
let repository = defaultRepository();

export function roomRepository() {
  return repository;
}

export function resetRoomRepositoryForTests(next = new RoomRepository()) {
  repository = next;
}

export function clientIdentity(
  request: Request,
  trustProxy = process.env.ROOM_TRUST_PROXY === "1",
): string {
  if (!trustProxy) return "anonymous";
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded || forwarded.includes(",") || !isIP(forwarded.trim())) {
    throw new HttpError(
      400,
      "INVALID_PROXY_HEADER",
      "Trusted proxy mode requires one valid X-Forwarded-For IP address.",
    );
  }
  return forwarded.trim().toLowerCase();
}

type JsonObject = Record<string, unknown>;

export async function readJson(request: Request): Promise<JsonObject> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("not an object");
    }
    return body as JsonObject;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Body must be a JSON object.");
  }
}

export function requireVersion(body: JsonObject) {
  if (body.contractVersion !== ROOM_CONTRACT_VERSION) {
    throw new HttpError(422, "UNSUPPORTED_VERSION", "Unsupported room contract version.");
  }
}

export function bearerToken(request: Request): string {
  const match = /^Bearer ([A-Za-z0-9_-]{12,})$/.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match) throw new HttpError(401, "UNAUTHORIZED", "A valid bearer token is required.");
  return match[1];
}

export function normalizeCode(code: string): string {
  const normalized = code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    throw new RoomError("ROOM_NOT_FOUND", "Room does not exist.");
  }
  return normalized;
}

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && GAME_CATALOG.some((game) => game.id === value);
}

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function playerViewForActor(code: string, token: string) {
  const room = repository.get(normalizeCode(code));
  if (!room) throw new RoomError("ROOM_NOT_FOUND", "Room does not exist.");
  const player =
    room.players.find((candidate) =>
      constantTimeTokenEqual(candidate.playerToken, token),
    ) ??
    (constantTimeTokenEqual(room.hostToken, token)
      ? room.players.find((candidate) => candidate.id === room.hostPlayerId)
      : undefined);
  if (!player) throw new RoomError("INVALID_TOKEN", "Token is not valid for this room.");
  return toPlayerView(room, player.playerToken);
}

export function touchedPlayerView(code: string, playerToken: string) {
  return toPlayerView(repository.touch(normalizeCode(code), playerToken), playerToken);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const roomStatuses: Record<string, number> = {
  ROOM_NOT_FOUND: 404,
  ROOM_EXPIRED: 410,
  ROOM_FULL: 409,
  ROOM_IN_PROGRESS: 409,
  INVALID_NAME: 422,
  INVALID_PAYLOAD: 422,
  INVALID_TOKEN: 401,
  HOST_ONLY: 403,
  INVALID_ACTION: 422,
  CODE_GENERATION_FAILED: 503,
  TOKEN_GENERATION_FAILED: 503,
  ROOM_CAPACITY: 503,
  PLAYER_ONLY: 403,
};

export function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function errorResponse(error: unknown) {
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof RoomError
        ? roomStatuses[error.code] ?? 500
        : 500;
  const code =
    error instanceof HttpError
      ? error.code
      : error instanceof RoomError
        ? error.code
        : "INTERNAL_ERROR";
  const message =
    error instanceof HttpError || error instanceof RoomError
      ? error.message
      : "The room service could not process this request.";
  return jsonResponse({ contractVersion: ROOM_CONTRACT_VERSION, error: { code, message } }, status);
}

export function asRoomAction(value: unknown): RoomAction {
  if (!value || typeof value !== "object") {
    throw new RoomError("INVALID_ACTION", "Action must be an object.");
  }
  return value as RoomAction;
}
