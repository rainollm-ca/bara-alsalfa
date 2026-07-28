// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Charades } from "../src/components/games/Charades";
import { ForbiddenWord } from "../src/components/games/ForbiddenWord";
import { RapidFire } from "../src/components/games/RapidFire";
import { WhoAmI } from "../src/components/games/WhoAmI";
import type { ActionPrompt, ForbiddenWordPrompt } from "../src/games/content/actionGames";

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
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next team" }));
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

  it("shows an identity only to a different viewer, restores privacy/focus before passing, and never shows the viewer's own identity", async () => {
    const identities: ActionPrompt[] = [
      { id: "ava-id", text: { ar: "هوية آفا", en: "Ava identity" } },
      { id: "noah-id", text: { ar: "هوية نوح", en: "Noah identity" } },
    ];
    render(<WhoAmI locale="en" prompts={identities} random={() => 0.999} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Player name"), "Ava");
    await user.click(screen.getByRole("button", { name: "Add player" }));
    await user.type(screen.getByLabelText("Player name"), "Noah");
    await user.click(screen.getByRole("button", { name: "Add player" }));
    await user.click(screen.getByRole("button", { name: "Assign identities" }));

    expect(screen.getByText("Pass the device to Ava")).toBeTruthy();
    expect(screen.getByText("Ava: look at everyone else's identities")).toBeTruthy();
    expect(screen.queryByTestId("private-identity")).toBeNull();
    const reveal = screen.getByRole("button", { name: "Reveal identities" });
    expect(document.activeElement).toBe(reveal);
    await user.click(reveal);
    expect(screen.getByTestId("private-identity").textContent).toContain("Noah identity");
    expect(screen.queryByText("Ava identity")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hide and pass" }));
    expect(screen.getByText("Pass the device to Noah")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reveal identities" }));
    expect(screen.queryByTestId("private-identity")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reveal identities" }));
    expect(screen.getByTestId("private-identity").textContent).toContain("Ava identity");
    expect(screen.queryByText("Noah identity")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Begin guessing" }));
    expect(screen.getByRole("heading", { name: "Everyone ready?" })).toBeTruthy();
  });

  it("offers categorized Who Am I packs before assigning identities", () => {
    render(<WhoAmI locale="en" />);
    expect(screen.getByRole("button", { name: "Arab & Islamic civilization" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "World figures" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Family & fictional" })).toBeTruthy();
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
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next team" }));
    fireEvent.click(screen.getByRole("button", { name: "Next team" }));
    expect(screen.getByText("Stars")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    act(() => vi.advanceTimersByTime(1_100));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "See final score" }));
    fireEvent.click(screen.getByRole("button", { name: "See final score" }));
    expect(screen.getByRole("heading", { name: "Final score" })).toBeTruthy();
  });

  it("does not reset exhausted Charades decks or repeat their first prompt", async () => {
    const prompts: ActionPrompt[] = [
      { id: "one", text: { ar: "واحد", en: "One" } },
      { id: "two", text: { ar: "اثنان", en: "Two" } },
    ];
    render(<Charades locale="en" roundSeconds={30} roundsPerTeam={1} prompts={prompts} random={() => 0.999} />);
    const user = await enterTwoTeams("Start Charades");
    await user.click(screen.getByRole("button", { name: "Start timer" }));
    expect(screen.getByRole("heading", { name: "One" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Correct" }));
    expect(screen.getByRole("heading", { name: "Two" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Prompt deck exhausted")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "One" })).toBeNull();
  });

  it("does not reset the exhausted Forbidden Word deck", async () => {
    const prompts: ForbiddenWordPrompt[] = [{
      id: "only-forbidden",
      text: { ar: "وحيدة", en: "Only target" },
      forbidden: [{ ar: "ممنوعة", en: "blocked" }],
    }];
    render(<ForbiddenWord locale="en" prompts={prompts} random={() => 0.999} />);
    const user = await enterTwoTeams("Start Forbidden Word");
    await user.click(screen.getByRole("button", { name: "Start timer" }));
    expect(screen.getByRole("heading", { name: "Only target" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Correct" }));
    expect(screen.getByRole("heading", { name: "Prompt deck exhausted" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Only target" })).toBeNull();
  });

  it("does not reset the exhausted Rapid Fire deck", async () => {
    const prompts: ActionPrompt[] = [{ id: "only-rapid", text: { ar: "وحيد", en: "Only prompt" } }];
    render(<RapidFire locale="en" prompts={prompts} random={() => 0.999} />);
    const user = await enterTwoTeams("Start Rapid Fire");
    await user.click(screen.getByRole("button", { name: "Start timer" }));
    expect(screen.getByRole("heading", { name: "Only prompt" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Pass" }));
    expect(screen.getByRole("heading", { name: "Prompt deck exhausted" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Only prompt" })).toBeNull();
  });

  it("keeps Forbidden penalties round-local across rotation and final score", async () => {
    render(<ForbiddenWord locale="en" roundSeconds={1} roundsPerTeam={1} />);
    await enterTwoTeams("Start Forbidden Word");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    act(() => vi.advanceTimersByTime(1_100));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next team" }));
    fireEvent.click(screen.getByRole("button", { name: "Next team" }));
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Violation" }));
    act(() => vi.advanceTimersByTime(1_100));
    fireEvent.click(screen.getByRole("button", { name: "See final score" }));
    expect(screen.getByText((_, element) => element?.textContent === "Falcons1")).toBeTruthy();
  });

  it("rerenders action-game setup copy in Arabic", () => {
    const view = render(<ForbiddenWord locale="en" />);
    expect(screen.getByRole("heading", { name: "Set up Forbidden Word" })).toBeTruthy();
    view.rerender(<ForbiddenWord locale="ar" />);
    expect(screen.getByRole("heading", { name: "جهّزوا الكلمة الممنوعة" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ابدأوا الكلمة الممنوعة" })).toBeTruthy();
  });
});
