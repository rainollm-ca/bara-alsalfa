import { CHARADES_PROMPTS, FORBIDDEN_WORD_PROMPTS, RAPID_FIRE_PROMPTS, WHO_AM_I_PROMPTS } from "../games/content/actionGames";
import { randomInt as cryptoRandomInt } from "node:crypto";
import { CATEGORY_CHALLENGE_CATEGORIES } from "../games/content/categoryChallenge";
import { CATEGORIES } from "../games/content/outOfLoop";
import { MOST_LIKELY_TO_PROMPTS } from "../games/content/socialGames";
import { GAME_CATALOG } from "../games/catalog";
import type { GameId } from "../games/types";
import type { GameRoomAction, JsonValue, Room, RoomGameState } from "./contracts";
import { RoomError } from "./repository";

type State = Record<string, any>;
type RandomInt = (maxExclusive: number) => number;
const MAX_STATEMENT = 120;

const scores = (room: Room) =>
  Object.fromEntries(room.players.map((player) => [player.id, 0]));

const localized = (value: { ar: string; en: string }) => ({ ar: value.ar, en: value.en });

function timedDuration() {
  const configured = Number(process.env.ROOM_ROUND_DURATION_MS ?? 60_000);
  return Number.isInteger(configured) && configured >= 100 && configured <= 120_000
    ? configured : 60_000;
}

function timedTeams(room: Room) {
  return [
    { id: "team-1", playerIds: room.players.filter((_, index) => index % 2 === 0).map((player) => player.id) },
    { id: "team-2", playerIds: room.players.filter((_, index) => index % 2 === 1).map((player) => player.id) },
  ];
}

function timedPrompt(gameId: GameId, index: number) {
  const source = gameId === "charades" ? CHARADES_PROMPTS :
    gameId === "forbidden-word" ? FORBIDDEN_WORD_PROMPTS : RAPID_FIRE_PROMPTS;
  return source[index % source.length]!;
}

function chooseUnused(length: number, history: readonly number[], randomInt: RandomInt) {
  const used = new Set(history);
  const candidates = Array.from({ length }, (_, index) => index).filter((index) => !used.has(index));
  const pool = candidates.length ? candidates : Array.from({ length }, (_, index) => index);
  const selected = randomInt(pool.length);
  if (!Number.isInteger(selected) || selected < 0 || selected >= pool.length) {
    throw new RoomError("INVALID_ACTION", "Random source returned an invalid index.");
  }
  return pool[selected]!;
}

