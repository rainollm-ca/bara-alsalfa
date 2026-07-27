"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DurationSelector, SetupShell, TeamNamesField, normalizeSetupNames, validateSetup } from "../SetupShell";
import { CHARADES_PROMPTS, type ActionPrompt } from "../../games/content/actionGames";
import { createPromptDeck, drawPrompt, scoreCharades, type PromptDeck } from "../../games/engines/actionGames";
import type { Locale } from "../../lib/game";
import { TimedRound } from "./TimedRound";
import { isBoolean, isFiniteScoreRecord, isPromptDrawState, isStringList, isSafeInteger, useGameSessionState } from "../../lib/useGameSessionState";

type Props = { locale: Locale; roundSeconds?: number; roundsPerTeam?: number; prompts?: readonly ActionPrompt[]; random?: () => number };
type Summary = { correct: number; skipped: number; failed: number };

export function Charades({ locale, roundSeconds: initialSeconds = 60, roundsPerTeam = 2, prompts = CHARADES_PROMPTS, random = Math.random }: Props) {
  const [teams, setTeams] = useGameSessionState("charades", locale, "teams", [], isStringList);
  const [name, setName] = useState("");
  const [seconds, setSeconds] = useGameSessionState("charades", locale, "seconds", initialSeconds, isSafeInteger(30, 90));
  const [screen, setScreen] = useGameSessionState<"setup" | "round" | "final">("charades", locale, "screen", "setup", (value): value is "setup" | "round" | "final" => ["setup", "round", "final"].includes(String(value)));
  const [turn, setTurn] = useGameSessionState("charades", locale, "turn", 0, isSafeInteger(0, 31));
  const [drawState, setDrawState] = useGameSessionState<{ prompt: ActionPrompt | null; deck: PromptDeck }>("charades", locale, "drawState",
    () => drawPrompt(createPromptDeck(prompts, random)),
    (value): value is { prompt: ActionPrompt | null; deck: PromptDeck } => isPromptDrawState(value),
  );
  const [scores, setScores] = useGameSessionState<Record<string, number>>("charades", locale, "scores", {}, isFiniteScoreRecord);
  const [summary, setSummary] = useGameSessionState<Summary>("charades", locale, "summary", { correct: 0, skipped: 0, failed: 0 }, (value): value is Summary => typeof value === "object" && value !== null && ["correct", "skipped", "failed"].every((key) => Number.isInteger((value as Record<string, unknown>)[key]) && Number((value as Record<string, unknown>)[key]) >= 0 && Number((value as Record<string, unknown>)[key]) <= 1000));
  const [expired, setExpired] = useGameSessionState("charades", locale, "expired", false, isBoolean);
  const advanceRef = useRef<HTMLButtonElement>(null);
  const t = locale === "ar"
    ? { setup: "جهّزوا التمثيل الصامت", team: "اسم الفريق", add: "أضف فريقاً", remove: "حذف", start: "ابدأوا التمثيل", turn: "دور", correct: "صحيح", skip: "تخطي", failed: "فشل", exhausted: "انتهت بطاقات التمثيل", next: "الفريق التالي", final: "شاهدوا النتيجة النهائية", finalTitle: "النتيجة النهائية", wins: "يفوز!", correctCount: "صحيحة", skipCount: "متخطاة", failedCount: "فاشلة", duration: "مدة الجولة", sec: "ث" }
    : { setup: "Set up Charades", team: "Team name", add: "Add team", remove: "Remove", start: "Start Charades", turn: "turn", correct: "Correct", skip: "Skip", failed: "Failed", exhausted: "Prompt deck exhausted", next: "Next team", final: "See final score", finalTitle: "Final score", wins: "wins!", correctCount: "correct", skipCount: "skipped", failedCount: "failed", duration: "Round length", sec: "sec" };
  const validation = validateSetup(normalizeSetupNames(teams).length * 2, { min: 4, max: 16 }, locale);
  const totalTurns = teams.length * roundsPerTeam;
  const prompt = drawState.prompt;

  function addTeam() {
    const next = normalizeSetupNames([...teams, name]);
    if (next.length <= 8) setTeams(next);
    setName("");
  }
  function start() {
    setScores(Object.fromEntries(teams.map((team) => [team, 0])));
    setScreen("round");
  }
  function advance(outcome: "correct" | "skip" | "failed") {
    if (expired) return;
    if (outcome === "correct") {
      setScores((current) => scoreCharades(current, teams[turn % teams.length], true));
      setSummary((current) => ({ ...current, correct: current.correct + 1 }));
    } else if (outcome === "skip") {
      setSummary((current) => ({ ...current, skipped: current.skipped + 1 }));
    } else {
      setSummary((current) => ({ ...current, failed: current.failed + 1 }));
    }
    setDrawState((current) => current.deck.remaining.length
      ? drawPrompt(current.deck)
      : { prompt: null, deck: current.deck });
  }
  function nextTurn() {
    if (turn + 1 >= totalTurns) return setScreen("final");
    setTurn((value) => value + 1);
    setSummary({ correct: 0, skipped: 0, failed: 0 });
    setExpired(false);
  }
  const expire = useCallback(() => setExpired(true), []);
  useEffect(() => {
    if (expired) advanceRef.current?.focus();
  }, [expired]);
  const winner = useMemo(() => Object.entries(scores).sort((a, b) => b[1] - a[1])[0], [scores]);

  if (screen === "setup") return (
    <SetupShell title={t.setup}>
      <TeamNamesField label={t.team} names={teams} value={name} placeholder={t.team} addLabel={t.add} removeLabel={t.remove} max={8} onValueChange={setName} onAdd={addTeam} onRemove={(index) => setTeams(teams.filter((_, i) => i !== index))} />
      <DurationSelector label={t.duration} value={seconds} options={[30, 60, 90]} unit={t.sec} onChange={setSeconds} />
      {!validation.valid && <p role="status" className="validationMessage">{validation.message}</p>}
      <button data-action="primary" className="primary" disabled={!validation.valid} onClick={start}>{t.start}</button>
    </SetupShell>
  );
  if (screen === "final") return <Final title={t.finalTitle} scores={scores} winner={winner?.[0]} wins={t.wins} restart={locale === "ar" ? "لعبة جديدة" : "New game"} onRestart={() => { setTeams([]); setScores({}); setTurn(0); setScreen("setup"); }} />;
  const team = teams[turn % teams.length];
  return (
    <section className="actionGame panel">
      <p className="roundBadge">{locale === "ar" ? `${t.turn} ${team}` : `${team.endsWith("s") ? `${team}'` : `${team}'s`} ${t.turn}`}</p>
      {prompt ? <h1 className="actionPrompt">{prompt.text[locale]}</h1> : <h1 className="actionPrompt">{t.exhausted}</h1>}
      <TimedRound gameId="charades" locale={locale} seconds={seconds} resetKey={turn} onExpire={expire}>
        {(running) => <>
          <div className="roundActions">
            <button disabled={!running || !prompt} className="success" onClick={() => advance("correct")}>{t.correct}</button>
            <button disabled={!running || !prompt} className="secondary" onClick={() => advance("skip")}>{t.skip}</button>
            <button disabled={!running || !prompt} className="danger" onClick={() => advance("failed")}>{t.failed}</button>
          </div>
          <p className="roundSummary" aria-live="polite">{summary.correct} {t.correctCount} · {summary.skipped} {t.skipCount} · {summary.failed} {t.failedCount}</p>
          {expired && <button ref={advanceRef} className="primary" onClick={nextTurn}>{turn + 1 >= totalTurns ? t.final : t.next}</button>}
        </>}
      </TimedRound>
    </section>
  );
}

export function Final({ title, scores, winner, wins, restart, onRestart }: { title: string; scores: Record<string, number>; winner?: string; wins: string; restart?: string; onRestart?: () => void }) {
  return <section className="panel finalScores"><h1>{title}</h1>{Object.entries(scores).map(([team, score]) => <p key={team}><strong>{team}</strong><b>{score}</b></p>)}{winner && <h2>{winner} {wins}</h2>}{onRestart && <button data-action="primary" className="primaryButton" onClick={onRestart}>{restart}</button>}</section>;
}
