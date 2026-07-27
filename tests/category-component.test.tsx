// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import React from "react";

import { CategoryChallenge } from "../src/components/games/CategoryChallenge";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../src/games/content/categoryChallenge";

afterEach(cleanup);

async function reachBoard() {
  const user = userEvent.setup();
  render(<CategoryChallenge locale="en" onExit={() => undefined} />);
  for (const category of CATEGORY_CHALLENGE_CATEGORIES.slice(0, 6)) {
    await user.click(screen.getByRole("button", { name: new RegExp(category.title.en) }));
  }
  await user.type(screen.getByLabelText("Team one name"), "Falcons");
  await user.type(screen.getByLabelText("Team two name"), "Stars");
  await user.click(screen.getByRole("button", { name: "Start challenge" }));
  return user;
}

describe("Category Challenge component", () => {
  it("runs setup through opening a board question paused at 30 seconds", async () => {
    const user = await reachBoard();
    const cell = screen.getAllByRole("button", { name: /100/ })[0];
    await user.click(cell);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("30s")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start timer" })).toBeTruthy();
    expect(screen.getByRole("dialog").querySelector("#question-title")).toBe(document.activeElement);
    expect(cell.closest("[inert]")).toBeTruthy();
  });

  it("wires start, pause, and resume controls", async () => {
    const user = await reachBoard();
    await user.click(screen.getAllByRole("button", { name: /100/ })[0]);
    await user.click(screen.getByRole("button", { name: "Start timer" }));
    expect(screen.getByRole("button", { name: "Pause timer" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Pause timer" }));
    expect(screen.getByRole("button", { name: "Resume timer" })).toBeTruthy();
  });

  it("traps focus, closes with Escape while paused, and restores cell focus", async () => {
    const user = await reachBoard();
    const cell = screen.getAllByRole("button", { name: /100/ })[0];
    await user.click(cell);

    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close question" });
    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(cell);
  });
});
