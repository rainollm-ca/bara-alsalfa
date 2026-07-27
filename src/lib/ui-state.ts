import type { GameId, PlayMode } from "../games/types";

export function resolveGameView(activeGame: GameId | null, mode: PlayMode) {
  if (activeGame === null) return "library";
  if (mode === "room") return "room-unavailable";
  if (activeGame === "out-of-loop") return "out-of-loop";
  if (activeGame === "category-challenge") return "category-challenge";
  return "unavailable";
}
