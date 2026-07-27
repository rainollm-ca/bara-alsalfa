import type { GameId, PlayMode } from "../games/types";

export function resolveGameView(activeGame: GameId | null, mode: PlayMode) {
  if (activeGame === null) return "library";
  if (mode === "room") return "room-unavailable";
  if (activeGame === "out-of-loop") return "out-of-loop";
  if (activeGame === "category-challenge") return "category-challenge";
  if (activeGame === "charades") return "charades";
  if (activeGame === "forbidden-word") return "forbidden-word";
  if (activeGame === "who-am-i") return "who-am-i";
  if (activeGame === "rapid-fire") return "rapid-fire";
  return "unavailable";
}
