"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
};

const remainingAt = (state: TimerState, now: number) =>
  state.status === "running"
    ? Math.max(0, state.remainingMs - (now - state.startedAt))
    : state.remainingMs;

export function TimedRound({ seconds, locale, resetKey, onExpire, children }: Props) {
  const [timer, setTimer] = useState<TimerState>({
    status: "ready",
    remainingMs: seconds * 1_000,
    startedAt: null,
  });
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setTimer({ status: "ready", remainingMs: seconds * 1_000, startedAt: null });
    setNow(Date.now());
  }, [resetKey, seconds]);

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
