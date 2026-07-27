import {
  type PlayerRoomView,
  type PublicRoomPlayer,
  type Room,
  type SelfRoomPlayer,
} from "./contracts";
import { constantTimeTokenEqual, RoomError } from "./repository";

function publicPlayer(player: Room["players"][number]): PublicRoomPlayer {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    joinedAt: player.joinedAt,
    lastSeenAt: player.lastSeenAt,
  };
}

export function toPlayerView(room: Room, playerToken: string): PlayerRoomView {
  const player = room.players.find(
    (candidate) => constantTimeTokenEqual(candidate.playerToken, playerToken),
  );
  if (!player) {
    throw new RoomError("INVALID_TOKEN", "Player token is not valid for this room.");
  }

  const self: SelfRoomPlayer = {
    ...publicPlayer(player),
    ...(player.privateData === undefined ? {} : { privateData: player.privateData }),
  };
  const privateGameData = room.gameState?.privateByPlayerId?.[player.id];

  return {
    contractVersion: room.contractVersion,
    code: room.code,
    locale: room.locale,
    status: room.status,
    selectedGame: room.selectedGame,
    players: room.players.map(publicPlayer),
    self,
    gameState: room.gameState
      ? {
          revision: room.gameState.revision,
          publicData: room.gameState.publicData,
          ...(privateGameData === undefined
            ? {}
            : { privateData: privateGameData }),
        }
      : null,
    events: room.events,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    expiresAt: room.expiresAt,
    revision: room.revision,
  };
}
