"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCollectionApi,
  type CollectionName,
  type CrudApi,
} from "@/lib/data/store";
import type { CollectionEntity } from "@/types";

export interface UseCollectionResult<T extends CollectionEntity> {
  data: T[];
  loading: boolean;
  api: CrudApi<T>;
}

export function useCollection<T extends CollectionEntity>(
  name: CollectionName
): UseCollectionResult<T> {
  const api = useMemo(() => getCollectionApi<T>(name), [name]);
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = api.subscribe((items) => {
      setData(items);
      setLoading(false);
    });
    return unsub;
  }, [api]);

  return { data, loading, api };
}

export function useCollectionActions<T extends CollectionEntity>(
  name: CollectionName
) {
  const api = useMemo(() => getCollectionApi<T>(name), [name]);

  const create = useCallback(
    (data: Omit<T, "id" | "createdAt"> & { createdAt?: string }) =>
      api.create(data),
    [api]
  );
  const update = useCallback(
    (id: string, data: Partial<T>) => api.update(id, data),
    [api]
  );
  const remove = useCallback((id: string) => api.remove(id), [api]);

  return { create, update, remove };
}
