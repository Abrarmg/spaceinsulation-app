/**
 * Remembers the values someone used last time on a form (crew, tax rate,
 * terms…) so the next one starts filled in. Stored on this device only;
 * every read and write is safe when storage is unavailable.
 */

const PREFIX = 'si.formMemory.';

export const recall = <T extends object>(form: string): Partial<T> => {
  try {
    const raw = localStorage.getItem(PREFIX + form);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<T>) : {};
  } catch {
    return {};
  }
};

export const remember = <T extends object>(form: string, values: T) => {
  try {
    localStorage.setItem(PREFIX + form, JSON.stringify(values));
  } catch {
    /* storage unavailable — the form just starts with its usual defaults */
  }
};
