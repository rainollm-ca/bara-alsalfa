"use client";

import { useEffect, useRef, useState } from "react";
import { createTwoTruthsRound, projectTwoTruthsRound, revealTwoTruthsLie, tallyVotes, type TwoTruthsSecretRound } from "../../games/engines/socialGames";
import type { Locale } from "../../games/types";
import { PlayerNamesField, SetupShell, validateSetup } from "../SetupShell";
import { isStringList, isSafeInteger, isTwoTruthsRound, useGameSessionState } from "../../lib/useGameSessionState";

type Phase = "setup" | "entry-pass" | "entry" | "round-pass" | "vote" | "reveal";
const copy = {
  en: { title: "Two Truths and a Lie", hint: "Each person secretly creates a round", placeholder: "Add a player name", add: "Add player", remove: "Remove", enter: "Enter statements", pass: "Pass the device to", entryReady: "Ready to enter privately", statement: "Statement", lie: "is the lie", save: "Save secret statements", readyVote: "Ready to vote privately", lock: "Lock vote", reveal: "Reveal the lie", correct: "Correct guesses", next: "Next storyteller" },
  ar: { title: "حقيقتان وكذبة", hint: "كل شخص يجهّز جولته بسرية", placeholder: "أضف اسم لاعب", add: "إضافة لاعب", remove: "حذف", enter: "أدخل الجمل", pass: "مرّر الجهاز إلى", entryReady: "جاهز للإدخال بسرية", statement: "الجملة", lie: "هي الكذبة", save: "احفظ الجمل السرية", readyVote: "جاهز للتصويت بسرية", lock: "ثبّت التصويت", reveal: "اكشف الكذبة", correct: "التخمينات الصحيحة", next: "الراوي التالي" },
} as const;

