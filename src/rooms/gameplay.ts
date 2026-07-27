import { CHARADES_PROMPTS, FORBIDDEN_WORD_PROMPTS, RAPID_FIRE_PROMPTS, WHO_AM_I_PROMPTS } from "../games/content/actionGames";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../games/content/categoryChallenge";
import { CATEGORIES } from "../games/content/outOfLoop";
import { MOST_LIKELY_TO_PROMPTS } from "../games/content/socialGames";
import { GAME_CATALOG } from "../games/catalog";
import type { GameId } from "../games/types";
import type { GameRoomAction, JsonValue, Room, RoomGameState } from "./contracts";
import { RoomError } from "./repository";

type State = Record<string, any>;
const MAX_STATEMENT = 120;

const scores = (room: Room) =>
  Object.fromEntries(room.players.map((player) => [player.id, 0]));

const localized = (value: { ar: string; en: string }) => ({ ar: value.ar, en: value.en });

export function initializeGame(
  room: Room,
  now = room.updatedAt,
  round = 1,
  previous?: RoomGameState,
): RoomGameState {
  if (!room.selectedGame) throw new RoomError("INVALID_ACTION", "Select a game first.");
  const gameId = room.selectedGame;
  const definition = GAME_CATALOG.find((game) => game.id === gameId)!;
  if (room.players.length < definition.playerRange.min ||
    room.players.length > definition.playerRange.max) {
    throw new RoomError(
      "INVALID_ACTION",
      `${definition.playerRange.min}–${definition.playerRange.max} players are required.`,
    );
  }
  const prior = previous?.publicData as State | undefined;
  const base: State = { gameId, round, phase: "play", scores: prior?.scores ?? scores(room) };
  const promptIndex = round - 1;
  const activePlayer = room.players[promptIndex % room.players.length]!;
  base.activePlayerId = activePlayer.id;
  let privateByPlayerId: Record<string, JsonValue> | undefined;
  switch (gameId) {
    case "category-challenge": {
      const questions = CATEGORY_CHALLENGE_CATEGORIES.flatMap((category) => category.questions);
      const question = questions[promptIndex % questions.length]!;
      Object.assign(base, { prompt: localized(question.question), promptIndex });
      privateByPlayerId = { __server: { answer: localized(question.answer) } };
      break;
    }
    case "charades":
      Object.assign(base, { activePlayerId: activePlayer.id, timerEndsAt: now + 60_000, promptIndex, usedPromptIds: [...(prior?.usedPromptIds ?? []), promptIndex].slice(-50) });
      privateByPlayerId = {
        [activePlayer.id]: { prompt: localized(CHARADES_PROMPTS[promptIndex % CHARADES_PROMPTS.length]!.text) },
        [room.hostPlayerId]: { prompt: localized(CHARADES_PROMPTS[promptIndex % CHARADES_PROMPTS.length]!.text) },
      };
      break;
    case "forbidden-word": {
      const selected = FORBIDDEN_WORD_PROMPTS[promptIndex % FORBIDDEN_WORD_PROMPTS.length]!;
      Object.assign(base, { activePlayerId: activePlayer.id, timerEndsAt: now + 60_000, promptIndex, usedPromptIds: [...(prior?.usedPromptIds ?? []), promptIndex].slice(-50) });
      const secret = { prompt: localized(selected.text), forbidden: selected.forbidden.map(localized) };
      privateByPlayerId = { [activePlayer.id]: secret, [room.hostPlayerId]: secret };
      break;
    }
    case "rapid-fire":
      Object.assign(base, { activePlayerId: activePlayer.id, timerEndsAt: now + 60_000, promptIndex, usedPromptIds: [...(prior?.usedPromptIds ?? []), promptIndex].slice(-50) });
      privateByPlayerId = {
        [activePlayer.id]: { prompt: localized(RAPID_FIRE_PROMPTS[promptIndex % RAPID_FIRE_PROMPTS.length]!.text) },
        [room.hostPlayerId]: { prompt: localized(RAPID_FIRE_PROMPTS[promptIndex % RAPID_FIRE_PROMPTS.length]!.text) },
      };
      break;
    case "out-of-loop": {
      const category = CATEGORIES[promptIndex % CATEGORIES.length]!;
      const chosenWord = category.words[promptIndex % category.words.length]!;
      const outsider = room.players[(room.players.length - 1 + promptIndex) % room.players.length]!.id;
      Object.assign(base, { phase: "discussion", category: localized(category.title), promptIndex, voteCount: 0 });
      privateByPlayerId = Object.fromEntries(room.players.map((player) => [
        player.id,
        player.id === outsider
          ? { role: "outsider" }
          : { role: "insider", word: localized(chosenWord) },
      ])) as Record<string, JsonValue>;
      privateByPlayerId!.__server = { outsider, word: localized(chosenWord), votes: {} };
      break;
    }
    case "who-am-i": {
      const identities = Object.fromEntries(room.players.map((player, index) => [
        player.id, localized(WHO_AM_I_PROMPTS[(index + promptIndex) % WHO_AM_I_PROMPTS.length]!.text),
      ]));
      Object.assign(base, { turnPlayerId: activePlayer.id, promptIndex });
      privateByPlayerId = Object.fromEntries(room.players.map((player) => [
        player.id,
        { visibleIdentities: Object.fromEntries(Object.entries(identities).filter(([id]) => id !== player.id)) },
      ]));
      privateByPlayerId.__server = { identities };
      break;
    }
    case "most-likely-to":
      Object.assign(base, { phase: "vote", prompt: localized(MOST_LIKELY_TO_PROMPTS[promptIndex % MOST_LIKELY_TO_PROMPTS.length]!.text), promptIndex, voteCount: 0 });
      privateByPlayerId = { __server: { votes: {} } };
      break;
    case "two-truths-lie":
      Object.assign(base, { phase: "submit", turnPlayerId: activePlayer.id, promptIndex });
      privateByPlayerId = { __server: { votes: {} } };
      break;
  }
  return { revision: (previous?.revision ?? 0) + 1, publicData: base as JsonValue, ...(privateByPlayerId ? { privateByPlayerId } : {}) };
}

