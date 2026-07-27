// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoomLobby } from "../src/components/RoomLobby";
import { RoomClientError } from "../src/rooms/client";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

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
      expect.any(AbortSignal),
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
    expect(join).toHaveBeenCalledWith("ABC123", { name: "Guest" }, expect.any(AbortSignal));
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

  it("prevents duplicate submissions and ignores late responses", async () => {
    let resolveCreate!: (value: unknown) => void;
    const create = vi.fn(() => new Promise((resolve) => { resolveCreate = resolve; }));
    render(<RoomLobby locale="en" gameId="charades" onExit={vi.fn()} api={{ create } as never} />);
    await userEvent.type(screen.getByLabelText("Your name"), "Host");
    const button = screen.getByRole("button", { name: "Create room" });
    await userEvent.dblClick(button);
    expect(create).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    resolveCreate({
      code: "ABC123",
      playerToken: "player-token-long",
      hostToken: "host-token-long-value",
      room: {},
    });
  });

  it("implements roving keyboard tabs and focuses recovery status", async () => {
    const api = {
      join: vi.fn().mockRejectedValue(new RoomClientError("ROOM_NOT_FOUND", "missing", 404)),
    };
    render(<RoomLobby locale="en" gameId="charades" onExit={vi.fn()} api={api as never} />);
    const createTab = screen.getByRole("tab", { name: "Create" });
    createTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Join" }));
    expect(screen.getByRole("tabpanel")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Your name"), "Guest");
    await userEvent.type(screen.getByLabelText("Room code"), "ABC123");
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));
    const heading = await screen.findByRole("heading", { name: "Room unavailable" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
