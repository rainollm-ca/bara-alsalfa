export type VoteTally = {
  readonly counts: Readonly<Record<string, number>>;
  readonly winners: readonly string[];
  readonly isTie: boolean;
};

export function tallyVotes(votes: readonly string[]): VoteTally {
  const voteMap = new Map<string, number>();
  for (const playerId of votes) {
    voteMap.set(playerId, (voteMap.get(playerId) ?? 0) + 1);
  }

  const highest = Math.max(0, ...voteMap.values());
  const winners = [...voteMap.entries()]
    .filter(([, count]) => count === highest)
    .map(([playerId]) => playerId);
  const counts = Object.create(null) as Record<string, number>;
  for (const [playerId, count] of voteMap) counts[playerId] = count;
  return {
    counts,
    winners: [...winners],
    isTie: winners.length > 1,
  };
}

export type TwoTruthsSecretRound = {
  readonly playerId: string;
  readonly statements: readonly [string, string, string];
  readonly lieIndex: 0 | 1 | 2;
  readonly revealed: boolean;
};

export type HiddenTwoTruthsView = {
  readonly playerId: string;
  readonly statements: readonly [string, string, string];
  readonly revealed: false;
};

export type RevealedTwoTruthsView = {
  readonly playerId: string;
  readonly statements: readonly [string, string, string];
  readonly revealed: true;
  readonly lieIndex: 0 | 1 | 2;
};

export type TwoTruthsPlayerView = HiddenTwoTruthsView | RevealedTwoTruthsView;

export function createTwoTruthsRound(
  playerId: string,
  statements: readonly [string, string, string],
  lieIndex: number,
): TwoTruthsSecretRound {
  if (!playerId.trim()) throw new Error("A player ID is required.");
  if (statements.some((statement) => !statement.trim())) {
    throw new Error("All three statements are required.");
  }
  const normalized = statements.map((statement) => statement.trim().toLocaleLowerCase());
  if (new Set(normalized).size !== 3) {
    throw new Error("All three statements must be unique.");
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

export function revealTwoTruthsLie(
  round: TwoTruthsSecretRound,
): TwoTruthsSecretRound {
  if (round.revealed) return round;
  return {
    ...round,
    statements: [...round.statements],
    revealed: true,
  };
}

export function projectTwoTruthsRound(
  round: TwoTruthsSecretRound,
): TwoTruthsPlayerView {
  const shared = {
    playerId: round.playerId,
    statements: [...round.statements] as readonly [string, string, string],
  };
  return round.revealed
    ? { ...shared, revealed: true, lieIndex: round.lieIndex }
    : { ...shared, revealed: false };
}
