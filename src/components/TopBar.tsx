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
        <span className="brandMark">ب</span>
        <span>
          <strong>برا السالفة</strong>
          <small>Game night, sorted.</small>
        </span>
      </button>
      <div className="topBarActions">
        {showBack && (
          <button className="backButton" type="button" onClick={onHome}>
            <ArrowLeft size={17} />
            <span>{locale === "ar" ? "كل الألعاب" : "All games"}</span>
          </button>
        )}
        <div className="languageSwitch" aria-label={locale === "ar" ? "اللغة" : "Language"}>
          <Languages size={15} aria-hidden="true" />
          <button className={locale === "ar" ? "active" : ""} onClick={() => onLocaleChange("ar")}>ع</button>
          <button className={locale === "en" ? "active" : ""} onClick={() => onLocaleChange("en")}>EN</button>
        </div>
      </div>
    </header>
  );
}