export function TwoTruthsLie({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [players, setPlayers] = useGameSessionState("two-truths-lie", locale, "players", [], isStringList);
  const [name, setName] = useState("");
  const [phase, setPhase] = useGameSessionState<Phase>("two-truths-lie", locale, "phase", "setup", (value): value is Phase => ["setup", "entry-pass", "entry", "round-pass", "vote", "reveal"].includes(String(value)), (value) => value === "entry" ? "entry-pass" : value === "vote" ? "round-pass" : value);
  const [storyteller, setStoryteller] = useGameSessionState("two-truths-lie", locale, "storyteller", 0, isSafeInteger(0, 11));
  const [statements, setStatements] = useGameSessionState("two-truths-lie", locale, "statements", ["", "", ""], (value): value is string[] => isStringList(value) && value.length === 3);
  const [lie, setLie] = useGameSessionState<0 | 1 | 2>("two-truths-lie", locale, "lie", 0, (value): value is 0 | 1 | 2 => value === 0 || value === 1 || value === 2);
  const [round, setRound] = useGameSessionState<TwoTruthsSecretRound | null>("two-truths-lie", locale, "round", null, (value): value is TwoTruthsSecretRound | null => value === null || isTwoTruthsRound(value));
  const [voters, setVoters] = useGameSessionState("two-truths-lie", locale, "voters", [], isStringList);
  const [voter, setVoter] = useGameSessionState("two-truths-lie", locale, "voter", 0, isSafeInteger(0, 11));
  const [choice, setChoice] = useGameSessionState<number | null>("two-truths-lie", locale, "choice", null, (value): value is number | null => value === null || [0, 1, 2].includes(Number(value)), () => null);
  const [votes, setVotes] = useGameSessionState<number[]>("two-truths-lie", locale, "votes", [], (value): value is number[] => Array.isArray(value) && value.length <= 11 && value.every((item) => [0, 1, 2].includes(item)));
  const firstVoteRef = useRef<HTMLButtonElement>(null);
  const revealButtonRef = useRef<HTMLButtonElement>(null);
  const revealHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === "vote") firstVoteRef.current?.focus();
    if (phase === "reveal") {
      if (round?.revealed) revealHeadingRef.current?.focus();
      else revealButtonRef.current?.focus();
    }
  }, [phase, round?.revealed]);
  const valid = validateSetup(players.length, { min: 3, max: 12 }, locale);
  const normalized = statements.map((value) => value.trim().toLocaleLowerCase());
  const statementsValid = normalized.every(Boolean) && new Set(normalized).size === 3;
  function add() { const clean = name.trim(); if (clean && !players.includes(clean)) setPlayers([...players, clean]); setName(""); }
  function saveRound() {
    const created = createTwoTruthsRound(players[storyteller], statements as [string, string, string], lie);
    setRound(created);
    setVoters(players.filter((_, index) => index !== storyteller));
    setVoter(0); setVotes([]); setChoice(null); setPhase("round-pass");
  }
  function lockVote() {
    const next = [...votes, choice!]; setVotes(next); setChoice(null);
    if (voter + 1 === voters.length) setPhase("reveal");
    else { setVoter(voter + 1); setPhase("round-pass"); }
  }
  const view = round ? projectTwoTruthsRound(round) : null;
  return <section className="panel play">
    {phase === "setup" && <SetupShell title={t.title} hint={t.hint}><PlayerNamesField label={t.title} hint={t.hint} names={players} value={name} placeholder={t.placeholder} addLabel={t.add} removeLabel={t.remove} max={12} onValueChange={setName} onAdd={add} onRemove={(index) => setPlayers(players.filter((_, i) => i !== index))} />{!valid.valid && <p role="status" className="validationMessage">{valid.message}</p>}<button data-action="primary" className="primary" disabled={!valid.valid} onClick={() => setPhase("entry-pass")}>{t.enter}</button></SetupShell>}
    {phase === "entry-pass" && <div className="reveal"><h2>{t.pass}</h2><div className="bigName">{players[storyteller]}</div><button autoFocus className="primary" onClick={() => setPhase("entry")}>{t.entryReady}</button></div>}
    {phase === "entry" && <div><h2>{players[storyteller]}</h2>{statements.map((value, index) => <div key={index}><input aria-label={`${t.statement} ${index + 1}`} placeholder={`${t.statement} ${index + 1}`} value={value} onChange={(event) => setStatements(statements.map((item, i) => i === index ? event.target.value : item))} /><label><input type="radio" name="lie" aria-label={`${t.statement} ${index + 1} ${t.lie}`} checked={lie === index} onChange={() => setLie(index as 0 | 1 | 2)} /> {t.lie}</label></div>)}<button className="primary" disabled={!statementsValid} onClick={saveRound}>{t.save}</button></div>}
    {phase === "round-pass" && <div className="reveal"><h2>{t.pass}</h2><div className="bigName">{voters[voter]}</div><button autoFocus className="primary" onClick={() => setPhase("vote")}>{t.readyVote}</button></div>}
    {phase === "vote" && view && <div><div className="suspects">{view.statements.map((statement, index) => <button ref={index === 0 ? firstVoteRef : undefined} key={statement} className={choice === index ? "selected" : ""} onClick={() => setChoice(index)}>{statement}</button>)}</div><button className="primary" disabled={choice === null} onClick={lockVote}>{t.lock}</button></div>}
    {phase === "reveal" && round && <div className="result" aria-live="polite">{!round.revealed ? <button ref={revealButtonRef} className="primary" onClick={() => setRound(revealTwoTruthsLie(round))}>{t.reveal}</button> : <><h2 ref={revealHeadingRef} tabIndex={-1}>{round.statements[round.lieIndex]}</h2><p>{t.correct}: {tallyVotes(votes.map(String)).counts[String(round.lieIndex)] ?? 0}</p><button onClick={() => { setStoryteller((storyteller + 1) % players.length); setStatements(["", "", ""]); setRound(null); setPhase("entry-pass"); }}>{t.next}</button></>}</div>}
  </section>;
}
