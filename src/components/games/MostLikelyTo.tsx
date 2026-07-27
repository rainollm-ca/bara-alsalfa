"use client";

import { useEffect, useRef, useState } from "react";
import { MOST_LIKELY_TO_PROMPTS } from "../../games/content/socialGames";
import { tallyVotes } from "../../games/engines/socialGames";
import type { Locale } from "../../games/types";
import { PlayerNamesField, SetupShell, validateSetup } from "../SetupShell";
import { isShortString, isStringList, isSafeInteger, useGameSessionState } from "../../lib/useGameSessionState";

type Phase = "setup" | "pass" | "vote" | "result";
const words = {
  en: { title: "Most Likely To", hint: "Add everyone playing", placeholder: "Add a player name", add: "Add player", remove: "Remove", start: "Start voting", pass: "Pass the device to", private: "No earlier votes will be shown.", ready: "Ready, vote privately", lock: "Lock vote", tie: "It’s a tie", three: "Three-way tie!", winner: "Most likely:", again: "Next prompt" },
  ar: { title: "مين الأكثر احتمالاً؟", hint: "أضيفوا كل اللاعبين", placeholder: "أضف اسم لاعب", add: "إضافة لاعب", remove: "حذف", start: "ابدأ التصويت", pass: "مرّر الجهاز إلى", private: "لن تظهر أي أصوات سابقة.", ready: "جاهز، صوّت بسرية", lock: "ثبّت التصويت", tie: "تعادل!", three: "تعادل ثلاثي!", winner: "الأكثر احتمالاً:", again: "سؤال جديد" },
} as const;

export function MostLikelyTo({ locale }: { locale: Locale }) {
  const t = words[locale];
  const [players, setPlayers] = useGameSessionState("most-likely-to", locale, "players", [], isStringList);
  const [name, setName] = useState("");
  const [phase, setPhase] = useGameSessionState<Phase>("most-likely-to", locale, "phase", "setup", (value): value is Phase => ["setup", "pass", "vote", "result"].includes(String(value)), (value) => value === "vote" ? "pass" : value);
  const [voter, setVoter] = useGameSessionState("most-likely-to", locale, "voter", 0, isSafeInteger(0, 15));
  const [choice, setChoice] = useGameSessionState("most-likely-to", locale, "choice", "", isShortString, () => "");
  const [votes, setVotes] = useGameSessionState("most-likely-to", locale, "votes", [], isStringList);
  const [promptIndex, setPromptIndex] = useGameSessionState("most-likely-to", locale, "promptIndex", 0, isSafeInteger(0, MOST_LIKELY_TO_PROMPTS.length - 1));
  const voteHeadingRef = useRef<HTMLParagraphElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === "vote") voteHeadingRef.current?.focus();
    if (phase === "result") resultHeadingRef.current?.focus();
  }, [phase]);
  const valid = validateSetup(players.length, { min: 3, max: 16 }, locale);
  function add() {
    const clean = name.trim();
    if (clean && !players.includes(clean) && players.length < 16) setPlayers([...players, clean]);
    setName("");
  }
  function lock() {
    const next = [...votes, choice];
    setChoice("");
    setVotes(next);
    if (voter + 1 === players.length) setPhase("result");
    else { setVoter(voter + 1); setPhase("pass"); }
  }
  const result = tallyVotes(votes);
  return <section className="panel play">
    {phase === "setup" && <SetupShell title={t.title} hint={t.hint}>
      <PlayerNamesField label={t.title} hint={t.hint} names={players} value={name} placeholder={t.placeholder} addLabel={t.add} removeLabel={t.remove} max={16} onValueChange={setName} onAdd={add} onRemove={(index) => setPlayers(players.filter((_, i) => i !== index))} />
      {!valid.valid && <p role="status" className="validationMessage">{valid.message}</p>}
      <button data-action="primary" className="primary" disabled={!valid.valid} onClick={() => setPhase("pass")}>{t.start}</button>
    </SetupShell>}
    {phase === "pass" && <div className="reveal"><h2>{t.pass}</h2><div className="bigName">{players[voter]}</div><p>{t.private}</p><button autoFocus className="primary" onClick={() => setPhase("vote")}>{t.ready}</button></div>}
    {phase === "vote" && <div><p ref={voteHeadingRef} tabIndex={-1} className="eyebrow">{MOST_LIKELY_TO_PROMPTS[promptIndex].text[locale]}</p><div className="suspects">{players.map((player) => <button key={player} className={choice === player ? "selected" : ""} onClick={() => setChoice(player)}>{player}</button>)}</div><button className="primary" disabled={!choice} onClick={lock}>{t.lock}</button></div>}
    {phase === "result" && <div className="result" aria-live="polite"><h2 ref={resultHeadingRef} tabIndex={-1}>{result.isTie ? (result.winners.length === 3 ? t.three : t.tie) : t.winner}</h2><div className="bigName">{result.winners.join(" · ")}</div><button className="primary" onClick={() => { setVotes([]); setVoter(0); setPromptIndex((promptIndex + 1) % MOST_LIKELY_TO_PROMPTS.length); setPhase("pass"); }}>{t.again}</button></div>}
  </section>;
}
