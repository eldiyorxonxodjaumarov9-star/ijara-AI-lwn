"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { useTashkentClock } from "@/hooks/use-tashkent-clock";

const TashkentTimeContext = createContext<Date | null>(null);

/** Butun dashboard bo'ylab haqiqiy Toshkent vaqti — qarzlar avtomatik yangilanadi */
export function TashkentTimeProvider({ children }: { children: ReactNode }) {
  const now = useTashkentClock(30_000);
  return (
    <TashkentTimeContext.Provider value={now}>
      {children}
    </TashkentTimeContext.Provider>
  );
}

export function useTashkentNow() {
  const ctx = useContext(TashkentTimeContext);
  return ctx ?? new Date();
}
