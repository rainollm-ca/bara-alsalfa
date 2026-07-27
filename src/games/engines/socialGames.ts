export type VoteTally = {
  readonly counts: Readonly<Record<string, number>>;
  readonly winners: readonly string[];
  readonly isTie: boolean;
};

export function tallyVotes(votes: readonly string[]): VoteTally {
  const counts: Record<string, number> = {};
  for (const playerId of votes) {
    counts[playerId] = (counts[playerId] ?? 0) + 1;
  }

  const highest = Math.max(0, ...Object.values(counts));
  const winners = Object.keys(counts).filter(
    (playerId) => counts[playerId] === highest,
  );
  return {
    counts: { ...counts },
    winners: [...winners],
    isTie: winners.length > 1,
  };
}

export type TwoTruthsRound = {
  readonly playerId: string;
  readonly statements: readonly [string, string, string];
  readonly lieIndex: 0 | 1 | 2;
  readonly revealed: boolean;
};

export function createTwoTruthsRound(
  playerId: string,
  statements: readonly [string, string, string],
  lieIndex: number,
): TwoTruthsRound {
  if (!playerId.trim()) throw new Error("A player ID is required.");
  if (statements.some((statement) => !statement.trim())) {
    throw new Error("All three statements are required.");
  }
  if (lieIndex !== 0 && lieIndex !== 1 && lieIndex !== 2) {
    throw new Error("The lie index must identify one of the three statements.");
  }
  return {
    playerId,
    statements: [...statements],
    lieIndex,
    revealed: false,
  };
}

export function revealTwoTruthsLie(round: TwoTruthsRound): TwoTruthsRound {
  if (round.revealed) return round;
  return {
    ...round,
    statements: [...round.statements],
    revealed: true,
  };
}
