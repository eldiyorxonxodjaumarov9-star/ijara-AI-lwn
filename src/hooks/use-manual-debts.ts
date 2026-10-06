"use client";

import { useCallback, useEffect, useState } from "react";

import { isApiConfigured } from "@/lib/api/client";
import { listManualDebtsApi } from "@/lib/manual-debts-client";
import type { ManualDebtView } from "@/lib/manual-debts";

/** Qo'lda kiritilgan qarzlar (faqat API rejimida — workspace server tomonda aniqlanadi). */
export function useManualDebts() {
  const [data, setData] = useState<ManualDebtView[]>([]);
  const [loading, setLoading] = useState(isApiConfigured);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isApiConfigured) return;
    try {
      setData(await listManualDebtsApi());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, enabled: isApiConfigured };
}
