// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoomGame } from "../src/components/RoomGame";

afterEach(cleanup);

const players = [
  { id: "host", name: "Host", isHost: true, joinedAt: 1, lastSeenAt: 1 },
  { id: "guest", name: "Guest", isHost: false, joinedAt: 1, lastSeenAt: 1 },
];

function renderResult(gameId: string, publicData: Record<string, unknown>) {
  render(<RoomGame
    locale="en"
    room={{
      code: "ABC123", selectedGame: gameId, status: "playing", players,
      self: players[0], gameState: { revision: 2, publicData },
    } as never}
    session={{ code: "ABC123", name: "Host", playerToken: "player-token", hostToken: "host-token" }}
    api={{ action: vi.fn() } as never}
    onState={vi.fn()}
  />);
}

describe("RoomGame result views", () => {
  it("renders Most Likely vote counts and winners", () => {
    renderResult("most-likely-to", { phase: "result", round: 1, scores: {}, voteCounts: { host: 2 }, winnerPlayerIds: ["host"] });
    expect(screen.getByText("Host: 2")).toBeTruthy();
    expect(screen.getByText(/Winner: Host/)).toBeTruthy();
  });

  it("renders the Who Am I revealed identity", () => {
    renderResult("who-am-i", { phase: "result", round: 1, scores: {}, revealedIdentity: { en: "Albert Einstein", ar: "ألبرت" } });
    expect(screen.getByText("Albert Einstein")).toBeTruthy();
  });

  it("renders Out of Loop word and outsider outcome", () => {
    renderResult("out-of-loop", { phase: "result", round: 1, scores: {}, outsiderPlayerId: "guest", word: { en: "Damascus", ar: "دمشق" }, outsiderCorrect: true });
    expect(screen.getByText(/Guest — Damascus — Correct/)).toBeTruthy();
  });

  it("renders Two Truths lie, correct voters, and scores", () => {
    renderResult("two-truths-lie", { phase: "result", round: 1, scores: { guest: 1 }, lieIndex: 1, correctVoters: ["guest"] });
    expect(screen.getByText("The lie is: 2")).toBeTruthy();
    expect(screen.getByText("Guest")).toBeTruthy();
    expect(screen.getByText(/Guest:/)).toBeTruthy();
  });
});