export function nextGameRound(room: Room, now: number): RoomGameState {
  const state = room.gameState?.publicData as State | undefined;
  if (!room.gameState || state?.phase !== "result") {
    throw new RoomError("INVALID_ACTION", "Finish the current round before continuing.");
  }
  return initializeGame(room, now, Number(state.round) + 1, room.gameState);
}

function exact(action: object, keys: string[]) {
  const actual = Object.keys(action).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new RoomError("INVALID_ACTION", "Action payload contains unsupported fields.");
  }
}

function requireHost(isHost: boolean) {
  if (!isHost) throw new RoomError("HOST_ONLY", "Only the host can control this round.");
}

function player(room: Room, actorId: string | undefined) {
  const found = room.players.find((candidate) => candidate.id === actorId);
  if (!found) throw new RoomError("PLAYER_ONLY", "This action requires the intended player.");
  return found;
}

export function reduceGame(
  room: Room,
  actorId: string | undefined,
  isHost: boolean,
  action: GameRoomAction,
  now = room.updatedAt,
): RoomGameState {
  if (!room.selectedGame || !room.gameState || room.status !== "playing") {
    throw new RoomError("INVALID_ACTION", "The room game is not active.");
  }
  const state = structuredClone(room.gameState.publicData) as State;
  const privateState = structuredClone(room.gameState.privateByPlayerId ?? {}) as Record<string, any>;
  const expectedPrefix: Record<GameId, string> = {
    "category-challenge": "category/", "charades": "charades/",
    "forbidden-word": "forbidden-word/", "rapid-fire": "rapid-fire/",
    "out-of-loop": "out-of-loop/", "who-am-i": "who-am-i/",
    "most-likely-to": "most-likely/", "two-truths-lie": "two-truths/",
  };
  if (!action.type.startsWith(expectedPrefix[room.selectedGame])) {
    throw new RoomError("INVALID_ACTION", "Action does not belong to the selected game.");
  }

  switch (action.type) {
    case "category/score": {
      requireHost(isHost); exact(action, ["type", "correctPlayerId"]);
      if (state.phase !== "play") throw new RoomError("INVALID_ACTION", "Category round is already complete.");
      if (action.correctPlayerId !== null && !room.players.some((p) => p.id === action.correctPlayerId)) {
        throw new RoomError("INVALID_ACTION", "Scored player is not in this room.");
      }
      if (action.correctPlayerId) state.scores[action.correctPlayerId] += 1;
      state.lastScoredPlayerId = action.correctPlayerId;
      state.answer = privateState.__server.answer;
      state.phase = "result";
      break;
    }
    case "charades/score":
    case "forbidden-word/score":
    case "rapid-fire/score": {
      requireHost(isHost); exact(action, ["type", "correct"]);
      if (state.phase !== "play" || typeof action.correct !== "boolean") throw new RoomError("INVALID_ACTION", "Round is already complete.");
      const activeId = state.activePlayerId as string;
      if (action.correct) state.scores[activeId] += 1;
      state.lastScoredPlayerId = action.correct ? activeId : null;
      state.phase = "result";
      break;
    }
    case "out-of-loop/open-vote": {
      requireHost(isHost); exact(action, ["type"]);
      if (state.phase !== "discussion") throw new RoomError("INVALID_ACTION", "Voting cannot open in this phase.");
      state.phase = "vote";
      break;
    }
    case "out-of-loop/vote":
    case "most-likely/vote": {
      exact(action, ["type", "playerId"]);
      const actor = player(room, actorId);
      if (state.phase !== "vote" || !room.players.some((p) => p.id === action.playerId)) {
        throw new RoomError("INVALID_ACTION", "Vote is not valid in this phase.");
      }
      const votes = privateState.__server.votes as Record<string, string>;
      if (votes[actor.id]) throw new RoomError("INVALID_ACTION", "Player already voted.");
      votes[actor.id] = action.playerId;
      privateState[actor.id] = { ...(privateState[actor.id] ?? {}), voted: true };
      state.voteCount = Object.keys(votes).length;
      if (state.voteCount === room.players.length) {
        const counts: Record<string, number> = {};
        Object.values(votes).forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
        state.phase = action.type === "out-of-loop/vote" ? "outsider-guess" : "result";
        state.voteCounts = counts;
        if (action.type === "out-of-loop/vote") {
          state.outsiderPlayerId = privateState.__server.outsider;
        } else {
          const highest = Math.max(...Object.values(counts));
          state.winnerPlayerIds = Object.entries(counts).filter(([, count]) => count === highest).map(([id]) => id);
        }
      }
      break;
    }
    case "out-of-loop/guess": {
      exact(action, ["type", "word"]);
      const actor = player(room, actorId);
      if (state.phase !== "outsider-guess" || actor.id !== privateState.__server.outsider ||
        typeof action.word !== "string" || !action.word.trim() || action.word.length > 80) {
        throw new RoomError("PLAYER_ONLY", "Only the outsider can make one bounded guess.");
      }
      const expected = privateState.__server.word as { ar: string; en: string };
      state.outsiderGuess = action.word.trim();
      state.outsiderCorrect = Object.values(expected).some((word) => word.toLowerCase() === action.word.trim().toLowerCase());
      state.word = expected;
      state.phase = "result";
      break;
    }
    case "who-am-i/guess": {
      exact(action, ["type", "correct"]);
      const actor = player(room, actorId);
      if (state.phase !== "play" || actor.id !== state.turnPlayerId || typeof action.correct !== "boolean") {
        throw new RoomError("PLAYER_ONLY", "Only the current player can resolve their identity.");
      }
      if (action.correct) state.scores[actor.id] += 1;
      state.phase = "result";
      state.revealedIdentity = privateState.__server.identities[actor.id];
      break;
    }
    case "two-truths/submit": {
      exact(action, ["type", "statements", "lieIndex"]);
      const actor = player(room, actorId);
      if (state.phase !== "submit" || actor.id !== state.turnPlayerId) {
        throw new RoomError("PLAYER_ONLY", "Only the current player can submit statements.");
      }
      if (!Array.isArray(action.statements) || action.statements.length !== 3 ||
        action.statements.some((value) => typeof value !== "string" || !value.trim() || value.length > MAX_STATEMENT) ||
        new Set(action.statements.map((value) => value.trim().toLowerCase())).size !== 3 ||
        ![0, 1, 2].includes(action.lieIndex)) {
        throw new RoomError("INVALID_ACTION", "Submit three unique bounded statements and one lie.");
      }
      state.statements = action.statements.map((value) => value.trim());
      state.phase = "vote";
      state.voteCount = 0;
      privateState.__server.lieIndex = action.lieIndex;
      break;
    }
    case "two-truths/vote": {
      exact(action, ["type", "index"]);
      const actor = player(room, actorId);
      if (state.phase !== "vote" || actor.id === state.turnPlayerId || ![0, 1, 2].includes(action.index)) {
        throw new RoomError("INVALID_ACTION", "Vote is not valid in this phase.");
      }
      const votes = privateState.__server.votes as Record<string, number>;
      if (votes[actor.id] !== undefined) throw new RoomError("INVALID_ACTION", "Player already voted.");
      votes[actor.id] = action.index;
      privateState[actor.id] = { voted: true };
      state.voteCount = Object.keys(votes).length;
      if (state.voteCount === room.players.length - 1) {
        state.phase = "result";
        state.lieIndex = privateState.__server.lieIndex;
        state.correctVoters = Object.entries(votes).filter(([, index]) => index === state.lieIndex).map(([id]) => id);
        state.correctVoters.forEach((id: string) => { state.scores[id] += 1; });
      }
      break;
    }
  }
  return {
    revision: room.gameState.revision + 1,
    publicData: state as JsonValue,
    privateByPlayerId: privateState as Record<string, JsonValue>,
  };
}
