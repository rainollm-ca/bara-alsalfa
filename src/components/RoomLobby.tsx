"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Link2, Users } from "lucide-react";

import { GAME_CATALOG } from "../games/catalog";
import type { GameId, Locale } from "../games/types";
import type { PlayerRoomView } from "../rooms/contracts";
import {
  createRoomClient,
  readRoomSession,
  RoomClientError,
  writeRoomSession,
  type RoomClient,
  type RoomSession,
} from "../rooms/client";

const copy = {
  en: {
    title: "Start a group room", intro: "Create a room or join your friends on this device.",
    create: "Create", join: "Join", name: "Your name", code: "Room code",
    createButton: "Create room", joinButton: "Join room", room: "Room",
    waiting: "Waiting for players", share: "Copy invite link", copied: "Invite link copied",
    start: "Start game", started: "Game started", reconnecting: "Connection lost. Reconnecting…",
    expired: "This room expired. Create or join a new one.", invalid: "Check the room code and try again.",
  },
  ar: {
    title: "ابدأوا غرفة جماعية", intro: "أنشئ غرفة أو انضم لأصحابك من هذا الجهاز.",
    create: "إنشاء", join: "انضمام", name: "اسمك", code: "رمز الغرفة",
    createButton: "أنشئ الغرفة", joinButton: "انضم للغرفة", room: "الغرفة",
    waiting: "بانتظار اللاعبين", share: "انسخ رابط الدعوة", copied: "تم نسخ رابط الدعوة",
    start: "ابدأ اللعبة", started: "بدأت اللعبة", reconnecting: "انقطع الاتصال. نحاول من جديد…",
    expired: "انتهت صلاحية الغرفة. أنشئ غرفة جديدة أو انضم لغيرها.", invalid: "تأكد من رمز الغرفة وحاول مرة ثانية.",
  },
} as const;

type Props = {
  locale: Locale;
  gameId?: GameId;
  initialCode?: string;
  onExit: () => void;
  api?: RoomClient;
};

