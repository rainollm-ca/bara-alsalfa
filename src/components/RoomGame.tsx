"use client";

import { useEffect, useRef, useState } from "react";

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
  en: { round: "Round", correct: "Correct", skip: "Skip", failed: "Failed", violation: "Violation", expire: "End timed round", vote: "Vote", waiting: "Waiting for the other players…", result: "Round result", submit: "Submit statements", truth1: "Statement 1", truth2: "Statement 2", truth3: "Statement 3", lie: "The lie is", identity: "Other identities", role: "Your secret", outsider: "You are out of the loop", word: "Secret word", next: "Next round", lobby: "Back to lobby", openVote: "Open voting", guess: "Guess the word", winner: "Winner", active: "Active player" },
  ar: { round: "الجولة", correct: "صحيح", skip: "تخطّي", failed: "فشل", violation: "مخالفة", expire: "أنهِ الجولة المؤقتة", vote: "صوّت", waiting: "بانتظار بقية اللاعبين…", result: "نتيجة الجولة", submit: "أرسل العبارات", truth1: "العبارة ١", truth2: "العبارة ٢", truth3: "العبارة ٣", lie: "الكذبة هي", identity: "هويات الآخرين", role: "سرّك", outsider: "أنت برا السالفة", word: "الكلمة السرية", next: "الجولة التالية", lobby: "العودة للغرفة", openVote: "افتح التصويت", guess: "احزر الكلمة", winner: "الفائز", active: "اللاعب الحالي" },
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
  const [guess, setGuess] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const phaseHeading = useRef<HTMLHeadingElement>(null);
  const hostGames = new Set(["category-challenge", "charades", "forbidden-word", "rapid-fire"]);
  useEffect(() => phaseHeading.current?.focus(), [state.phase, state.round]);
  useEffect(() => {
    if (!state.timerEndsAt || state.phase !== "play") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state.phase, state.timerEndsAt]);

  async function act(action: GameRoomAction) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const requiresHost = hostGames.has(room.selectedGame ?? "") ||
        ["game/next-round", "game/return-lobby", "out-of-loop/open-vote"].includes(action.type);
      const token = requiresHost ? session.hostToken : session.playerToken;
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
      <h1 ref={phaseHeading} tabIndex={-1}>{localized(secret.prompt ?? state.prompt, locale) || (state.phase === "result" ? t.result : room.selectedGame)}</h1>
      {state.answer && <p className="roomAnswer">{localized(state.answer, locale)}</p>}
      {Array.isArray(secret.forbidden) && <div className="forbiddenWords">{secret.forbidden.map((word: unknown, index: number) => <span key={index}>{localized(word, locale)}</span>)}</div>}
      {state.activePlayerId && <p>{t.active}: {room.players.find((player) => player.id === state.activePlayerId)?.name}</p>}
      {state.activeTeamId && <p>{state.activeTeamId}</p>}
      {state.timerEndsAt && <p className="roomTimer" data-timer-ends-at={state.timerEndsAt}>{Math.max(0, Math.ceil((state.timerEndsAt - now) / 1000))}s</p>}

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
          <button data-action="vote-player" data-player-id={player.id} disabled={busy} key={player.id} onClick={() => act({
            type: room.selectedGame === "out-of-loop" ? "out-of-loop/vote" : "most-likely/vote",
            playerId: player.id,
          })}>{t.vote}: {player.name}</button>)}</div>
      )}
      {room.selectedGame === "out-of-loop" && state.phase === "discussion" && room.self.isHost && (
        <button data-action="open-vote" className="primaryButton" disabled={busy} onClick={() => act({ type: "out-of-loop/open-vote" })}>{t.openVote}</button>
      )}
      {room.selectedGame === "out-of-loop" && state.phase === "outsider-guess" && secret.role === "outsider" && (
        <div className="truthForm"><input aria-label={t.guess} maxLength={80} value={guess} onChange={(event) => setGuess(event.target.value)} />
          <button data-action="outsider-guess" disabled={busy || !guess.trim()} onClick={() => act({ type: "out-of-loop/guess", word: guess })}>{t.guess}</button></div>
      )}
      {room.selectedGame === "who-am-i" && state.phase === "play" && state.turnPlayerId === room.self.id && (
        <div className="roomActionRow">
          <button data-action="correct" disabled={busy} onClick={() => act({ type: "who-am-i/guess", correct: true })}>{t.correct}</button>
          <button data-action="skip" disabled={busy} onClick={() => act({ type: "who-am-i/guess", correct: false })}>{t.skip}</button>
        </div>
      )}
      {room.selectedGame === "two-truths-lie" && state.phase === "submit" && state.turnPlayerId === room.self.id && (
        <div className="truthForm">
          {statements.map((value, index) => <input key={index} aria-label={[t.truth1, t.truth2, t.truth3][index]} value={value} maxLength={120} onChange={(event) => setStatements((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />)}
          <select aria-label={t.lie} value={lieIndex} onChange={(event) => setLieIndex(Number(event.target.value))}>
            {[0, 1, 2].map((index) => <option value={index} key={index}>{index + 1}</option>)}
          </select>
          <button data-action="submit-statements" disabled={busy || statements.some((value) => !value.trim())} onClick={() => act({ type: "two-truths/submit", statements: statements as [string, string, string], lieIndex: lieIndex as 0 | 1 | 2 })}>{t.submit}</button>
        </div>
      )}
      {room.selectedGame === "two-truths-lie" && state.phase === "vote" && state.turnPlayerId !== room.self.id && !secret.voted && (
        <div className="roomVoteGrid">{state.statements.map((statement: string, index: number) =>
          <button data-action="vote-statement" data-statement-index={index} disabled={busy} key={index} onClick={() => act({ type: "two-truths/vote", index: index as 0 | 1 | 2 })}>{t.vote}: {statement}</button>)}</div>
      )}

      {hostGames.has(room.selectedGame ?? "") && room.self.isHost && state.phase === "play" && (
        <div className="roomActionRow">
          {room.selectedGame === "category-challenge" ? room.players.map((player) =>
            <button data-action="correct-player" data-player-id={player.id} disabled={busy} key={player.id} onClick={() => act({ type: "category/score", correctPlayerId: player.id })}>{t.correct}: {player.name}</button>) :
            <button data-action="correct" disabled={busy} onClick={() => act({ type: `${room.selectedGame}/mark` as "charades/mark", outcome: "correct" })}>{t.correct}</button>}
          <button data-action="skip" disabled={busy} onClick={() => act(room.selectedGame === "category-challenge"
            ? { type: "category/score", correctPlayerId: null }
            : { type: `${room.selectedGame}/mark` as "charades/mark", outcome: "skip" })}>{t.skip}</button>
          {room.selectedGame === "charades" && <button data-action="failed" disabled={busy} onClick={() => act({ type: "charades/mark", outcome: "failed" })}>{t.failed}</button>}
          {room.selectedGame === "forbidden-word" && <button data-action="violation" disabled={busy} onClick={() => act({ type: "forbidden-word/mark", outcome: "violation" })}>{t.violation}</button>}
          {room.selectedGame !== "category-challenge" && <button data-action="expire" disabled={busy} onClick={() => act({ type: "timed/expire" })}>{t.expire}</button>}
        </div>
      )}
      {state.phase === "result" && <div className="roomResult" aria-live="polite">
        <h2>{t.result}</h2>
        {state.lieIndex !== undefined && <p>{t.lie}: {state.lieIndex + 1}</p>}
        {state.correctVoters && <p>{state.correctVoters.map((id: string) => room.players.find((p) => p.id === id)?.name).join(", ")}</p>}
        {state.revealedIdentity && <p>{localized(state.revealedIdentity, locale)}</p>}
        {state.voteCounts && Object.entries(state.voteCounts).map(([id, count]) => <p key={id}>{room.players.find((p) => p.id === id)?.name}: {String(count)}</p>)}
        {state.winnerPlayerIds && <p>{t.winner}: {state.winnerPlayerIds.map((id: string) => room.players.find((p) => p.id === id)?.name).join(", ")}</p>}
        {state.outsiderPlayerId && <p>{room.players.find((p) => p.id === state.outsiderPlayerId)?.name} — {localized(state.word, locale)} — {state.outsiderCorrect ? t.correct : t.skip}</p>}
        {state.summary && <p className="roundSummary">
          {t.correct}: {state.summary.correct ?? 0} · {t.skip}: {state.summary.skipped ?? 0}
          {state.summary.failed ? ` · ${t.failed}: ${state.summary.failed}` : ""}
          {state.summary.violations ? ` · ${t.violation}: ${state.summary.violations}` : ""}
        </p>}
        {room.self.isHost && <div className="roomActionRow">
          <button data-action="next-round" disabled={busy} onClick={() => act({ type: "game/next-round" })}>{t.next}</button>
          <button data-action="return-lobby" disabled={busy} onClick={() => act({ type: "game/return-lobby" })}>{t.lobby}</button>
        </div>}
      </div>}
      {scores && <div className="roomScores">{room.players.map((player) => <span key={player.id}>{player.name}: <b>{scores[player.id] ?? 0}</b></span>)}</div>}
      {state.teamScores && <div className="roomScores">{Object.entries(state.teamScores).map(([team, score]) => <span key={team}>{team}: <b>{String(score)}</b></span>)}</div>}
      {error && <p role="alert">{error}</p>}
      {state.phase !== "result" && !room.self.isHost && secret.voted && <p>{t.waiting}</p>}
      {room.self.isHost && state.phase !== "result" && <button className="textButton" disabled={busy} onClick={() => act({ type: "game/return-lobby" })}>{t.lobby}</button>}
    </section>
  );
}
