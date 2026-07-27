// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import {
  CategoryChallenge,
  createCategoryChallengeState,
  type CategoryChallengeState,
} from "../src/components/games/CategoryChallenge";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../src/games/content/categoryChallenge";
import { buildBoard } from "../src/games/engines/categoryChallenge";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

  it("keeps focus in the dialog after reveal, awards points, and locks the used cell", async () => {
    const user = await reachBoard();
    const cell = screen.getAllByRole("button", { name: /100/ })[0];
    await user.click(cell);
    await user.click(screen.getByRole("button", { name: "Reveal answer" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "Answer" }));
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close question" }));
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.click(within(dialog).getAllByRole("button", { name: /\+ Correct answer/ })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cell.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Falcons").parentElement?.textContent).toContain("100");
  });

  it("updates localized setup content when the locale is rerendered", () => {
    const view = render(<CategoryChallenge locale="ar" onExit={() => undefined} />);
    expect(screen.getByRole("heading", { name: "جهّزوا تحدّي الفئات" })).toBeTruthy();

    view.rerender(<CategoryChallenge locale="en" onExit={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Set up Category Challenge" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /World Geography/ })).toBeTruthy();
  });

  it("stops the running timer at zero without exposing resume", async () => {
    const user = await reachBoard();
    await user.click(screen.getAllByRole("button", { name: /100/ })[0]);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));

    act(() => vi.advanceTimersByTime(31_000));

    expect(screen.getByText("0s")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume timer" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reveal answer" })).toBeTruthy();
  });

  it("renders the final winner and tie screens from a completed controller snapshot", () => {
    const selectedCategoryIds = CATEGORY_CHALLENGE_CATEGORIES.slice(0, 6).map(({ id }) => id);
    const board = buildBoard(selectedCategoryIds, () => 0);
    const usedQuestionIds = new Set(
      board.categories.flatMap(({ questions }) => questions.map(({ question }) => question.id)),
    );
    const base = createCategoryChallengeState();
    const winnerState: CategoryChallengeState = {
      ...base,
      selectedCategoryIds,
      teamNames: { teamOne: "Falcons", teamTwo: "Stars" },
      scores: { teamOne: 900, teamTwo: 400 },
      usedQuestionIds,
    };

    const view = render(
      <CategoryChallenge
        locale="en"
        onExit={() => undefined}
        initialSession={{ state: winnerState, board }}
      />,
    );
    expect(screen.getByText("Falcons wins!")).toBeTruthy();

    view.rerender(
      <CategoryChallenge
        key="tie"
        locale="en"
        onExit={() => undefined}
        initialSession={{
          state: { ...winnerState, scores: { teamOne: 500, teamTwo: 500 } },
          board,
        }}
      />,
    );
    expect(screen.getByText("It's a tie!")).toBeTruthy();
  });
});
