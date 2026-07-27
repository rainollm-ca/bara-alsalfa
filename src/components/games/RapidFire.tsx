"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DurationSelector, SetupShell, TeamNamesField, normalizeSetupNames, validateSetup } from "../SetupShell";
import { RAPID_FIRE_PROMPTS, type ActionPrompt } from "../../games/content/actionGames";
import { createPromptDeck, drawPrompt, scoreRapidFire, type PromptDeck } from "../../games/engines/actionGames";
import type { Locale } from "../../lib/game";
import { Final } from "./Charades";
import { TimedRound } from "./TimedRound";

type Props = { locale: Locale; roundSeconds?: number; roundsPerTeam?: number; prompts?: readonly ActionPrompt[]; random?: () => number };

export function RapidFire({ locale, roundSeconds: initialSeconds = 60, roundsPerTeam = 1, prompts = RAPID_FIRE_PROMPTS, random = Math.random }: Props) {
  const [teams, setTeams] = useState<string[]>([]), [name, setName] = useState(""), [seconds, setSeconds] = useState(initialSeconds);
  const [screen, setScreen] = useState<"setup" | "round" | "final">("setup"), [turn, setTurn] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({}), [correct, setCorrect] = useState(0), [passed, setPassed] = useState(0), [expired, setExpired] = useState(false);
  const [drawState, setDrawState] = useState<{ prompt: ActionPrompt | null; deck: PromptDeck }>(
    () => drawPrompt(createPromptDeck(prompts, random)),
  );
  const advanceRef = useRef<HTMLButtonElement>(null);
  const t = locale === "ar"
    ? { title: "جهّزوا الإجابات السريعة", team: "اسم الفريق", add: "أضف فريقاً", remove: "حذف", start: "ابدأوا الإجابات السريعة", correct: "صحيح", pass: "تمرير", exhausted: "انتهت بطاقات الأسئلة", correctCount: "صحيحة", passed: "ممررة", summary: "ملخص الجولة", next: "الفريق التالي", final: "شاهدوا النتيجة النهائية", finalTitle: "النتيجة النهائية", wins: "يفوز!", duration: "مدة الجولة", sec: "ث" }
    : { title: "Set up Rapid Fire", team: "Team name", add: "Add team", remove: "Remove", start: "Start Rapid Fire", correct: "Correct", pass: "Pass", exhausted: "Prompt deck exhausted", correctCount: "correct", passed: "passed", summary: "Round summary", next: "Next team", final: "See final score", finalTitle: "Final score", wins: "wins!", duration: "Round length", sec: "sec" };
  const valid = validateSetup(normalizeSetupNames(teams).length, { min: 2, max: 12 }, locale);
  const totalTurns = teams.length * roundsPerTeam;
  const expire = useCallback(() => setExpired(true), []);
  useEffect(() => {
    if (expired) advanceRef.current?.focus();
  }, [expired]);
  const prompt = drawState.prompt;
  const advancePrompt = (outcome: "correct" | "pass") => {
    const team = teams[turn % teams.length];
    setScores(scoreRapidFire(scores, team, outcome));
    outcome === "correct" ? setCorrect(correct + 1) : setPassed(passed + 1);
    setDrawState((current) => current.deck.remaining.length
      ? drawPrompt(current.deck)
      : { prompt: null, deck: current.deck });
  };
  if (screen === "setup") return <SetupShell title={t.title}>
    <TeamNamesField label={t.team} names={teams} value={name} placeholder={t.team} addLabel={t.add} removeLabel={t.remove} max={12} onValueChange={setName} onAdd={() => { setTeams(normalizeSetupNames([...teams, name])); setName(""); }} onRemove={(i) => setTeams(teams.filter((_, x) => x !== i))} />
    <DurationSelector label={t.duration} value={seconds} options={[30, 60, 90]} unit={t.sec} onChange={setSeconds} />
    {!valid.valid && <p role="status" className="validationMessage">{valid.message}</p>}
    <button data-action="primary" className="primary" disabled={!valid.valid} onClick={() => { setScores(Object.fromEntries(teams.map((x) => [x, 0]))); setScreen("round"); }}>{t.start}</button>
  </SetupShell>;
  if (screen === "final") return <Final title={t.finalTitle} scores={scores} winner={Object.entries(scores).sort((a,b) => b[1]-a[1])[0]?.[0]} wins={t.wins} />;
  return <section className="panel actionGame"><p className="roundBadge">{teams[turn % teams.length]}</p><h1 className="actionPrompt">{prompt ? prompt.text[locale] : t.exhausted}</h1>
    <TimedRound locale={locale} seconds={seconds} resetKey={turn} onExpire={expire}>{(running) => <>
      <div className="roundActions"><button className="success" disabled={!running || !prompt} onClick={() => advancePrompt("correct")}>{t.correct}</button><button className="secondary" disabled={!running || !prompt} onClick={() => advancePrompt("pass")}>{t.pass}</button></div>
      <p className="roundSummary">{correct} {t.correctCount} · {passed} {t.passed}</p>
      {expired && <div className="roundEnd"><h2>{t.summary}</h2><button ref={advanceRef} className="primary" onClick={() => { if (turn + 1 >= totalTurns) setScreen("final"); else { setTurn(turn + 1); setCorrect(0); setPassed(0); setExpired(false); } }}>{turn + 1 >= totalTurns ? t.final : t.next}</button></div>}
    </>}</TimedRound>
  </section>;
}
