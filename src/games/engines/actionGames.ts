import type {
  ActionPrompt,
  ForbiddenWordPrompt,
} from "../content/actionGames";

export type PartyPrompt = ActionPrompt | ForbiddenWordPrompt;

export type PromptDeck = {
  readonly remaining: readonly PartyPrompt[];
};

export type PromptDraw = {
  readonly prompt: PartyPrompt;
  readonly deck: PromptDeck;
};

type Scores = Readonly<Record<string, number>>;
type WidenedScores<S extends Scores> = {
  readonly [PlayerId in keyof S]: number;
};

const clonePrompt = (prompt: PartyPrompt): PartyPrompt =>
  "forbidden" in prompt
    ? {
        ...prompt,
        text: { ...prompt.text },
        forbidden: prompt.forbidden.map((word) => ({ ...word })),
      }
    : { ...prompt, text: { ...prompt.text } };

const shuffle = <T>(values: readonly T[], random: () => number): T[] => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const candidate = Math.floor(random() * (index + 1));
    const swapIndex = Math.max(0, Math.min(index, candidate));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

export function createPromptDeck(
  prompts: readonly PartyPrompt[],
  random: () => number = Math.random,
): PromptDeck {
  return { remaining: shuffle(prompts, random).map(clonePrompt) };
}

export function drawPrompt(deck: PromptDeck): PromptDraw {
  const [next, ...remaining] = deck.remaining;
  if (!next) throw new Error("Cannot draw from an empty prompt deck.");
  return {
    prompt: clonePrompt(next),
    deck: { remaining: remaining.map(clonePrompt) },
  };
}

export function scoreCharades<S extends Scores>(
  scores: S,
  teamId: keyof S,
  guessed: boolean,
): WidenedScores<S> {
  if (!Object.hasOwn(scores, teamId)) {
    throw new Error(`Unknown charades team: ${String(teamId)}`);
  }
  if (!guessed) return scores;
  return { ...scores, [teamId]: scores[teamId] + 1 };
}

export type ForbiddenWordRound = {
  readonly violations: number;
  readonly valid: boolean;
};

export function recordForbiddenWordViolation(
  round: ForbiddenWordRound,
): ForbiddenWordRound {
  return { violations: round.violations + 1, valid: false };
}

export function assignPrivateIdentities(
  playerIds: readonly string[],
  identities: readonly ActionPrompt[],
  random: () => number = Math.random,
): Readonly<Record<string, ActionPrompt>> {
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("Player IDs must be unique.");
  }
  if (identities.length < playerIds.length) {
    throw new Error("There are not enough identities for every player.");
  }

  const selected = shuffle(identities, random).slice(0, playerIds.length);
  return Object.fromEntries(
    playerIds.map((playerId, index) => [
      playerId,
      { ...selected[index], text: { ...selected[index].text } },
    ]),
  );
}

export type RapidFireOutcome = "correct" | "pass";

export function scoreRapidFire<S extends Scores>(
  scores: S,
  playerId: keyof S,
  outcome: RapidFireOutcome,
): WidenedScores<S> {
  if (!Object.hasOwn(scores, playerId)) {
    throw new Error(`Unknown rapid-fire player: ${String(playerId)}`);
  }
  if (outcome === "pass") return scores;
  return { ...scores, [playerId]: scores[playerId] + 1 };
}
