"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GameId } from "../../games/types";
import { useGameSessionState } from "../../lib/useGameSessionState";

type TimerState =
  | { status: "ready" | "expired"; remainingMs: number; startedAt: null }
  | { status: "running"; remainingMs: number; startedAt: number }
  | { status: "paused"; remainingMs: number; startedAt: null };

type Props = {
  seconds: number;
  locale: "ar" | "en";
  resetKey: string | number;
  onExpire: () => void;
  children: (running: boolean) => ReactNode;
  gameId: GameId;
};

const remainingAt = (state: TimerState, now: number) =>
  state.status === "running"
    ? Math.max(0, state.remainingMs - (now - state.startedAt))
    : state.remainingMs;

export function TimedRound({ seconds, locale, resetKey, onExpire, children, gameId }: Props) {
  const isTimerState = (value: unknown): value is TimerState => {
    if (!value || typeof value !== "object") return false;
    const timer = value as Partial<TimerState>;
    if (!["ready", "running", "paused", "expired"].includes(String(timer.status)) ||
      typeof timer.remainingMs !== "number" || !Number.isFinite(timer.remainingMs) ||
      timer.remainingMs < 0 || timer.remainingMs > seconds * 1_000) return false;
    return timer.status === "running"
      ? typeof timer.startedAt === "number" && Number.isFinite(timer.startedAt) &&
          timer.startedAt >= Date.now() - 7 * 86_400_000 && timer.startedAt <= Date.now() + 60_000
      : timer.startedAt === null;
  };
  const [timer, setTimer] = useGameSessionState<TimerState>(gameId, locale, "timer", {
    status: "ready",
    remainingMs: seconds * 1_000,
    startedAt: null,
  }, isTimerState, (value) => {
    if (value.status !== "running") return value;
    return {
      status: "running",
      remainingMs: remainingAt(value, Date.now()),
      startedAt: Date.now(),
    };
  });
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);
  const previousResetKey = useRef(resetKey);

  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    expiredRef.current = false;
    setTimer({ status: "ready", remainingMs: seconds * 1_000, startedAt: null });
    setNow(Date.now());
  }, [resetKey, seconds, setTimer]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [timer.status]);

  const remainingMs = remainingAt(timer, now);
  useEffect(() => {
    if (timer.status !== "running" || remainingMs > 0 || expiredRef.current) return;
    expiredRef.current = true;
    setTimer({ status: "expired", remainingMs: 0, startedAt: null });
    onExpire();
  }, [onExpire, remainingMs, timer.status]);

  const labels = locale === "ar"
    ? { start: "ابدأ المؤقت", pause: "أوقف المؤقت", resume: "أكمل المؤقت", seconds: "ثانية" }
    : { start: "Start timer", pause: "Pause timer", resume: "Resume timer", seconds: "seconds" };

  function start() {
    setNow(Date.now());
    setTimer((current) => ({
      status: "running",
      remainingMs: remainingAt(current, Date.now()),
      startedAt: Date.now(),
    }));
  }

  function pause() {
    const timestamp = Date.now();
    setNow(timestamp);
    setTimer((current) => ({
      status: "paused",
      remainingMs: remainingAt(current, timestamp),
      startedAt: null,
    }));
  }

  return (
    <section className="timedRound" aria-label={locale === "ar" ? "الجولة المؤقتة" : "Timed round"}>
      <div className="roundTimer" role="timer" aria-live="polite">
        <strong>{Math.ceil(remainingMs / 1_000)}</strong>
        <span>{labels.seconds}</span>
      </div>
      <div className="timerControls">
        {timer.status === "ready" && <button className="primary" onClick={start}>{labels.start}</button>}
        {timer.status === "running" && <button className="secondary" onClick={pause}>{labels.pause}</button>}
        {timer.status === "paused" && <button className="primary" onClick={start}>{labels.resume}</button>}
      </div>
      {children(timer.status === "running")}
    </section>
  );
}