export function initializeGame(
  room: Room,
  now = room.updatedAt,
  round = 1,
  previous?: RoomGameState,
  randomInt: RandomInt = (maxExclusive) => cryptoRandomInt(maxExclusive),
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
  const turnHistory = [...(prior?.turnHistory ?? [])];
  const activePlayerIndex = chooseUnused(room.players.length, turnHistory, randomInt);
  const activePlayer = room.players[activePlayerIndex]!;
  const promptIndex = round - 1;
  base.activePlayerId = activePlayer.id;
  base.turnHistory = [...turnHistory, activePlayerIndex];
  let privateByPlayerId: Record<string, JsonValue> | undefined;
  switch (gameId) {
    case "category-challenge": {
      const questions = CATEGORY_CHALLENGE_CATEGORIES.flatMap((category) => category.questions);
      const promptHistory = [...(prior?.promptHistory ?? [])];
      const selectedIndex = chooseUnused(questions.length, promptHistory, randomInt);
      const question = questions[selectedIndex]!;
      Object.assign(base, { prompt: localized(question.question), promptIndex: selectedIndex, promptHistory: [...promptHistory, selectedIndex] });
      privateByPlayerId = { __server: { answer: localized(question.answer) } };
      break;
    }
    case "charades":
    case "forbidden-word":
    case "rapid-fire": {
      const priorServer = previous?.privateByPlayerId?.__server as Record<string, any> | undefined;
      const teams = timedTeams(room);
      const activeTeam = teams[(round - 1) % teams.length]!;
      const actorIndex = Math.floor((round - 1) / teams.length) % activeTeam.playerIds.length;
      const activeActorId = activeTeam.playerIds[actorIndex]!;
      const history = [...(priorServer?.promptHistoryIndices ?? [])];
      const publicHistory = [...(prior?.roundPromptHistory ?? [])];
      const sourceLength = gameId === "charades" ? CHARADES_PROMPTS.length :
        gameId === "forbidden-word" ? FORBIDDEN_WORD_PROMPTS.length : RAPID_FIRE_PROMPTS.length;
      const currentPromptIndex = chooseUnused(sourceLength, history, randomInt);
      const selected = timedPrompt(gameId, currentPromptIndex);
      Object.assign(base, {
        teams,
        activeTeamId: activeTeam.id,
        activeActorId,
        activePlayerId: activeActorId,
        teamScores: prior?.teamScores ?? { "team-1": 0, "team-2": 0 },
        roundStartScore: (prior?.teamScores ?? { "team-1": 0, "team-2": 0 })[activeTeam.id],
        timerEndsAt: now + timedDuration(),
        promptIndex: publicHistory.length,
        roundPromptHistory: publicHistory,
        summary: { correct: 0, skipped: 0, failed: 0, violations: 0 },
      });
      const secret: Record<string, JsonValue> = { prompt: localized(selected.text) };
      if ("forbidden" in selected && Array.isArray(selected.forbidden)) {
        secret.forbidden = selected.forbidden.map((word) => localized(word));
      }
      privateByPlayerId = {
        [activeActorId]: secret,
        [room.hostPlayerId]: secret,
        __server: { selectedPromptIndex: currentPromptIndex, promptHistoryIndices: history },
      };
      break;
    }
    case "out-of-loop": {
      const priorServer = previous?.privateByPlayerId?.__server as Record<string, any> | undefined;
      const categoryHistory = [...(prior?.categoryHistory ?? [])];
      const categoryIndex = chooseUnused(CATEGORIES.length, categoryHistory, randomInt);
      const category = CATEGORIES[categoryIndex]!;
      const wordHistory = [...(priorServer?.wordHistory ?? [])];
      const wordIndex = chooseUnused(category.words.length, wordHistory, randomInt);
      const chosenWord = category.words[wordIndex]!;
      const outsiderHistory = [...(priorServer?.outsiderHistory ?? [])];
      const outsiderIndex = chooseUnused(room.players.length, outsiderHistory, randomInt);
      const outsider = room.players[outsiderIndex]!.id;
      Object.assign(base, { phase: "discussion", category: localized(category.title), promptIndex: categoryIndex, categoryHistory: [...categoryHistory, categoryIndex], voteCount: 0 });
      privateByPlayerId = Object.fromEntries(room.players.map((player) => [
        player.id,
        player.id === outsider
          ? { role: "outsider" }
          : { role: "insider", word: localized(chosenWord) },
      ])) as Record<string, JsonValue>;
      privateByPlayerId!.__server = {
        outsider,
        word: localized(chosenWord),
        votes: {},
        wordHistory: [...wordHistory, wordIndex],
        outsiderHistory: [...outsiderHistory, outsiderIndex],
      };
      break;
    }
    case "who-am-i": {
      const priorServer = previous?.privateByPlayerId?.__server as Record<string, any> | undefined;
      const identityHistory = [...(priorServer?.identityHistory ?? [])];
      const available = [...identityHistory];
      const identityIndexes = room.players.map(() => {
        const index = chooseUnused(WHO_AM_I_PROMPTS.length, available, randomInt);
        available.push(index);
        return index;
      });
      const identities = Object.fromEntries(room.players.map((player, index) => [
        player.id, localized(WHO_AM_I_PROMPTS[identityIndexes[index]!]!.text),
      ]));
      Object.assign(base, { turnPlayerId: activePlayer.id, promptIndex });
      privateByPlayerId = Object.fromEntries(room.players.map((player) => [
        player.id,
        { visibleIdentities: Object.fromEntries(Object.entries(identities).filter(([id]) => id !== player.id)) },
      ]));
      privateByPlayerId.__server = { identities, identityHistory: available };
      break;
    }
    case "most-likely-to":
      {
        const history = [...(prior?.promptHistory ?? [])];
        const selectedIndex = chooseUnused(MOST_LIKELY_TO_PROMPTS.length, history, randomInt);
        Object.assign(base, { phase: "vote", prompt: localized(MOST_LIKELY_TO_PROMPTS[selectedIndex]!.text), promptIndex: selectedIndex, promptHistory: [...history, selectedIndex], voteCount: 0 });
      }
      privateByPlayerId = { __server: { votes: {} } };
      break;
    case "two-truths-lie":
      Object.assign(base, { phase: "submit", turnPlayerId: activePlayer.id, promptIndex });
      privateByPlayerId = { __server: { votes: {} } };
      break;
  }
  return { revision: (previous?.revision ?? 0) + 1, publicData: base as JsonValue, ...(privateByPlayerId ? { privateByPlayerId } : {}) };
}

