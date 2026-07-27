// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoomLobby } from "../src/components/RoomLobby";
import { RoomClientError } from "../src/rooms/client";

afterEach(cleanup);

describe("RoomLobby", () => {
  it("offers bilingual create and join forms for the selected game", async () => {
    const create = vi.fn();
    const join = vi.fn();
    render(
      <RoomLobby
        locale="en"
        gameId="charades"
        onExit={vi.fn()}
        api={{ create, join } as never}
      />,
    );
    expect(screen.getByRole("heading", { name: "Start a group room" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Your name"), "Host");
    await userEvent.click(screen.getByRole("button", { name: "Create room" }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ hostName: "Host", gameId: "charades" }),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Join" }));
    expect(screen.getByLabelText("Room code")).toBeTruthy();
    expect(join).not.toHaveBeenCalled();
  });

  it("joins an invite code without a selected game", async () => {
    const join = vi.fn().mockResolvedValue({
      playerToken: "guest-player-token-long",
      room: {
        code: "ABC123",
        selectedGame: "charades",
        players: [{ id: "1", name: "Guest", isHost: false }],
        self: { id: "1", name: "Guest", isHost: false },
      },
    });
    render(
      <RoomLobby
        locale="en"
        initialCode="ABC123"
        onExit={vi.fn()}
        api={{ join, poll: () => vi.fn() } as never}
      />,
    );
    await userEvent.type(screen.getByLabelText("Your name"), "Guest");
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(join).toHaveBeenCalledWith("ABC123", { name: "Guest" });
  });

  it("shows actionable localized recovery after an expired poll", async () => {
    const onExit = vi.fn();
    const api = {
      join: vi.fn().mockResolvedValue({
        playerToken: "guest-player-token-long",
        room: {
          code: "ABC123",
          selectedGame: "charades",
          players: [{ id: "1", name: "Guest", isHost: false }],
          self: { id: "1", name: "Guest", isHost: false },
        },
      }),
      poll: (_code: string, _token: string, _state: unknown, onError: (error: unknown) => void) => {
        onError(new RoomClientError("ROOM_EXPIRED", "expired", 410));
        return vi.fn();
      },
    };
    render(<RoomLobby locale="en" initialCode="ABC123" onExit={onExit} api={api as never} />);
    await userEvent.type(screen.getByLabelText("Your name"), "Guest");
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(await screen.findByRole("heading", { name: "Room unavailable" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try joining again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create a new room" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back to games" }));
    expect(onExit).toHaveBeenCalled();
  });
});
