"use client";

import { useEffect, useRef, useState } from "react";
import { PlayerNamesField, SetupShell, normalizeSetupNames, validateSetup } from "../SetupShell";
import { WHO_AM_I_PROMPTS, type ActionPrompt } from "../../games/content/actionGames";
import { assignPrivateIdentities } from "../../games/engines/actionGames";
import type { Locale } from "../../lib/game";

type Props = { locale: Locale; prompts?: readonly ActionPrompt[]; random?: () => number };

export function WhoAmI({ locale, prompts = WHO_AM_I_PROMPTS, random = Math.random }: Props) {
  const [players, setPlayers] = useState<string[]>([]), [name, setName] = useState("");
  const [identities, setIdentities] = useState<ReturnType<typeof assignPrivateIdentities>>({});
  const [index, setIndex] = useState(0), [revealed, setRevealed] = useState(false), [playing, setPlaying] = useState(false);
  const revealRef = useRef<HTMLHeadingElement>(null);
  const revealButtonRef = useRef<HTMLButtonElement>(null);
  const t = locale === "ar"
    ? { title: "جهّزوا من أنا؟", player: "اسم اللاعب", add: "أضف لاعباً", remove: "حذف", assign: "وزّع الشخصيات", pass: "ناولوا الجهاز إلى", viewer: "شاهد شخصيات اللاعبين الآخرين", private: "كل لاعب يرى شخصيات الآخرين فقط، ولا يرى شخصيته", reveal: "اكشف الشخصيات", hide: "أخفِ ومرّر", begin: "ابدأوا التخمين", ready: "هل الجميع مستعد؟", readyHint: "ابدؤوا بأسئلة نعم أو لا من دون كشف أي شخصية لصاحبها." }
    : { title: "Set up Who Am I?", player: "Player name", add: "Add player", remove: "Remove", assign: "Assign identities", pass: "Pass the device to", viewer: "look at everyone else's identities", private: "Each player sees everyone else's identities, never their own", reveal: "Reveal identities", hide: "Hide and pass", begin: "Begin guessing", ready: "Everyone ready?", readyHint: "Start asking yes-or-no questions without revealing anyone's identity to its owner." };
  const valid = validateSetup(normalizeSetupNames(players).length, { min: 2, max: 12 }, locale);
  useEffect(() => {
    if (Object.keys(identities).length && !revealed && !playing) revealButtonRef.current?.focus();
  }, [identities, index, playing, revealed]);
  if (playing) return <section className="panel identityPlay"><h1>{t.ready}</h1><p>{t.readyHint}</p><div className="identityRoster">{players.map((player) => <span key={player}>{player}</span>)}</div></section>;
  if (!Object.keys(identities).length) return <SetupShell title={t.title}>
    <PlayerNamesField label={t.player} names={players} value={name} placeholder={t.player} addLabel={t.add} removeLabel={t.remove} max={12} onValueChange={setName} onAdd={() => { setPlayers(normalizeSetupNames([...players, name])); setName(""); }} onRemove={(i) => setPlayers(players.filter((_, x) => x !== i))} />
    {!valid.valid && <p role="status" className="validationMessage">{valid.message}</p>}
    <button className="primary" disabled={!valid.valid} onClick={() => setIdentities(assignPrivateIdentities(players, prompts, random))}>{t.assign}</button>
  </SetupShell>;
  const viewer = players[index];
  const visiblePlayers = players.filter((player) => player !== viewer);
  return <section className="panel privateReveal">
    <p className="privacy">{t.private}</p><h1>{t.pass} {viewer}</h1>
    <p>{viewer}: {t.viewer}</p>
    {!revealed ? <button ref={revealButtonRef} className="secretCard" onClick={() => { setRevealed(true); queueMicrotask(() => revealRef.current?.focus()); }}>{t.reveal}</button> : <>
      <div className="identityCard" data-testid="private-identity">
        {visiblePlayers.map((player, visibleIndex) => (
          <div key={player}>
            <span>{player}</span>
            <h2 ref={visibleIndex === 0 ? revealRef : undefined} tabIndex={visibleIndex === 0 ? -1 : undefined}>{identities[player].text[locale]}</h2>
          </div>
        ))}
      </div>
      <button className="primary" onClick={() => { if (index === players.length - 1) setPlaying(true); else { setIndex(index + 1); setRevealed(false); } }}>{index === players.length - 1 ? t.begin : t.hide}</button>
    </>}
  </section>;
}
