import { ROOM_CONTRACT_VERSION } from "../../../../../rooms/contracts";
import { toPlayerView } from "../../../../../rooms/playerView";
import {
  errorResponse,
  jsonResponse,
  normalizeCode,
  readJson,
  requireVersion,
  roomRepository,
} from "../../../../../rooms/server";

type Context = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const body = await readJson(request);
    requireVersion(body);
    const { code } = await params;
    const joined = roomRepository().join(normalizeCode(code), {
      name: body.name as string,
      ...(typeof body.playerToken === "string" ? { playerToken: body.playerToken } : {}),
    });
    return jsonResponse({
      contractVersion: ROOM_CONTRACT_VERSION,
      playerToken: joined.playerToken,
      reconnected: joined.reconnected,
      room: toPlayerView(joined.room, joined.playerToken),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
