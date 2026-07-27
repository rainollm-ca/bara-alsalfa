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

export function initializeGame(room: Room): RoomGameState {
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
  const base: State = { gameId, round: 1, phase: "play", scores: scores(room) };
  let privateByPlayerId: Record<string, JsonValue> | undefined;
  switch (gameId) {
    case "category-challenge": {
      const question = CATEGORY_CHALLENGE_CATEGORIES[0]!.questions[0]!;
      Object.assign(base, { prompt: localized(question.question), promptIndex: 0 });
      privateByPlayerId = { __server: { answer: localized(question.answer) } };
      break;
    }
    case "charades":
      Object.assign(base, { prompt: localized(CHARADES_PROMPTS[0]!.text), promptIndex: 0, usedPromptIds: [] });
      break;
    case "forbidden-word": {
      const prompt = FORBIDDEN_WORD_PROMPTS[0]!;
      Object.assign(base, { prompt: localized(prompt.text), forbidden: prompt.forbidden.map(localized), promptIndex: 0, usedPromptIds: [] });
      break;
    }
    case "rapid-fire":
      Object.assign(base, { prompt: localized(RAPID_FIRE_PROMPTS[0]!.text), promptIndex: 0, usedPromptIds: [] });
      break;
    case "out-of-loop": {
      const word = CATEGORIES[0]!.words[0]!;
      const outsider = room.players.at(-1)!.id;
      Object.assign(base, { phase: "vote", category: localized(CATEGORIES[0]!.title), voteCount: 0 });
      privateByPlayerId = Object.fromEntries(room.players.map((player) => [
        player.id,
        player.id === outsider
          ? { role: "outsider" }
          : { role: "insider", word: localized(word) },
      ])) as Record<string, JsonValue>;
      privateByPlayerId!.__server = { outsider, votes: {} };
      break;
    }
    case "who-am-i": {
      const identities = Object.fromEntries(room.players.map((player, index) => [
        player.id, localized(WHO_AM_I_PROMPTS[index % WHO_AM_I_PROMPTS.length]!.text),
      ]));
      Object.assign(base, { turnPlayerId: room.players[0]!.id });
      privateByPlayerId = Object.fromEntries(room.players.map((player) => [
        player.id,
        { visibleIdentities: Object.fromEntries(Object.entries(identities).filter(([id]) => id !== player.id)) },
      ]));
      privateByPlayerId.__server = { identities };
      break;
    }
    case "most-likely-to":
      Object.assign(base, { phase: "vote", prompt: localized(MOST_LIKELY_TO_PROMPTS[0]!.text), voteCount: 0 });
      privateByPlayerId = { __server: { votes: {} } };
      break;
    case "two-truths-lie":
      Object.assign(base, { phase: "submit", turnPlayerId: room.players[0]!.id });
      privateByPlayerId = { __server: { votes: {} } };
      break;
  }
  return { revision: 1, publicData: base as JsonValue, ...(privateByPlayerId ? { privateByPlayerId } : {}) };
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

function advancePrompt(gameId: GameId, index: number) {
  const source = gameId === "charades" ? CHARADES_PROMPTS :
    gameId === "forbidden-word" ? FORBIDDEN_WORD_PROMPTS : RAPID_FIRE_PROMPTS;
  return source[(index + 1) % source.length]!;
}

export function reduceGame(
  room: Room,
  actorId: string | undefined,
  isHost: boolean,
  action: GameRoomAction,
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
      if (typeof action.correct !== "boolean") throw new RoomError("INVALID_ACTION", "Correct must be boolean.");
      const hostId = room.hostPlayerId;
      if (action.correct) state.scores[hostId] += 1;
      const prompt = advancePrompt(room.selectedGame, state.promptIndex);
      state.usedPromptIds = [...state.usedPromptIds, state.promptIndex].slice(-50);
      state.promptIndex += 1;
      state.prompt = localized(prompt.text);
      if ("forbidden" in prompt && Array.isArray(prompt.forbidden)) {
        state.forbidden = prompt.forbidden.map((value: { ar: string; en: string }) => localized(value));
      }
      state.lastScoredPlayerId = action.correct ? hostId : null;
      state.phase = "result";
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
        state.phase = "result";
        state.voteCounts = counts;
        if (action.type === "out-of-loop/vote") {
          state.outsiderPlayerId = privateState.__server.outsider;
          state.word = (privateState[room.players.find((p) => p.id !== state.outsiderPlayerId)!.id] as any).word;
        }
      }
      break;
    }
    case "who-am-i/guess": {
      exact(action, ["type", "correct"]);
      const actor = player(room, actorId);
      if (actor.id !== state.turnPlayerId || typeof action.correct !== "boolean") {
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
