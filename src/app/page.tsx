"use client";

import { useEffect, useState } from "react";

import { GameLibrary, readStoredLocale, writeStoredLocale } from "../components/GameLibrary";
import { TopBar } from "../components/TopBar";
import { OutOfLoop } from "../components/games/OutOfLoop";
import type { GameId, PlayMode } from "../games/types";
import type { Locale } from "../lib/game";
import { resolveGameView } from "../lib/ui-state";

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [mode, setMode] = useState<PlayMode>("local");
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  useEffect(() => setLocale(readStoredLocale(window.localStorage)), []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    writeStoredLocale(nextLocale, window.localStorage);
  }

  const view = resolveGameView(activeGame);

  return (
    <main className="shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <section className={activeGame ? "appCard" : "appCard libraryCard"}>
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
