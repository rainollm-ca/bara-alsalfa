// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Charades } from "../src/components/games/Charades";
import { ForbiddenWord } from "../src/components/games/ForbiddenWord";
import { RapidFire } from "../src/components/games/RapidFire";
import { WhoAmI } from "../src/components/games/WhoAmI";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function enterTwoTeams(startLabel: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Team name"), "Falcons");
  await user.click(screen.getByRole("button", { name: "Add team" }));
  await user.type(screen.getByLabelText("Team name"), "Stars");
  await user.click(screen.getByRole("button", { name: "Add team" }));
  await user.click(screen.getByRole("button", { name: startLabel }));
  return user;
}

describe("timed action game components", () => {
  it("starts Charades, wires correct and skip, expires by timestamp, advances team, and shows final score", async () => {
    render(<Charades locale="en" roundSeconds={1} roundsPerTeam={1} />);
    const user = await enterTwoTeams("Start Charades");

    expect(screen.getByText("Falcons' turn")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Start timer" }));
    await user.click(screen.getByRole("button", { name: "Correct" }));
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("1 correct") === true)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("1 skipped") === true)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Failed" }));
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("1 failed") === true)).toBeTruthy();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume timer" }));
    act(() => vi.advanceTimersByTime(1_100));
    expect(screen.getByRole("button", { name: "Next team" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next team" }));
    expect(screen.getByText("Stars' turn")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    act(() => vi.advanceTimersByTime(1_100));
    fireEvent.click(screen.getByRole("button", { name: "See final score" }));
    expect(screen.getByRole("heading", { name: "Final score" })).toBeTruthy();
    expect(screen.getByText("Falcons wins!")).toBeTruthy();
  });

  it("records Forbidden Word violations and valid correct answers", async () => {
    render(<ForbiddenWord locale="en" roundSeconds={30} roundsPerTeam={1} />);
    const user = await enterTwoTeams("Start Forbidden Word");
    await user.click(screen.getByRole("button", { name: "Start timer" }));
    await user.click(screen.getByRole("button", { name: "Violation" }));
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("1 violation") === true)).toBeTruthy();
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("0 point this round") === true)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Correct" }));
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("1 point this round") === true)).toBeTruthy();
  });

  it("keeps each Who Am I identity private until reveal and restores privacy before passing", async () => {
    render(<WhoAmI locale="en" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Player name"), "Ava");
    await user.click(screen.getByRole("button", { name: "Add player" }));
    await user.type(screen.getByLabelText("Player name"), "Noah");
    await user.click(screen.getByRole("button", { name: "Add player" }));
    await user.click(screen.getByRole("button", { name: "Assign identities" }));

    expect(screen.getByText("Pass the device to Ava")).toBeTruthy();
    expect(screen.queryByTestId("private-identity")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reveal identity" }));
    expect(screen.getByTestId("private-identity")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hide and pass" }));
    expect(screen.getByText("Pass the device to Noah")).toBeTruthy();
    expect(screen.queryByTestId("private-identity")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reveal identity" }));
    await user.click(screen.getByRole("button", { name: "Begin guessing" }));
    expect(screen.getByRole("heading", { name: "Everyone ready?" })).toBeTruthy();
  });

  it("runs Rapid Fire controls and preserves the round summary", async () => {
    render(<RapidFire locale="en" roundSeconds={1} roundsPerTeam={1} />);
    await enterTwoTeams("Start Rapid Fire");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("1 correct") === true)).toBeTruthy();
    expect(screen.getByText((_, element) => element?.className === "roundSummary" && element.textContent?.includes("1 passed") === true)).toBeTruthy();

    act(() => vi.advanceTimersByTime(1_100));
    expect(screen.getByText("Round summary")).toBeTruthy();
  });
});
