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

function renderForPlayer(
  gameId: string,
  publicData: Record<string, unknown>,
  self = players[1],
  action = vi.fn().mockResolvedValue({ room: {} }),
) {
  render(<RoomGame
    locale="en"
    room={{
      code: "ABC123", selectedGame: gameId, status: "playing", players,
      self, gameState: { revision: 2, publicData },
    } as never}
    session={{ code: "ABC123", name: self.name, playerToken: "player-token", ...(self.isHost ? { hostToken: "host-token" } : {}) }}
    api={{ action } as never}
    onState={vi.fn()}
  />);
  return action;
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

describe("RoomGame multiplayer controls and named sides", () => {
  it("shows category scoring and next-round controls to a guest, but not lobby administration", () => {
    const { rerender } = render(<RoomGame
      locale="en"
      room={{
        code: "ABC123", selectedGame: "category-challenge", status: "playing", players,
        self: players[1], gameState: { revision: 1, publicData: { phase: "play", round: 1, scores: {} } },
      } as never}
      session={{ code: "ABC123", name: "Guest", playerToken: "guest-player-token" }}
      api={{ action: vi.fn() } as never}
      onState={vi.fn()}
    />);
    expect(screen.getByRole("button", { name: "Correct: Host" })).toBeTruthy();
    rerender(<RoomGame
      locale="en"
      room={{
        code: "ABC123", selectedGame: "category-challenge", status: "playing", players,
        self: players[1], gameState: { revision: 2, publicData: { phase: "result", round: 1, scores: {} } },
      } as never}
      session={{ code: "ABC123", name: "Guest", playerToken: "guest-player-token" }}
      api={{ action: vi.fn() } as never}
      onState={vi.fn()}
    />);
    expect(screen.getByRole("button", { name: "Next round" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to lobby" })).toBeNull();
  });

  it("renders named sides once, highlights the active side, and shows its round delta", () => {
    renderForPlayer("rapid-fire", {
      phase: "play", round: 1, activePlayerId: "host", activeActorId: "host",
      activeActorName: "Host", activeTeamId: "team-1", activeTeamLabel: { en: "Host", ar: "Host" },
      teams: [
        { id: "team-1", label: { en: "Host", ar: "Host" }, memberIds: ["host"] },
        { id: "team-2", label: { en: "Guest", ar: "Guest" }, memberIds: ["guest"] },
      ],
      teamScores: { "team-1": 3, "team-2": 1 }, roundStartScore: 1,
      timerEndsAt: Date.now() + 60_000,
    }, players[0]);
    expect(screen.getByText("Host:")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("Guest:")).toBeTruthy();
    expect(screen.queryByText("team-1")).toBeNull();
    expect(screen.queryByText("team-2")).toBeNull();
    expect(document.querySelector('[data-team-id="team-1"]')?.className).toContain("active");
  });

  it("shows timed controls to both players in an exactly two-player game", () => {
    renderForPlayer("rapid-fire", {
      phase: "play", round: 1, activePlayerId: "host", activeActorId: "host",
      activeTeamId: "team-1", teams: [
        { id: "team-1", label: { en: "Host", ar: "Host" }, memberIds: ["host"] },
        { id: "team-2", label: { en: "Guest", ar: "Guest" }, memberIds: ["guest"] },
      ],
      teamScores: { "team-1": 0, "team-2": 0 }, roundStartScore: 0,
      timerEndsAt: Date.now() + 60_000,
    }, players[1]);
    expect(screen.getByRole("button", { name: "Correct" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
  });

  it("states category scorer, score change, and cumulative total in the result", () => {
    renderForPlayer("category-challenge", {
      phase: "result", round: 1, scores: { host: 0, guest: 3 },
      lastScoredPlayerId: "guest", scoreChange: 1, cumulativeScore: 3,
    });
    expect(screen.getByText(/Guest.*\+1.*3/)).toBeTruthy();
  });

  it("states the timed side's round change and cumulative total in the result", () => {
    renderForPlayer("rapid-fire", {
      phase: "result", round: 1, activeTeamId: "team-1",
      activeTeamLabel: { en: "Host", ar: "Host" },
      teams: [
        { id: "team-1", label: { en: "Host", ar: "Host" }, memberIds: ["host"] },
        { id: "team-2", label: { en: "Guest", ar: "Guest" }, memberIds: ["guest"] },
      ],
      teamScores: { "team-1": 4, "team-2": 1 }, roundStartScore: 1,
      summary: { correct: 3, skipped: 0, failed: 0, violations: 0 },
    });
    expect(screen.getByText(/Host.*\+3.*4/)).toBeTruthy();
  });
});
