import type { ReactNode } from "react";

import type { GameDefinition } from "../games/types";
import type { Locale } from "../lib/game";

export function validateSetup(
  playerCount: number,
  range: GameDefinition["playerRange"],
  locale: Locale = "ar",
): { valid: true } | { valid: false; message: string } {
  if (playerCount < range.min) {
    return {
      valid: false,
      message: locale === "ar"
        ? `تحتاجون ${range.min} لاعبين على الأقل`
        : `You need at least ${range.min} players`,
    };
  }
  if (playerCount > range.max) {
    return {
      valid: false,
      message: locale === "ar"
        ? `تدعم هذه اللعبة حتى ${range.max} لاعب`
        : `This game supports up to ${range.max} players`,
    };
  }
  return { valid: true };
}

type SetupShellProps = {
  title: string;
  hint?: string;
  children: ReactNode;
};

export function SetupShell({ title, hint, children }: SetupShellProps) {
  return (
    <section className="panel setupShell" aria-labelledby="setup-title">
      <div className="setupHeading">
        <p className="setupKicker">01 / 02</p>
        <h1 id="setup-title">{title}</h1>
        {hint && <p>{hint}</p>}
      </div>
      {children}
    </section>
  );
}
