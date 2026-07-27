// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MostLikelyTo } from "../src/components/games/MostLikelyTo";
import { TwoTruthsLie } from "../src/components/games/TwoTruthsLie";

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
    fireEvent.click(screen.getByRole("button", { name: "Aya" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));
    expect(screen.queryByRole("button", { name: "Aya" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    fireEvent.click(screen.getByRole("button", { name: "Sam" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));
    fireEvent.click(screen.getByRole("button", { name: /ready, vote privately/i }));
    fireEvent.click(screen.getByRole("button", { name: "Lee" }));
    fireEvent.click(screen.getByRole("button", { name: /lock vote/i }));

    expect(screen.getByText(/three-way tie/i)).toBeTruthy();
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
  });
});
