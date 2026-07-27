"use client";

import { useEffect, useState } from "react";
import type { Locale } from "../lib/game";

export function PwaStatus({ locale, roomMode }: { locale: Locale; roomMode: boolean }) {
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const online = () => setOffline(false);
    const offline = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        const watch = (worker: ServiceWorker | null) => worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
        });
        watch(registration.installing);
        registration.addEventListener("updatefound", () => watch(registration.installing));
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  if (!offline && !updateReady) return null;
  return (
    <div className="pwaStatus" role="status" aria-live="polite">
      {offline
        ? roomMode
          ? (locale === "ar" ? "الغرف تحتاج اتصالاً — ارجع واختر جهازاً واحداً" : "Rooms need a connection — go back and choose one device")
          : (locale === "ar" ? "أنت غير متصل — الألعاب المحلية ما زالت متاحة" : "You’re offline — local games are still available")
        : (locale === "ar" ? "يتوفر تحديث جديد عند إعادة التحميل" : "An update is ready when you reload")}
    </div>
  );
}
