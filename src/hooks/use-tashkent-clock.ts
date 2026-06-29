"use client";

import { useEffect, useState } from "react";

import { msUntilTashkentMidnight } from "@/lib/payment-due-schedule";

/** Toshkent vaqtida har daqiqa (va yarim tunda) yangilanadi — qarzlar avtomatik qayta hisoblanadi */
export function useTashkentClock(tickMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());

    const interval = setInterval(tick, tickMs);

    let midnightTimer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      midnightTimer = setTimeout(() => {
        tick();
        scheduleMidnight();
      }, msUntilTashkentMidnight());
    };
    scheduleMidnight();

    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimer);
    };
  }, [tickMs]);

  return now;
}
