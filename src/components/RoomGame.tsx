"use client";

import { useState } from "react";

import type { Locale } from "../games/types";
import type { GameRoomAction, PlayerRoomView } from "../rooms/contracts";
import type { RoomClient, RoomSession } from "../rooms/client";

type Props = {
  locale: Locale;
  room: PlayerRoomView;
  session: RoomSession;
  api: RoomClient;
  onState: (room: PlayerRoomView) => void;
};

const text = {
  en: { round: "Round", correct: "Correct", skip: "Skip", vote: "Vote", waiting: "Waiting for the other players…", result: "Round result", submit: "Submit statements", truth1: "Statement 1", truth2: "Statement 2", truth3: "Statement 3", lie: "The lie is", identity: "Other identities", role: "Your secret", outsider: "You are out of the loop", word: "Secret word" },
  ar: { round: "الجولة", correct: "صحيح", skip: "تخطّي", vote: "صوّت", waiting: "بانتظار بقية اللاعبين…", result: "نتيجة الجولة", submit: "أرسل العبارات", truth1: "العبارة ١", truth2: "العبارة ٢", truth3: "العبارة ٣", lie: "الكذبة هي", identity: "هويات الآخرين", role: "سرّك", outsider: "أنت برا السالفة", word: "الكلمة السرية" },
};

function localized(value: unknown, locale: Locale) {
  if (value && typeof value === "object" && locale in value) return String((value as Record<string, unknown>)[locale]);
  return typeof value === "string" ? value : "";
}

export function RoomGame({ locale, room, session, api, onState }: Props) {
  const t = text[locale];
  const state = (room.gameState?.publicData ?? {}) as Record<string, any>;
  const secret = (room.gameState?.privateData ?? {}) as Record<string, any>;
  const [statements, setStatements] = useState(["", "", ""]);
  const [lieIndex, setLieIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hostGames = new Set(["category-challenge", "charades", "forbidden-word", "rapid-fire"]);

  async function act(action: GameRoomAction) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const token = hostGames.has(room.selectedGame ?? "") ? session.hostToken : session.playerToken;
      if (!token) throw new Error("Host credentials are required.");
      onState((await api.action(room.code, token, action)).room);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const scores = state.scores as Record<string, number> | undefined;
  return (
    <section className="roomGameBoard" data-game-id={room.selectedGame} data-game-phase={state.phase}>
      <p className="roundBadge">{t.round} {state.round ?? 1}</p>
      <h1>{localized(state.prompt, locale) || (state.phase === "result" ? t.result : room.selectedGame)}</h1>
      {state.answer && <p className="roomAnswer">{localized(state.answer, locale)}</p>}
      {Array.isArray(state.forbidden) && <div className="forbiddenWords">{state.forbidden.map((word: unknown, index: number) => <span key={index}>{localized(word, locale)}</span>)}</div>}

      {room.selectedGame === "out-of-loop" && <>
        <h2>{t.role}</h2>
        <p className="secretRoomValue">{secret.role === "outsider" ? t.outsider : `${t.word}: ${localized(secret.word, locale)}`}</p>
      </>}
      {room.selectedGame === "who-am-i" && secret.visibleIdentities && <>
        <h2>{t.identity}</h2>
        {Object.entries(secret.visibleIdentities).map(([id, identity]) => <p key={id}>{room.players.find((p) => p.id === id)?.name}: {localized(identity, locale)}</p>)}
      </>}

      {state.phase === "vote" && (room.selectedGame === "out-of-loop" || room.selectedGame === "most-likely-to") && !secret.voted && (
        <div className="roomVoteGrid">{room.players.map((player) =>
          <button disabled={busy} key={player.id} onClick={() => act({
            type: room.selectedGame === "out-of-loop" ? "out-of-loop/vote" : "most-likely/vote",
            playerId: player.id,
          })}>{t.vote}: {player.name}</button>)}</div>
      )}
      {room.selectedGame === "who-am-i" && state.phase === "play" && state.turnPlayerId === room.self.id && (
        <div className="roomActionRow">
          <button disabled={busy} onClick={() => act({ type: "who-am-i/guess", correct: true })}>{t.correct}</button>
          <button disabled={busy} onClick={() => act({ type: "who-am-i/guess", correct: false })}>{t.skip}</button>
        </div>
      )}
      {room.selectedGame === "two-truths-lie" && state.phase === "submit" && state.turnPlayerId === room.self.id && (
        <div className="truthForm">
          {statements.map((value, index) => <input key={index} aria-label={[t.truth1, t.truth2, t.truth3][index]} value={value} maxLength={120} onChange={(event) => setStatements((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />)}
          <select aria-label={t.lie} value={lieIndex} onChange={(event) => setLieIndex(Number(event.target.value))}>
            {[0, 1, 2].map((index) => <option value={index} key={index}>{index + 1}</option>)}
          </select>
          <button disabled={busy || statements.some((value) => !value.trim())} onClick={() => act({ type: "two-truths/submit", statements: statements as [string, string, string], lieIndex: lieIndex as 0 | 1 | 2 })}>{t.submit}</button>
        </div>
      )}
      {room.selectedGame === "two-truths-lie" && state.phase === "vote" && state.turnPlayerId !== room.self.id && !secret.voted && (
        <div className="roomVoteGrid">{state.statements.map((statement: string, index: number) =>
          <button disabled={busy} key={index} onClick={() => act({ type: "two-truths/vote", index: index as 0 | 1 | 2 })}>{t.vote}: {statement}</button>)}</div>
      )}

      {hostGames.has(room.selectedGame ?? "") && room.self.isHost && state.phase === "play" && (
        <div className="roomActionRow">
          <button disabled={busy} onClick={() => act(room.selectedGame === "category-challenge"
            ? { type: "category/score", correctPlayerId: room.self.id }
            : { type: `${room.selectedGame}/score` as "charades/score", correct: true })}>{t.correct}</button>
          <button disabled={busy} onClick={() => act(room.selectedGame === "category-challenge"
            ? { type: "category/score", correctPlayerId: null }
            : { type: `${room.selectedGame}/score` as "charades/score", correct: false })}>{t.skip}</button>
        </div>
      )}
      {state.phase === "result" && <div className="roomResult" aria-live="polite">
        <h2>{t.result}</h2>
        {state.lieIndex !== undefined && <p>{t.lie}: {state.lieIndex + 1}</p>}
        {state.outsiderPlayerId && <p>{room.players.find((p) => p.id === state.outsiderPlayerId)?.name}</p>}
      </div>}
      {scores && <div className="roomScores">{room.players.map((player) => <span key={player.id}>{player.name}: <b>{scores[player.id] ?? 0}</b></span>)}</div>}
      {error && <p role="alert">{error}</p>}
      {state.phase !== "result" && !room.self.isHost && secret.voted && <p>{t.waiting}</p>}
    </section>
  );
}
