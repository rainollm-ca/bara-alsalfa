"use client";

import { useRef, useState } from "react";
import { PlayerNamesField, SetupShell, normalizeSetupNames, validateSetup } from "../SetupShell";
import { WHO_AM_I_PROMPTS } from "../../games/content/actionGames";
import { assignPrivateIdentities } from "../../games/engines/actionGames";
import type { Locale } from "../../lib/game";

export function WhoAmI({ locale }: { locale: Locale }) {
  const [players, setPlayers] = useState<string[]>([]), [name, setName] = useState("");
  const [identities, setIdentities] = useState<ReturnType<typeof assignPrivateIdentities>>({});
  const [index, setIndex] = useState(0), [revealed, setRevealed] = useState(false), [playing, setPlaying] = useState(false);
  const revealRef = useRef<HTMLHeadingElement>(null);
  const t = locale === "ar"
    ? { title: "جهّزوا من أنا؟", player: "اسم اللاعب", add: "أضف لاعباً", remove: "حذف", assign: "وزّع الشخصيات", pass: "ناولوا الجهاز إلى", private: "لا تكشف الشاشة حتى يصبح اللاعب وحده", reveal: "اكشف الشخصية", hide: "أخفِ ومرّر", begin: "ابدأوا التخمين", ready: "هل الجميع مستعد؟", readyHint: "ضع الجهاز بحيث يرى الجميع شخصية اللاعب ما عدا اللاعب نفسه." }
    : { title: "Set up Who Am I?", player: "Player name", add: "Add player", remove: "Remove", assign: "Assign identities", pass: "Pass the device to", private: "Keep the screen hidden until this player is alone", reveal: "Reveal identity", hide: "Hide and pass", begin: "Begin guessing", ready: "Everyone ready?", readyHint: "Hold the device so everyone except the current player can see the identity." };
  const valid = validateSetup(normalizeSetupNames(players).length, { min: 2, max: 12 }, locale);
  if (playing) return <section className="panel identityPlay"><h1>{t.ready}</h1><p>{t.readyHint}</p><div className="identityRoster">{players.map((player) => <span key={player}>{player}</span>)}</div></section>;
  if (!Object.keys(identities).length) return <SetupShell title={t.title}>
    <PlayerNamesField label={t.player} names={players} value={name} placeholder={t.player} addLabel={t.add} removeLabel={t.remove} max={12} onValueChange={setName} onAdd={() => { setPlayers(normalizeSetupNames([...players, name])); setName(""); }} onRemove={(i) => setPlayers(players.filter((_, x) => x !== i))} />
    {!valid.valid && <p role="status" className="validationMessage">{valid.message}</p>}
    <button className="primary" disabled={!valid.valid} onClick={() => setIdentities(assignPrivateIdentities(players, WHO_AM_I_PROMPTS))}>{t.assign}</button>
  </SetupShell>;
  const player = players[index], identity = identities[player];
  return <section className="panel privateReveal">
    <p className="privacy">{t.private}</p><h1>{t.pass} {player}</h1>
    {!revealed ? <button className="secretCard" onClick={() => { setRevealed(true); queueMicrotask(() => revealRef.current?.focus()); }}>{t.reveal}</button> : <>
      <div className="identityCard" data-testid="private-identity"><h2 ref={revealRef} tabIndex={-1}>{identity.text[locale]}</h2></div>
      <button className="primary" onClick={() => { if (index === players.length - 1) setPlaying(true); else { setIndex(index + 1); setRevealed(false); } }}>{index === players.length - 1 ? t.begin : t.hide}</button>
    </>}
  </section>;
}
