"use client";

import { Clock3, Gamepad2, Users } from "lucide-react";

import { GAME_CATALOG } from "../games/catalog";
import type { GameDefinition, GameId, PlayMode } from "../games/types";
import type { Locale } from "../lib/game";

const LOCALE_KEY = "lamma-locale";
const LEGACY_LOCALE_KEY = "bara-locale";

const libraryCopy = {
  ar: {
    eyebrow: "لمّة واحدة، حكايات كثيرة",
    libraryTitle: "اللعب يجمعنا",
    libraryIntro: "ألعاب جماعية مصمّمة للعائلة والأصدقاء، بالعربي والإنجليزي وعلى جهاز واحد أو عدة أجهزة.",
    localMode: "جهاز واحد",
    localHint: "مرّروا الجوال بينكم",
    roomMode: "غرفة جماعية",
    roomHint: "كل لاعب يدخل من جهازه",
    play: "ابدأ اللعب",
    players: "لاعب",
    minutes: "دقيقة",
  },
  en: {
    eyebrow: "One gathering, endless stories",
    libraryTitle: "Play brings us together",
    libraryIntro: "Bilingual games for family and friends, on one device or across the whole room.",
    localMode: "One device",
    localHint: "Pass one phone around",
    roomMode: "Group room",
    roomHint: "Everyone joins on their device",
    play: "Play now",
    players: "players",
    minutes: "min",
  },
} as const;

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;
type DocumentRoot = Pick<HTMLElement, "lang" | "dir">;

export function getLibraryCopy(locale: Locale) {
  return libraryCopy[locale];
}

export function formatPlayerRange(
  range: GameDefinition["playerRange"],
  locale: Locale,
) {
  return `${range.min}–${range.max} ${locale === "ar" ? "لاعب" : "players"}`;
}

export function readStoredLocale(storage?: StorageReader): Locale {
  try {
    const value = storage?.getItem(LOCALE_KEY) ?? storage?.getItem(LEGACY_LOCALE_KEY);
    return value === "en" || value === "ar" ? value : "ar";
  } catch {
    return "ar";
  }
}

export function writeStoredLocale(locale: Locale, storage?: StorageWriter) {
  try {
    storage?.setItem(LOCALE_KEY, locale);
    storage?.setItem(LEGACY_LOCALE_KEY, locale);
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function syncDocumentLocale(locale: Locale, root: DocumentRoot) {
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
}

type GameLibraryProps = {
  locale: Locale;
  mode: PlayMode;
  onModeChange: (mode: PlayMode) => void;
  onChooseGame: (gameId: GameId) => void;
};

export function GameLibrary({
  locale,
  mode,
  onModeChange,
  onChooseGame,
}: GameLibraryProps) {
  const t = getLibraryCopy(locale);

  return (
    <section className="library" aria-labelledby="library-title">
      <div className="libraryIntro">
        <span className="libraryEyebrow"><Gamepad2 size={17} /> {t.eyebrow}</span>
        <h1 id="library-title">{t.libraryTitle}</h1>
        <p>{t.libraryIntro}</p>
      </div>

      <div className="modeSelector" aria-label={locale === "ar" ? "طريقة اللعب" : "Play mode"}>
        {(["local", "room"] as const).map((option) => (
          <button
            type="button"
            key={option}
            className={mode === option ? "modeOption active" : "modeOption"}
            aria-pressed={mode === option}
            onClick={() => onModeChange(option)}
          >
            <span>{option === "local" ? "☝️" : "🔗"}</span>
            <strong>{option === "local" ? t.localMode : t.roomMode}</strong>
            <small>{option === "local" ? t.localHint : t.roomHint}</small>
          </button>
        ))}
      </div>

      <div className="gameGrid">
        {GAME_CATALOG.map((game) => (
          <article className="gameTile" key={game.id} style={{ "--game-accent": game.art.accent } as React.CSSProperties}>
            <div className="gameArtwork">
              <img src={game.art.src} alt={game.art.alt[locale]} />
            </div>
            <div className="gameTileBody">
              <h2>{game.title[locale]}</h2>
              <p>{game.description[locale]}</p>
              <div className="gameMeta">
                <span><Users size={15} /> {formatPlayerRange(game.playerRange, locale)}</span>
                <span><Clock3 size={15} /> {game.approximateMinutes} {t.minutes}</span>
              </div>
            </div>
            <button
              data-action="primary"
              className="gameAction"
              type="button"
              onClick={() => onChooseGame(game.id)}
              disabled={!game.supportedModes.includes(mode)}
            >
              {t.play}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
