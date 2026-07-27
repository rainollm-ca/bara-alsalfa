"use client";

import { useCallback, useState } from "react";
import { DurationSelector, SetupShell, TeamNamesField, normalizeSetupNames, validateSetup } from "../SetupShell";
import { FORBIDDEN_WORD_PROMPTS } from "../../games/content/actionGames";
import { createPromptDeck, drawPrompt, recordForbiddenWordViolation } from "../../games/engines/actionGames";
import type { Locale } from "../../lib/game";
import { Final } from "./Charades";
import { TimedRound } from "./TimedRound";

type Props = { locale: Locale; roundSeconds?: number; roundsPerTeam?: number };

export function ForbiddenWord({ locale, roundSeconds: initialSeconds = 60, roundsPerTeam = 2 }: Props) {
  const [teams, setTeams] = useState<string[]>([]), [name, setName] = useState("");
  const [seconds, setSeconds] = useState(initialSeconds), [screen, setScreen] = useState<"setup" | "round" | "final">("setup");
  const [turn, setTurn] = useState(0), [scores, setScores] = useState<Record<string, number>>({});
  const [deck, setDeck] = useState(() => createPromptDeck(FORBIDDEN_WORD_PROMPTS));
  const [prompt, setPrompt] = useState(() => drawPrompt(createPromptDeck(FORBIDDEN_WORD_PROMPTS)).prompt);
  const [points, setPoints] = useState(0), [violations, setViolations] = useState(0), [expired, setExpired] = useState(false);
  const t = locale === "ar"
    ? { title: "جهّزوا الكلمة الممنوعة", team: "اسم الفريق", add: "أضف فريقاً", remove: "حذف", start: "ابدأوا الكلمة الممنوعة", forbidden: "ممنوع قول", correct: "صحيح", violation: "مخالفة", points: "نقطة في هذه الجولة", violations: "مخالفة", next: "الفريق التالي", final: "شاهدوا النتيجة النهائية", finalTitle: "النتيجة النهائية", wins: "يفوز!", duration: "مدة الجولة", sec: "ث" }
    : { title: "Set up Forbidden Word", team: "Team name", add: "Add team", remove: "Remove", start: "Start Forbidden Word", forbidden: "Do not say", correct: "Correct", violation: "Violation", points: "point this round", violations: "violation", next: "Next team", final: "See final score", finalTitle: "Final score", wins: "wins!", duration: "Round length", sec: "sec" };
  const valid = validateSetup(normalizeSetupNames(teams).length * 2, { min: 4, max: 16 }, locale);
  const totalTurns = teams.length * roundsPerTeam;
  const nextPrompt = () => {
    const draw = drawPrompt(deck.remaining.length ? deck : createPromptDeck(FORBIDDEN_WORD_PROMPTS));
    setDeck(draw.deck); setPrompt(draw.prompt);
  };
  const expire = useCallback(() => setExpired(true), []);
  if (screen === "setup") return <SetupShell title={t.title}>
    <TeamNamesField label={t.team} names={teams} value={name} placeholder={t.team} addLabel={t.add} removeLabel={t.remove} max={8} onValueChange={setName} onAdd={() => { setTeams(normalizeSetupNames([...teams, name])); setName(""); }} onRemove={(i) => setTeams(teams.filter((_, x) => x !== i))} />
    <DurationSelector label={t.duration} value={seconds} options={[30, 60, 90]} unit={t.sec} onChange={setSeconds} />
    {!valid.valid && <p role="status" className="validationMessage">{valid.message}</p>}
    <button className="primary" disabled={!valid.valid} onClick={() => { setScores(Object.fromEntries(teams.map((x) => [x, 0]))); setScreen("round"); }}>{t.start}</button>
  </SetupShell>;
  if (screen === "final") return <Final title={t.finalTitle} scores={scores} winner={Object.entries(scores).sort((a,b) => b[1]-a[1])[0]?.[0]} wins={t.wins} />;
  const forbidden = "forbidden" in prompt ? prompt.forbidden : [];
  return <section className="panel actionGame">
    <p className="roundBadge">{teams[turn % teams.length]}</p><h1 className="actionPrompt">{prompt.text[locale]}</h1>
    <p>{t.forbidden}</p><div className="forbiddenWords">{forbidden.map((word) => <span key={word.en}>{word[locale]}</span>)}</div>
    <TimedRound locale={locale} seconds={seconds} resetKey={turn} onExpire={expire}>{(running) => <>
      <div className="roundActions">
        <button className="success" disabled={!running} onClick={() => { setPoints(points + 1); setScores({ ...scores, [teams[turn % teams.length]]: scores[teams[turn % teams.length]] + 1 }); nextPrompt(); }}>{t.correct}</button>
        <button className="danger" disabled={!running} onClick={() => { const round = recordForbiddenWordViolation({ violations, valid: true }); setViolations(round.violations); setPoints(Math.max(0, points - 1)); setScores({ ...scores, [teams[turn % teams.length]]: Math.max(0, scores[teams[turn % teams.length]] - 1) }); nextPrompt(); }}>{t.violation}</button>
      </div>
      <p className="roundSummary">{points} {t.points} · {violations} {t.violations}</p>
      {expired && <button className="primary" onClick={() => { if (turn + 1 >= totalTurns) setScreen("final"); else { setTurn(turn + 1); setPoints(0); setViolations(0); setExpired(false); } }}>{turn + 1 >= totalTurns ? t.final : t.next}</button>}
    </>}</TimedRound>
  </section>;
}
