"use client";

import { useMemo, useState } from "react";

export function useTableData<T>({
  data,
  searchFields,
  pageSize = 8,
}: {
  data: T[];
  searchFields: (keyof T)[];
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        return String(value ?? "").toLowerCase().includes(term);
      })
    );
  }, [data, search, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () =>
      filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );

  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    page: currentPage,
    setPage,
    totalPages,
    total: filtered.length,
    paged,
  };
}
