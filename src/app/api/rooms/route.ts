import {
  errorResponse,
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

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    requireVersion(body);
    if (body.locale !== undefined && !isLocale(body.locale)) {
      throw new RoomError("INVALID_PAYLOAD", "Locale must be ar or en.");
    }
    if (body.gameId !== undefined && !isGameId(body.gameId)) {
      throw new RoomError("INVALID_PAYLOAD", "Unknown game.");
    }
    const created = roomRepository().create({
      hostName: body.hostName as string,
      ...(body.locale ? { locale: body.locale as "ar" | "en" } : {}),
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
