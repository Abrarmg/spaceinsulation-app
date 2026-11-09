/**
 * Keeps the last loaded copy of a list in memory for this browser tab, so
 * going back to a page shows it instantly while fresh data loads quietly.
 * Cleared whenever a different user signs in or out.
 */

const store = new Map<string, unknown>();

export const readCache = <T,>(key: string): T | undefined => store.get(key) as T | undefined;

export const writeCache = <T,>(key: string, value: T) => {
  store.set(key, value);
};

export const clearCache = () => store.clear();
