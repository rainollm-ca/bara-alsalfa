// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoomLobby } from "../src/components/RoomLobby";

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
});
