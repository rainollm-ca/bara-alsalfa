// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MostLikelyTo } from "../src/components/games/MostLikelyTo";
import { TwoTruthsLie } from "../src/components/games/TwoTruthsLie";
import { OutOfLoop } from "../src/components/games/OutOfLoop";

afterEach(cleanup);

function addPlayers(names: string[]) {
  for (const name of names) {
    fireEvent.change(screen.getByPlaceholderText(/player name/i), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: /add player/i }));
  }
}

describe("Most Likely To", () => {
  it("collects votes behind pass-device privacy and reveals a tie", () => {
    render(<MostLikelyTo locale="en" />);
    addPlayers(["Aya", "Sam", "Lee"]);
    fireEvent.click(screen.getByRole("button", { name: /start voting/i }));

    expect(screen.queryByText(/Aya voted/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    expect(screen.getByText(/Who is most likely/i)).toBe(document.activeElement);
    fireEvent.click(screen.getByRole("button", { name: "Lee" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));
    expect(screen.queryByRole("button", { name: "Aya" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    fireEvent.click(screen.getByRole("button", { name: "Sam" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));
    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    fireEvent.click(screen.getByRole("button", { name: "Aya" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));

    expect(screen.getByText(/three-way tie/i)).toBeTruthy();
    expect(screen.getByText(/three-way tie/i)).toBe(document.activeElement);
  });
});

describe("Two Truths and a Lie", () => {
  it("validates unique statements, protects the lie, then reveals the result", () => {
    render(<TwoTruthsLie locale="en" />);
    addPlayers(["Aya", "Sam", "Lee"]);
    fireEvent.click(screen.getByRole("button", { name: /enter statements/i }));
    fireEvent.click(screen.getByRole("button", { name: /ready to enter privately/i }));

    const inputs = screen.getAllByPlaceholderText(/statement/i);
    for (const input of inputs) fireEvent.change(input, { target: { value: "same" } });
    expect((screen.getByRole("button", { name: /save secret statements/i }) as HTMLButtonElement).disabled).toBe(true);

    ["Mountain", "Languages", "Tiger"].forEach((value, index) =>
      fireEvent.change(inputs[index], { target: { value } }),
    );
    fireEvent.click(screen.getByLabelText(/statement 3 is the lie/i));
    fireEvent.click(screen.getByRole("button", { name: /save secret statements/i }));
    expect(screen.queryByText("Tiger")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ready to vote privately/i }));
    expect(screen.getByRole("button", { name: "Mountain" })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole("button", { name: "Tiger" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));
    fireEvent.click(screen.getByRole("button", { name: /ready to vote privately/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mountain" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));
    expect(screen.getByRole("button", { name: /reveal the lie/i })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole("button", { name: /reveal the lie/i }));
    expect(screen.getByRole("heading", { name: "Tiger" })).toBe(document.activeElement);
    expect(screen.getByText(/correct guesses: 1/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /next storyteller/i }));
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.queryByText("Tiger")).toBeNull();
  });
});

describe("Out of the Loop", () => {
  it("keeps votes private, renders a neutral tie, and resets on restart", () => {
    render(<OutOfLoop locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: /start the game/i }));
    addPlayers(["Aya", "Sam", "Lee"]);
    fireEvent.click(screen.getByRole("button", { name: /assign roles/i }));
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /tap to reveal your role/i }));
      fireEvent.click(screen.getByRole("button", { name: index === 2 ? /start the questions/i : /next/i }));
    }
    fireEvent.click(screen.getByRole("button", { name: /vote together/i }));
    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    expect(screen.getByRole("heading", { name: /who is out/i })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole("button", { name: "Sam" }));
    fireEvent.click(screen.getByRole("button", { name: /lock my vote/i }));
    expect(screen.queryByRole("button", { name: "Sam" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    fireEvent.click(screen.getByRole("button", { name: "Lee" }));
    fireEvent.click(screen.getByRole("button", { name: /lock my vote/i }));
    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    fireEvent.click(screen.getByRole("button", { name: "Aya" }));
    fireEvent.click(screen.getByRole("button", { name: /lock my vote/i }));
    const tie = screen.getByText(/vote was tied/i);
    expect(tie).toBe(document.activeElement);
    expect(document.querySelector(".resultIcon.win")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /new round/i }));
    expect(screen.getByText(/player 1 of 3/i)).toBeTruthy();
  });
});
