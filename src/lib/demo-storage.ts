/** Demo rejim localStorage kalitlari — server rejimida tozalanadi */
const DEMO_PREFIX = "arendahub:";
const TOKEN_KEYS = new Set([
  `${DEMO_PREFIX}access`,
  `${DEMO_PREFIX}refresh`,
]);

export function clearDemoStorage() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(DEMO_PREFIX)) continue;
    if (TOKEN_KEYS.has(key)) continue;
    keysToRemove.push(key);
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}
