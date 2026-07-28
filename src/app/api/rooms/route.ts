import {
  errorResponse,
  clientIdentity,
  HttpError,
  isGameId,
  isLocale,
  jsonResponse,
  readJson,
  requireVersion,
  roomRepository,
} from "../../../rooms/server";
import { ROOM_CONTRACT_VERSION } from "../../../rooms/contracts";
import { toPlayerView } from "../../../rooms/playerView";
import { RoomError } from "../../../rooms/repository";
import { validCategorySelection } from "../../../games/content/categories";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = clientIdentity(request);
    const configuredLimit = Number(process.env.ROOM_CREATE_LIMIT ?? 5);
    const createLimit = Number.isInteger(configuredLimit) && configuredLimit >= 1 && configuredLimit <= 100
      ? configuredLimit : 5;
    if (!roomRepository().consumeCreate(ip, createLimit)) {
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "Too many rooms created. Try again shortly.",
      );
    }
    const body = await readJson(request);
    requireVersion(body);
    if (body.locale !== undefined && !isLocale(body.locale)) {
      throw new RoomError("INVALID_PAYLOAD", "Locale must be ar or en.");
    }
    if (body.gameId !== undefined && !isGameId(body.gameId)) {
      throw new RoomError("INVALID_PAYLOAD", "Unknown game.");
    }
    if (body.categoryIds !== undefined &&
      (!body.gameId || !isGameId(body.gameId) || !validCategorySelection(body.gameId, body.categoryIds))) {
      throw new RoomError("INVALID_PAYLOAD", "Choose valid content categories for this game.");
    }
    const privateData = body.privateData && typeof body.privateData === "object" && !Array.isArray(body.privateData)
      ? Object.fromEntries(Object.entries(body.privateData).filter(([key]) => key !== "selectedCategoryIds"))
      : body.privateData;
    const created = roomRepository().create({
      hostName: body.hostName as string,
      ...(body.locale ? { locale: body.locale as "ar" | "en" } : {}),
      ...(body.categoryIds === undefined ? {} : { selectedCategoryIds: body.categoryIds as string[] }),
      ...(body.privateData === undefined && body.categoryIds === undefined ? {} : {
        privateData: privateData as never,
      }),
    });
    if (body.gameId) {
      roomRepository().applyAction(created.code, created.hostToken, {
        type: "lobby/select-game",
        gameId: body.gameId,
      });
    }
    return jsonResponse(
      {
        contractVersion: ROOM_CONTRACT_VERSION,
        code: created.code,
        hostToken: created.hostToken,
        playerToken: created.playerToken,
        room: toPlayerView(roomRepository().get(created.code)!, created.playerToken),
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
