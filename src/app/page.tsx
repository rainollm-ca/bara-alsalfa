"use client";

import { useEffect, useState } from "react";

import { GameLibrary, readStoredLocale, syncDocumentLocale, writeStoredLocale } from "../components/GameLibrary";
import { TopBar } from "../components/TopBar";
import { RoomLobby } from "../components/RoomLobby";
import { OutOfLoop } from "../components/games/OutOfLoop";
import { CategoryChallenge } from "../components/games/CategoryChallenge";
import { Charades } from "../components/games/Charades";
import { ForbiddenWord } from "../components/games/ForbiddenWord";
import { RapidFire } from "../components/games/RapidFire";
import { WhoAmI } from "../components/games/WhoAmI";
import { MostLikelyTo } from "../components/games/MostLikelyTo";
import { TwoTruthsLie } from "../components/games/TwoTruthsLie";
import type { GameId, PlayMode } from "../games/types";
import type { Locale } from "../lib/game";
import { resolveGameView } from "../lib/ui-state";
import { readInviteCode } from "../lib/invite";
import { PwaStatus } from "../components/PwaStatus";
import {
  discardSavedSession,
  parseSavedSession,
  serializeSavedSession,
  SESSION_KEY,
  type SavedLocalSession,
} from "../lib/session";

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [mode, setMode] = useState<PlayMode>("local");
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<SavedLocalSession | null>(null);

  useEffect(() => {
    const storedLocale = readStoredLocale(window.localStorage);
    setLocale(storedLocale);
    syncDocumentLocale(storedLocale, document.documentElement);
    const invited = readInviteCode(window.location.search);
    if (invited) {
      setMode("room");
      setInviteCode(invited);
    } else {
      setSavedSession(parseSavedSession(window.localStorage.getItem(SESSION_KEY)));
    }
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    writeStoredLocale(nextLocale, window.localStorage);
    syncDocumentLocale(nextLocale, document.documentElement);
  }

  const view = resolveGameView(activeGame, mode);

  function chooseGame(gameId: GameId) {
    setActiveGame(gameId);
    if (mode === "local") {
      window.localStorage.setItem(SESSION_KEY, serializeSavedSession({
        gameId,
        locale,
        updatedAt: Date.now(),
        controller: { phase: "entry" },
      }));
    }
  }

  function startNew() {
    discardSavedSession(window.localStorage);
    setSavedSession(null);
  }

  return (
    <main className="shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <PwaStatus locale={locale} roomMode={mode === "room" || Boolean(inviteCode)} />
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <section className={activeGame === "category-challenge" ? "appCard challengeCard" : activeGame ? "appCard" : "appCard libraryCard"}>
        <TopBar
          locale={locale}
          onLocaleChange={changeLocale}
          onHome={() => {
            setActiveGame(null);
            setInviteCode(null);
            window.history.replaceState(null, "", window.location.pathname);
          }}
          showBack={activeGame !== null || inviteCode !== null}
        />
        {savedSession && !activeGame && !inviteCode ? (
          <section className="resumeSession" role="dialog" aria-labelledby="resume-title">
            <span aria-hidden="true">↩️</span>
            <h1 id="resume-title">{locale === "ar" ? "لديكم لعبة محفوظة" : "You have a saved game"}</h1>
            <p>{locale === "ar" ? "استأنفوا من شاشة آمنة أو ابدأوا لعبة جديدة." : "Resume from a privacy-safe screen or start a new game."}</p>
            <button data-action="primary" className="primaryButton" onClick={() => {
              setLocale(savedSession.locale);
              syncDocumentLocale(savedSession.locale, document.documentElement);
              setMode("local");
              setActiveGame(savedSession.gameId);
              setSavedSession(null);
            }}>{locale === "ar" ? "استئناف" : "Resume"}</button>
            <button className="ghostButton" onClick={startNew}>{locale === "ar" ? "لعبة جديدة" : "New game"}</button>
          </section>
        ) : inviteCode ? (
          <RoomLobby
            locale={locale}
            initialCode={inviteCode}
            onExit={() => {
              setInviteCode(null);
              setActiveGame(null);
              window.history.replaceState(null, "", window.location.pathname);
            }}
          />
        ) : view === "library" ? (
          <GameLibrary
            locale={locale}
            mode={mode}
            onModeChange={setMode}
            onChooseGame={chooseGame}
          />
        ) : view === "out-of-loop" ? (
          <OutOfLoop locale={locale} />
        ) : view === "category-challenge" ? (
          <CategoryChallenge locale={locale} onExit={() => setActiveGame(null)} />
        ) : view === "charades" ? (
          <Charades locale={locale} />
        ) : view === "forbidden-word" ? (
          <ForbiddenWord locale={locale} />
        ) : view === "who-am-i" ? (
          <WhoAmI locale={locale} />
        ) : view === "rapid-fire" ? (
          <RapidFire locale={locale} />
        ) : view === "most-likely-to" ? (
          <MostLikelyTo locale={locale} />
        ) : view === "two-truths-lie" ? (
          <TwoTruthsLie locale={locale} />
        ) : view === "room-lobby" && activeGame ? (
          <RoomLobby locale={locale} gameId={activeGame} onExit={() => setActiveGame(null)} />
        ) : (
          <section className="comingSoon">
            <span aria-hidden="true">🎲</span>
            <h1>{locale === "ar" ? "قريباً في هذه السهرة" : "Joining game night soon"}</h1>
            <p>{locale === "ar" ? "ارجعوا واختاروا برا السالفة للعب الآن." : "Head back and choose Out of the Loop to play now."}</p>
          </section>
        )}
      </section>
    </main>
  );
}
