/**
 * Client/UI-safe TTLock access helpers (server path’siz).
 */

export function stripOneTimePasscode<T extends { oneTimePasscode?: string }>(
  grant: T
): Omit<T, "oneTimePasscode"> {
  const { oneTimePasscode: _drop, ...rest } = grant;
  void _drop;
  return rest;
}

export const EKEY_RECEIVER_MISSING_HINT =
  "Arendator telefon/emaili yo‘q. Reja saqlanishi mumkin, lekin eKey API’ga yuborilmaydi.";
