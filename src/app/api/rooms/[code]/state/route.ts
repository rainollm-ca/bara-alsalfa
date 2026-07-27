import { ROOM_CONTRACT_VERSION } from "../../../../../rooms/contracts";
import {
  bearerToken,
  errorResponse,
  jsonResponse,
  playerViewForActor,
} from "../../../../../rooms/server";

type Context = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const token = bearerToken(request);
    const { code } = await params;
    return jsonResponse({
      contractVersion: ROOM_CONTRACT_VERSION,
      room: playerViewForActor(code, token),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
