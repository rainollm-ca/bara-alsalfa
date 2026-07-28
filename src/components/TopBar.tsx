"use client";

import { ArrowLeft, Languages } from "lucide-react";

import type { Locale } from "../lib/game";

type TopBarProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onHome?: () => void;
  showBack?: boolean;
};

export function TopBar({ locale, onLocaleChange, onHome, showBack }: TopBarProps) {
  return (
    <header className="topBar">
      <button className="brandButton" type="button" onClick={onHome} aria-label={locale === "ar" ? "المكتبة" : "Game library"}>
        <span className="brandMark"><img src="/brand/lamma-mark.png" alt="" /></span>
        <span>
          <strong>{locale === "ar" ? "لمّة" : "Lamma"}</strong>
          <small>{locale === "ar" ? "اللعب يجمعنا" : "Play brings us together"}</small>
        </span>
      </button>
      <div className="topBarActions">
        {showBack && (
          <button className="backButton" type="button" onClick={onHome}>
            <ArrowLeft size={17} />
            <span>{locale === "ar" ? "كل الألعاب" : "All games"}</span>
          </button>
        )}
        <div className="languageSwitch" role="group" aria-label={locale === "ar" ? "اللغة" : "Language"}>
          <Languages size={15} aria-hidden="true" />
          <button aria-pressed={locale === "ar"} className={locale === "ar" ? "active" : ""} onClick={() => onLocaleChange("ar")}>ع</button>
          <button aria-pressed={locale === "en"} className={locale === "en" ? "active" : ""} onClick={() => onLocaleChange("en")}>EN</button>
        </div>
      </div>
    </header>
  );
}
