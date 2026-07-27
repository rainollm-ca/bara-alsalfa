"use client";

import { useCallback, useMemo, useState } from "react";
import { DurationSelector, SetupShell, TeamNamesField, normalizeSetupNames, validateSetup } from "../SetupShell";
import { CHARADES_PROMPTS } from "../../games/content/actionGames";
import { createPromptDeck, drawPrompt, scoreCharades } from "../../games/engines/actionGames";
import type { Locale } from "../../lib/game";
import { TimedRound } from "./TimedRound";

type Props = { locale: Locale; roundSeconds?: number; roundsPerTeam?: number };
type Summary = { correct: number; skipped: number; failed: number };

export function Charades({ locale, roundSeconds: initialSeconds = 60, roundsPerTeam = 2 }: Props) {
  const [teams, setTeams] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [seconds, setSeconds] = useState(initialSeconds);
  const [screen, setScreen] = useState<"setup" | "round" | "final">("setup");
  const [turn, setTurn] = useState(0);
  const [deck, setDeck] = useState(() => createPromptDeck(CHARADES_PROMPTS));
  const [prompt, setPrompt] = useState(() => drawPrompt(createPromptDeck(CHARADES_PROMPTS)).prompt);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<Summary>({ correct: 0, skipped: 0, failed: 0 });
  const [expired, setExpired] = useState(false);
  const t = locale === "ar"
    ? { setup: "جهّزوا التمثيل الصامت", team: "اسم الفريق", add: "أضف فريقاً", remove: "حذف", start: "ابدأوا التمثيل", turn: "دور", correct: "صحيح", skip: "تخطي", failed: "فشل", next: "الفريق التالي", final: "شاهدوا النتيجة النهائية", finalTitle: "النتيجة النهائية", wins: "يفوز!", correctCount: "صحيحة", skipCount: "متخطاة", failedCount: "فاشلة", duration: "مدة الجولة", sec: "ث" }
    : { setup: "Set up Charades", team: "Team name", add: "Add team", remove: "Remove", start: "Start Charades", turn: "turn", correct: "Correct", skip: "Skip", failed: "Failed", next: "Next team", final: "See final score", finalTitle: "Final score", wins: "wins!", correctCount: "correct", skipCount: "skipped", failedCount: "failed", duration: "Round length", sec: "sec" };
  const validation = validateSetup(normalizeSetupNames(teams).length * 2, { min: 4, max: 16 }, locale);
  const totalTurns = teams.length * roundsPerTeam;

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
    const draw = drawPrompt(deck.remaining.length ? deck : createPromptDeck(CHARADES_PROMPTS));
    setDeck(draw.deck);
    setPrompt(draw.prompt);
  }
  function nextTurn() {
    if (turn + 1 >= totalTurns) return setScreen("final");
    setTurn((value) => value + 1);
    setSummary({ correct: 0, skipped: 0, failed: 0 });
    setExpired(false);
  }
  const expire = useCallback(() => setExpired(true), []);
  const winner = useMemo(() => Object.entries(scores).sort((a, b) => b[1] - a[1])[0], [scores]);

  if (screen === "setup") return (
    <SetupShell title={t.setup}>
      <TeamNamesField label={t.team} names={teams} value={name} placeholder={t.team} addLabel={t.add} removeLabel={t.remove} max={8} onValueChange={setName} onAdd={addTeam} onRemove={(index) => setTeams(teams.filter((_, i) => i !== index))} />
      <DurationSelector label={t.duration} value={seconds} options={[30, 60, 90]} unit={t.sec} onChange={setSeconds} />
      {!validation.valid && <p role="status" className="validationMessage">{validation.message}</p>}
      <button className="primary" disabled={!validation.valid} onClick={start}>{t.start}</button>
    </SetupShell>
  );
  if (screen === "final") return <Final title={t.finalTitle} scores={scores} winner={winner?.[0]} wins={t.wins} />;
  const team = teams[turn % teams.length];
  return (
    <section className="actionGame panel">
      <p className="roundBadge">{locale === "ar" ? `${t.turn} ${team}` : `${team.endsWith("s") ? `${team}'` : `${team}'s`} ${t.turn}`}</p>
      <h1 className="actionPrompt">{prompt.text[locale]}</h1>
      <TimedRound locale={locale} seconds={seconds} resetKey={turn} onExpire={expire}>
        {(running) => <>
          <div className="roundActions">
            <button disabled={!running} className="success" onClick={() => advance("correct")}>{t.correct}</button>
            <button disabled={!running} className="secondary" onClick={() => advance("skip")}>{t.skip}</button>
            <button disabled={!running} className="danger" onClick={() => advance("failed")}>{t.failed}</button>
          </div>
          <p className="roundSummary" aria-live="polite">{summary.correct} {t.correctCount} · {summary.skipped} {t.skipCount} · {summary.failed} {t.failedCount}</p>
          {expired && <button className="primary" onClick={nextTurn}>{turn + 1 >= totalTurns ? t.final : t.next}</button>}
        </>}
      </TimedRound>
    </section>
  );
}

export function Final({ title, scores, winner, wins }: { title: string; scores: Record<string, number>; winner?: string; wins: string }) {
  return <section className="panel finalScores"><h1>{title}</h1>{Object.entries(scores).map(([team, score]) => <p key={team}><strong>{team}</strong><b>{score}</b></p>)}{winner && <h2>{winner} {wins}</h2>}</section>;
}