export function nextGameRound(room: Room, now: number, randomInt?: RandomInt): RoomGameState {
  const state = room.gameState?.publicData as State | undefined;
  if (!room.gameState || state?.phase !== "result") {
    throw new RoomError("INVALID_ACTION", "Finish the current round before continuing.");
  }
  return initializeGame(room, now, Number(state.round) + 1, room.gameState, randomInt);
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
  randomInt: RandomInt = (maxExclusive) => cryptoRandomInt(maxExclusive),
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
  if (action.type !== "timed/expire" && !action.type.startsWith(expectedPrefix[room.selectedGame])) {
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
    case "charades/mark":
    case "forbidden-word/mark":
    case "rapid-fire/mark": {
      requireHost(isHost); exact(action, ["type", "outcome"]);
      if (state.phase !== "play" || now > state.timerEndsAt) {
        throw new RoomError("INVALID_ACTION", "The timed round has expired.");
      }
      const allowed = action.type === "charades/mark" ? ["correct", "skip", "failed"] :
        action.type === "forbidden-word/mark" ? ["correct", "skip", "violation"] : ["correct", "skip"];
      if (!allowed.includes(action.outcome)) throw new RoomError("INVALID_ACTION", "Outcome is not valid for this game.");
      if (action.outcome === "correct") {
        state.teamScores[state.activeTeamId] += 1;
        state.summary.correct += 1;
      } else if (action.outcome === "skip") {
        state.summary.skipped += 1;
      } else if (action.outcome === "failed") {
        state.summary.failed += 1;
      } else {
        state.summary.violations += 1;
        state.teamScores[state.activeTeamId] = Math.max(state.roundStartScore, state.teamScores[state.activeTeamId] - 1);
      }
      state.roundPromptHistory = [...state.roundPromptHistory, state.promptIndex];
      privateState.__server.promptHistoryIndices = [
        ...privateState.__server.promptHistoryIndices,
        privateState.__server.selectedPromptIndex,
      ];
      const sourceLength = room.selectedGame === "charades" ? CHARADES_PROMPTS.length :
        room.selectedGame === "forbidden-word" ? FORBIDDEN_WORD_PROMPTS.length : RAPID_FIRE_PROMPTS.length;
      state.promptIndex += 1;
      privateState.__server.selectedPromptIndex = chooseUnused(
        sourceLength,
        privateState.__server.promptHistoryIndices,
        randomInt,
      );
      const selected = timedPrompt(room.selectedGame, privateState.__server.selectedPromptIndex);
      const secret: Record<string, JsonValue> = { prompt: localized(selected.text) };
      if ("forbidden" in selected && Array.isArray(selected.forbidden)) {
        secret.forbidden = selected.forbidden.map((word) => localized(word));
      }
      privateState[state.activeActorId] = secret;
      privateState[room.hostPlayerId] = secret;
      break;
    }
    case "timed/expire": {
      requireHost(isHost); exact(action, ["type"]);
      if (!["charades", "forbidden-word", "rapid-fire"].includes(room.selectedGame) ||
        state.phase !== "play" || now < state.timerEndsAt) {
        throw new RoomError("INVALID_ACTION", "Timed round cannot expire yet.");
      }
      state.phase = "result";
      state.roundPromptHistory = state.roundPromptHistory.includes(state.promptIndex)
        ? state.roundPromptHistory : [...state.roundPromptHistory, state.promptIndex];
      if (!privateState.__server.promptHistoryIndices.includes(privateState.__server.selectedPromptIndex)) {
        privateState.__server.promptHistoryIndices = [
          ...privateState.__server.promptHistoryIndices,
          privateState.__server.selectedPromptIndex,
        ];
      }
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
        state.voteCounts = counts;
        if (action.type === "out-of-loop/vote") {
          state.outsiderPlayerId = privateState.__server.outsider;
          const highest = Math.max(...Object.values(counts));
          const top = Object.entries(counts).filter(([, count]) => count === highest).map(([id]) => id);
          state.caught = top.length === 1 && top[0] === state.outsiderPlayerId;
          if (state.caught) {
            state.phase = "outsider-guess";
          } else {
            state.phase = "result";
            state.outsiderCorrect = true;
            state.word = privateState.__server.word;
            state.scores[state.outsiderPlayerId] += 1;
          }
        } else {
          state.phase = "result";
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
      if (state.outsiderCorrect) state.scores[actor.id] += 1;
      else room.players.filter((candidate) => candidate.id !== actor.id)
        .forEach((candidate) => { state.scores[candidate.id] += 1; });
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
      const order = [0, 1, 2];
      for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = randomInt(index + 1);
        if (!Number.isInteger(swap) || swap < 0 || swap > index) {
          throw new RoomError("INVALID_ACTION", "Random source returned an invalid index.");
        }
        [order[index], order[swap]] = [order[swap]!, order[index]!];
      }
      state.statements = order.map((index) => action.statements[index]!.trim());
      state.phase = "vote";
      state.voteCount = 0;
      privateState.__server.lieIndex = order.indexOf(action.lieIndex);
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
