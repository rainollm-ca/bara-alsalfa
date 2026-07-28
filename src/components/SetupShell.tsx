import { Check, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import type { GameDefinition } from "../games/types";
import type { Locale, LocalizedText } from "../lib/game";

export type SetupOption = {
  id: string;
  title: LocalizedText;
  emoji?: string;
};

export function normalizeSetupNames(names: string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

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

export function validateDuration(
  duration: number,
  range: { min: number; max: number },
  locale: Locale = "ar",
): { valid: true } | { valid: false; message: string } {
  if (duration >= range.min && duration <= range.max) return { valid: true };
  return {
    valid: false,
    message: locale === "ar"
      ? `اختاروا مدة من ${range.min} إلى ${range.max} ثانية`
      : `Choose a duration from ${range.min} to ${range.max} seconds`,
  };
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
        <p className="setupKicker">LAMMA · لمّة</p>
        <h1 id="setup-title">{title}</h1>
        {hint && <p>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

type NamesFieldProps = {
  id: string;
  label: string;
  hint?: string;
  names: string[];
  value: string;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  max: number;
  onValueChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function NamesField(props: NamesFieldProps) {
  return (
    <fieldset className="setupField">
      <legend>{props.label}</legend>
      {props.hint && <p className="fieldHint">{props.hint}</p>}
      <div className="players">
        {props.names.map((name, index) => (
          <div className="playerChip" key={`${name}-${index}`}>
            <span className="avatar">{name[0]}</span>
            <span>{name}</span>
            <button type="button" aria-label={`${props.removeLabel} ${name}`} onClick={() => props.onRemove(index)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      {props.names.length < props.max && (
        <div className="addRow">
          <input
            id={props.id}
            aria-label={props.label}
            value={props.value}
            onChange={(event) => props.onValueChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), props.onAdd())}
            placeholder={props.placeholder}
          />
          <button data-action="primary" type="button" onClick={props.onAdd} aria-label={props.addLabel}><Plus size={21} /></button>
        </div>
      )}
    </fieldset>
  );
}

export type PlayerNamesFieldProps = Omit<NamesFieldProps, "id">;
export function PlayerNamesField(props: PlayerNamesFieldProps) {
  return <NamesField id="player-name" {...props} />;
}

export type TeamNamesFieldProps = Omit<NamesFieldProps, "id">;
export function TeamNamesField(props: TeamNamesFieldProps) {
  return <NamesField id="team-name" {...props} />;
}

type CategorySelectorProps = {
  label: string;
  hint?: string;
  locale: Locale;
  options: SetupOption[];
  value: string;
  onChange: (id: string) => void;
};

export function CategorySelector({ label, hint, locale, options, value, onChange }: CategorySelectorProps) {
  return (
    <fieldset className="setupField categoryField">
      <legend>{label}</legend>
      {hint && <p className="fieldHint">{hint}</p>}
      <div className="categories" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === option.id}
            key={option.id}
            className={value === option.id ? "category active" : "category"}
            onClick={() => onChange(option.id)}
          >
            {option.emoji && <b>{option.emoji}</b>}
            <span>{option.title[locale]}</span>
            {value === option.id && <Check size={16} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type DurationSelectorProps = {
  label: string;
  value: number;
  options: number[];
  unit: string;
  onChange: (seconds: number) => void;
};

export function DurationSelector({ label, value, options, unit, onChange }: DurationSelectorProps) {
  return (
    <fieldset className="setupField">
      <legend>{label}</legend>
      <div className="durationOptions">
        {options.map((seconds) => (
          <button type="button" key={seconds} className={value === seconds ? "active" : ""} aria-pressed={value === seconds} onClick={() => onChange(seconds)}>
            {seconds} {unit}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