export function RoomLobby({ locale, gameId, initialCode, onExit, api: suppliedApi }: Props) {
  const t = copy[locale];
  const api = useMemo(() => suppliedApi ?? createRoomClient(), [suppliedApi]);
  const [tab, setTab] = useState<"create" | "join">(initialCode ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [session, setSession] = useState<RoomSession | null>(null);
  const [room, setRoom] = useState<PlayerRoomView | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const game = GAME_CATALOG.find((candidate) => candidate.id === (room?.selectedGame ?? gameId));
  const [recovery, setRecovery] = useState<"expired" | "failed" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const createTabRef = useRef<HTMLButtonElement>(null);
  const joinTabRef = useRef<HTMLButtonElement>(null);
  const recoveryHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => {
    requestGeneration.current += 1;
    activeRequest.current?.abort();
  }, []);

  useEffect(() => {
    if (recovery) recoveryHeadingRef.current?.focus();
  }, [recovery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const linkedCode = initialCode ?? new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (!linkedCode || !/^[A-Z0-9]{6}$/.test(linkedCode)) return;
    setCode(linkedCode);
    let stored = null;
    try {
      stored = readRoomSession(window.localStorage, linkedCode);
    } catch {
      stored = null;
    }
    if (!stored) {
      setTab("join");
      return;
    }
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setName(stored.name);
    void api.join(linkedCode, { name: stored.name, playerToken: stored.playerToken }, controller.signal)
      .then((result) => {
        if (generation !== requestGeneration.current || controller.signal.aborted) return;
        setSession(stored);
        setRoom(result.room);
      })
      .catch((reason) => {
        if (generation !== requestGeneration.current || controller.signal.aborted) return;
        setSession(null);
        setRoom(null);
        setRecovery(reason instanceof RoomClientError &&
          (reason.code === "ROOM_EXPIRED" || reason.code === "ROOM_NOT_FOUND") ? "expired" : "failed");
      });
    return () => {
      if (generation === requestGeneration.current) requestGeneration.current += 1;
      controller.abort();
    };
  }, [api, initialCode]);

  useEffect(() => {
    if (!session) return;
    return api.poll(session.code, session.playerToken, (state) => {
      setRoom(state);
      setError("");
    }, (reason) => {
      if (reason.code === "ROOM_EXPIRED" || reason.code === "ROOM_NOT_FOUND" || reason.code === "INVALID_TOKEN") {
        setRoom(null);
        setSession(null);
        setRecovery(reason.code === "INVALID_TOKEN" ? "failed" : "expired");
      } else {
        setError(t.reconnecting);
      }
    });
  }, [api, session, t.expired, t.reconnecting]);

  async function create() {
    if (submitting) return;
    setError("");
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setSubmitting(true);
    try {
      if (!gameId) {
        setError(t.invalid);
        return;
      }
      const result = await api.create({ hostName: name, locale, gameId }, controller.signal);
      if (generation !== requestGeneration.current) return;
      const next = {
        code: result.code!,
        name: name.trim(),
        playerToken: result.playerToken!,
        hostToken: result.hostToken!,
      };
      if (typeof window !== "undefined") {
        try {
          writeRoomSession(window.localStorage, next);
        } catch {
          // Private browsing or an opaque origin can disable storage; the live session still works.
        }
        const url = new URL(window.location.href);
        url.searchParams.set("room", next.code);
        window.history.replaceState(null, "", url);
      }
      setSession(next);
      setRoom(result.room);
    } catch (reason) {
      if (generation !== requestGeneration.current || controller.signal.aborted) return;
      setError(message(reason));
    } finally {
      if (generation === requestGeneration.current) setSubmitting(false);
    }
  }

  async function join() {
    if (submitting) return;
    setError("");
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setSubmitting(true);
    try {
      const normalized = code.trim().toUpperCase();
      const result = await api.join(normalized, { name }, controller.signal);
      if (generation !== requestGeneration.current) return;
      const next = { code: normalized, name: name.trim(), playerToken: result.playerToken! };
      if (typeof window !== "undefined") {
        try {
          writeRoomSession(window.localStorage, next);
        } catch {
          // Private browsing or an opaque origin can disable storage; the live session still works.
        }
        const url = new URL(window.location.href);
        url.searchParams.set("room", next.code);
        window.history.replaceState(null, "", url);
      }
      setSession(next);
      setRoom(result.room);
    } catch (reason) {
      if (generation !== requestGeneration.current || controller.signal.aborted) return;
      setError(message(reason));
      if (reason instanceof RoomClientError &&
        (reason.code === "ROOM_EXPIRED" || reason.code === "ROOM_NOT_FOUND" || reason.code === "INVALID_TOKEN")) {
        setRecovery(reason.code === "ROOM_EXPIRED" ? "expired" : "failed");
      }
    } finally {
      if (generation === requestGeneration.current) setSubmitting(false);
    }
  }

  function message(reason: unknown) {
    if (reason instanceof RoomClientError &&
      (reason.code === "ROOM_EXPIRED" || reason.code === "ROOM_NOT_FOUND")) return t.expired;
    return t.invalid;
  }

  async function share() {
    if (!session || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("room", session.code);
    await navigator.clipboard?.writeText(url.toString());
    setCopied(true);
  }

  if (recovery) {
    return (
      <section className="roomLobby roomRecovery">
        <span aria-hidden="true">🔗</span>
        <h1 ref={recoveryHeadingRef} tabIndex={-1}>{locale === "ar" ? "الغرفة غير متاحة" : "Room unavailable"}</h1>
        <p role="status" aria-live="assertive">{recovery === "expired" ? t.expired : t.invalid}</p>
        <button className="primaryButton" type="button" onClick={() => {
          setRecovery(null);
          setTab("join");
        }}>{locale === "ar" ? "حاول الانضمام مجدداً" : "Try joining again"}</button>
        <button className="ghostButton" type="button" onClick={onExit}>
          {locale === "ar" ? "أنشئ غرفة جديدة" : "Create a new room"}
        </button>
        <button className="textButton" type="button" onClick={onExit}>
          {locale === "ar" ? "العودة للألعاب" : "Back to games"}
        </button>
      </section>
    );
  }

  if (room && session) {
    return (
      <section className="roomLobby roomWaiting" data-room-status={room.status}>
        {game && <span className="roomGame">{game.emoji} {game.title[locale]}</span>}
        <p>{t.room}</p>
        <h1 className="roomCode">{room.code}</h1>
        <button className="ghostButton" type="button" onClick={share}>
          {copied ? <Copy size={18} /> : <Link2 size={18} />} {copied ? t.copied : t.share}
        </button>
        <h2><Users size={22} /> {t.waiting}</h2>
        {room.status === "playing" && <p className="roomStarted">{t.started}</p>}
        <div className="roomPlayers">
          {room.players.map((player) => <span key={player.id}>{player.isHost ? "👑 " : ""}{player.name}</span>)}
        </div>
        {error && <p role="alert" className="validationMessage">{error}</p>}
        {room.self.isHost && (
          <button
            className="primaryButton"
            type="button"
            disabled={!session.hostToken}
            onClick={() => session.hostToken && api.action(room.code, session.hostToken, { type: "lobby/start" }).then((result) => setRoom(result.room)).catch((reason) => setError(message(reason)))}
          >
            {t.start}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="roomLobby">
      {game && <span className="roomGame">{game.emoji} {game.title[locale]}</span>}
      <h1>{t.title}</h1>
      <p>{t.intro}</p>
      <div className="roomTabs" role="tablist" aria-label={locale === "ar" ? "خيارات الغرفة" : "Room options"}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "create" : event.key === "End" ? "join" :
            tab === "create" ? "join" : "create";
          if (next === "create" && !gameId) return;
          setTab(next);
          (next === "create" ? createTabRef : joinTabRef).current?.focus();
        }}>
        {gameId && <button ref={createTabRef} id="room-tab-create" aria-controls="room-panel" tabIndex={tab === "create" ? 0 : -1} role="tab" aria-selected={tab === "create"} onClick={() => setTab("create")}>{t.create}</button>}
        <button ref={joinTabRef} id="room-tab-join" aria-controls="room-panel" tabIndex={tab === "join" ? 0 : -1} role="tab" aria-selected={tab === "join"} onClick={() => setTab("join")}>{t.join}</button>
      </div>
      <div id="room-panel" role="tabpanel" aria-labelledby={tab === "create" ? "room-tab-create" : "room-tab-join"}>
      <label className="roomField">
        <span>{t.name}</span>
        <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
      </label>
      {tab === "join" && (
        <label className="roomField">
          <span>{t.code}</span>
          <input value={code} maxLength={6} autoCapitalize="characters" onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </label>
      )}
      {error && <p role="alert" className="validationMessage">{error}</p>}
      <button data-action="primary" className="primaryButton" disabled={submitting || !name.trim() || (tab === "join" && !/^[A-Z0-9]{6}$/.test(code))} onClick={tab === "create" ? create : join}>
        {tab === "create" ? t.createButton : t.joinButton}
      </button>
      </div>
    </section>
  );
}
