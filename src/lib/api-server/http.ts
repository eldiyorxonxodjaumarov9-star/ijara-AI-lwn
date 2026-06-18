import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      statusCode: status,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function fail(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function parsePagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 100))
  );
  const search = url.searchParams.get("search") ?? undefined;
  const sortBy = url.searchParams.get("sortBy") ?? "createdAt";
  const order =
    url.searchParams.get("order") === "asc" ? "asc" : ("desc" as const);
  return { page, limit, skip: (page - 1) * limit, search, sortBy, order };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
