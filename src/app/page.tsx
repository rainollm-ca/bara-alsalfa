"use client";

import { useEffect, useState } from "react";

import { GameLibrary, readStoredLocale, syncDocumentLocale, writeStoredLocale } from "../components/GameLibrary";
import { TopBar } from "../components/TopBar";
import { OutOfLoop } from "../components/games/OutOfLoop";
import { CategoryChallenge } from "../components/games/CategoryChallenge";
import type { GameId, PlayMode } from "../games/types";
import type { Locale } from "../lib/game";
import { resolveGameView } from "../lib/ui-state";

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [mode, setMode] = useState<PlayMode>("local");
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  useEffect(() => {
    const storedLocale = readStoredLocale(window.localStorage);
    setLocale(storedLocale);
    syncDocumentLocale(storedLocale, document.documentElement);
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    writeStoredLocale(nextLocale, window.localStorage);
    syncDocumentLocale(nextLocale, document.documentElement);
  }

  const view = resolveGameView(activeGame, mode);

  return (
    <main className="shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <section className={activeGame === "category-challenge" ? "appCard challengeCard" : activeGame ? "appCard" : "appCard libraryCard"}>
        <TopBar
          locale={locale}
          onLocaleChange={changeLocale}
          onHome={() => setActiveGame(null)}
          showBack={activeGame !== null}
        />
        {view === "library" ? (
          <GameLibrary
            locale={locale}
            mode={mode}
            onModeChange={setMode}
            onChooseGame={setActiveGame}
          />
        ) : view === "out-of-loop" ? (
          <OutOfLoop locale={locale} />
        ) : view === "category-challenge" ? (
          <CategoryChallenge locale={locale} onExit={() => setActiveGame(null)} />
        ) : view === "room-unavailable" ? (
          <section className="comingSoon roomUnavailable">
            <span aria-hidden="true">🔗</span>
            <h1>{locale === "ar" ? "الغرف الجماعية قريباً" : "Group rooms are coming soon"}</h1>
            <p>{locale === "ar" ? "وضع الغرفة لن يشغّل لعبة الجهاز الواحد. اختاروا جهاز واحد للعب الآن." : "Room mode will never start one-device gameplay. Choose One device to play now."}</p>
          </section>
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
