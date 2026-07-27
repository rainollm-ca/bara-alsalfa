import { ROOM_CONTRACT_VERSION } from "../../../../../rooms/contracts";
import {
  asRoomAction,
  bearerToken,
  errorResponse,
  jsonResponse,
  normalizeCode,
  playerViewForActor,
  readJson,
  requireVersion,
  roomRepository,
} from "../../../../../rooms/server";

type Context = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const token = bearerToken(request);
    const body = await readJson(request);
    requireVersion(body);
    const { code } = await params;
    const normalized = normalizeCode(code);
    roomRepository().applyAction(normalized, token, asRoomAction(body.action));
    return jsonResponse({
      contractVersion: ROOM_CONTRACT_VERSION,
      room: playerViewForActor(normalized, token),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
