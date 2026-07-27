"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DurationSelector, SetupShell, TeamNamesField, normalizeSetupNames, validateSetup } from "../SetupShell";
import { FORBIDDEN_WORD_PROMPTS, type ForbiddenWordPrompt } from "../../games/content/actionGames";
import { createPromptDeck, drawPrompt, recordForbiddenWordViolation, type PromptDeck } from "../../games/engines/actionGames";
import type { Locale } from "../../lib/game";
import { Final } from "./Charades";
import { TimedRound } from "./TimedRound";

type Props = { locale: Locale; roundSeconds?: number; roundsPerTeam?: number; prompts?: readonly ForbiddenWordPrompt[]; random?: () => number };

export function ForbiddenWord({ locale, roundSeconds: initialSeconds = 60, roundsPerTeam = 2, prompts = FORBIDDEN_WORD_PROMPTS, random = Math.random }: Props) {
  const [teams, setTeams] = useState<string[]>([]), [name, setName] = useState("");
  const [seconds, setSeconds] = useState(initialSeconds), [screen, setScreen] = useState<"setup" | "round" | "final">("setup");
  const [turn, setTurn] = useState(0), [scores, setScores] = useState<Record<string, number>>({});
  const [drawState, setDrawState] = useState<{ prompt: ForbiddenWordPrompt | null; deck: PromptDeck }>(
    () => drawPrompt(createPromptDeck(prompts, random)) as { prompt: ForbiddenWordPrompt; deck: PromptDeck },
  );
  const [points, setPoints] = useState(0), [violations, setViolations] = useState(0), [expired, setExpired] = useState(false);
  const advanceRef = useRef<HTMLButtonElement>(null);
  const t = locale === "ar"
    ? { title: "جهّزوا الكلمة الممنوعة", team: "اسم الفريق", add: "أضف فريقاً", remove: "حذف", start: "ابدأوا الكلمة الممنوعة", forbidden: "ممنوع قول", correct: "صحيح", violation: "مخالفة", exhausted: "انتهت بطاقات الكلمات", points: "نقطة في هذه الجولة", violations: "مخالفة", next: "الفريق التالي", final: "شاهدوا النتيجة النهائية", finalTitle: "النتيجة النهائية", wins: "يفوز!", duration: "مدة الجولة", sec: "ث" }
    : { title: "Set up Forbidden Word", team: "Team name", add: "Add team", remove: "Remove", start: "Start Forbidden Word", forbidden: "Do not say", correct: "Correct", violation: "Violation", exhausted: "Prompt deck exhausted", points: "point this round", violations: "violation", next: "Next team", final: "See final score", finalTitle: "Final score", wins: "wins!", duration: "Round length", sec: "sec" };
  const valid = validateSetup(normalizeSetupNames(teams).length * 2, { min: 4, max: 16 }, locale);
  const totalTurns = teams.length * roundsPerTeam;
  const nextPrompt = () => {
    setDrawState((current) => current.deck.remaining.length
      ? drawPrompt(current.deck) as { prompt: ForbiddenWordPrompt; deck: PromptDeck }
      : { prompt: null, deck: current.deck });
  };
  const expire = useCallback(() => setExpired(true), []);
  useEffect(() => {
    if (expired) advanceRef.current?.focus();
  }, [expired]);
  if (screen === "setup") return <SetupShell title={t.title}>
    <TeamNamesField label={t.team} names={teams} value={name} placeholder={t.team} addLabel={t.add} removeLabel={t.remove} max={8} onValueChange={setName} onAdd={() => { setTeams(normalizeSetupNames([...teams, name])); setName(""); }} onRemove={(i) => setTeams(teams.filter((_, x) => x !== i))} />
    <DurationSelector label={t.duration} value={seconds} options={[30, 60, 90]} unit={t.sec} onChange={setSeconds} />
    {!valid.valid && <p role="status" className="validationMessage">{valid.message}</p>}
    <button className="primary" disabled={!valid.valid} onClick={() => { setScores(Object.fromEntries(teams.map((x) => [x, 0]))); setScreen("round"); }}>{t.start}</button>
  </SetupShell>;
  if (screen === "final") return <Final title={t.finalTitle} scores={scores} winner={Object.entries(scores).sort((a,b) => b[1]-a[1])[0]?.[0]} wins={t.wins} />;
  const prompt = drawState.prompt;
  const forbidden = prompt?.forbidden ?? [];
  return <section className="panel actionGame">
    <p className="roundBadge">{teams[turn % teams.length]}</p><h1 className="actionPrompt">{prompt ? prompt.text[locale] : t.exhausted}</h1>
    <p>{t.forbidden}</p><div className="forbiddenWords">{forbidden.map((word) => <span key={word.en}>{word[locale]}</span>)}</div>
    <TimedRound locale={locale} seconds={seconds} resetKey={turn} onExpire={expire}>{(running) => <>
      <div className="roundActions">
        <button className="success" disabled={!running || !prompt} onClick={() => { setPoints(points + 1); nextPrompt(); }}>{t.correct}</button>
        <button className="danger" disabled={!running || !prompt} onClick={() => { const round = recordForbiddenWordViolation({ violations, valid: true }); setViolations(round.violations); setPoints(Math.max(0, points - 1)); nextPrompt(); }}>{t.violation}</button>
      </div>
      <p className="roundSummary">{points} {t.points} · {violations} {t.violations}</p>
      {expired && <button ref={advanceRef} className="primary" onClick={() => {
        const team = teams[turn % teams.length];
        setScores((current) => ({ ...current, [team]: current[team] + points }));
        if (turn + 1 >= totalTurns) setScreen("final");
        else { setTurn(turn + 1); setPoints(0); setViolations(0); setExpired(false); }
      }}>{turn + 1 >= totalTurns ? t.final : t.next}</button>}
    </>}</TimedRound>
  </section>;
}
