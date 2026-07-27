import type { GameId } from "../games/types";

export function resolveGameView(activeGame: GameId | null) {
  if (activeGame === null) return "library";
  if (activeGame === "out-of-loop") return "out-of-loop";
  return "unavailable";
}
