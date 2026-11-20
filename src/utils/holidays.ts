/**
 * Ontario statutory holidays plus a few well-known days, for marking the calendar.
 * Keys are YYYY-MM-DD.
 */

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** The nth (1-based) given weekday (0 = Sun) of a month. */
const nthWeekday = (y: number, m: number, weekday: number, n: number) => {
  const first = new Date(y, m, 1, 12).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
};

/** Easter Sunday (Anonymous Gregorian algorithm). */
const easter = (y: number) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month, day, 12);
};

const cache = new Map<number, Map<string, string>>();

export const holidaysForYear = (y: number): Map<string, string> => {
  const hit = cache.get(y);
  if (hit) return hit;
  const map = new Map<string, string>();
  const goodFriday = easter(y);
  goodFriday.setDate(goodFriday.getDate() - 2);
  // Victoria Day: the Monday before May 25.
  const may24 = new Date(y, 4, 24, 12);
  const victoria = 24 - ((may24.getDay() + 6) % 7);

  map.set(key(y, 0, 1), "New Year's Day");
  map.set(key(y, 1, nthWeekday(y, 1, 1, 3)), 'Family Day');
  map.set(key(y, goodFriday.getMonth(), goodFriday.getDate()), 'Good Friday');
  map.set(key(y, 4, victoria), 'Victoria Day');
  map.set(key(y, 6, 1), 'Canada Day');
  map.set(key(y, 7, nthWeekday(y, 7, 1, 1)), 'Civic Holiday');
  map.set(key(y, 8, nthWeekday(y, 8, 1, 1)), 'Labour Day');
  map.set(key(y, 9, nthWeekday(y, 9, 1, 2)), 'Thanksgiving');
  map.set(key(y, 9, 31), 'Halloween');
  map.set(key(y, 10, 11), 'Remembrance Day');
  map.set(key(y, 11, 25), 'Christmas Day');
  map.set(key(y, 11, 26), 'Boxing Day');
  cache.set(y, map);
  return map;
};

export const holidayOn = (ymd: string): string | undefined =>
  holidaysForYear(Number(ymd.slice(0, 4))).get(ymd);
