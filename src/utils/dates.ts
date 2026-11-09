import { APP_TIME_ZONE } from './timezone';

/**
 * Date helpers. Everything here works in the app's time zone (Eastern Time,
 * see utils/timezone.ts), so "today" is the same for everyone using the app.
 */

const pad = (n: number) => String(n).padStart(2, '0');

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Wall-clock parts of an instant in Eastern Time. */
export const partsInAppTz = (instant: Date | number = new Date()) => {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(instant)) map[p.type] = p.value;
  const hour = Number(map.hour) % 24;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: Math.max(0, WEEKDAYS.indexOf(map.weekday)),
    ymd: `${map.year}-${map.month}-${map.day}`,
  };
};

/** The current time in Eastern Time: { ymd, hour, minute, weekday, … }. */
export const nowInAppTz = () => partsInAppTz(new Date());

/** Adds days to a YYYY-MM-DD date without time-zone drift. */
export const addDaysToDate = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

/** Today's date in Eastern Time (optionally shifted by a number of days) as YYYY-MM-DD. */
export const todayLocal = (plusDays = 0) => {
  const today = nowInAppTz().ymd;
  return plusDays ? addDaysToDate(today, plusDays) : today;
};

/**
 * Today (Eastern Time) as a Date at 12:00 local, for calendar maths with
 * getDate()/setDate(). Use instead of `new Date()` whenever you mean "today".
 */
export const todayDate = (plusDays = 0) => new Date(`${todayLocal(plusDays)}T12:00:00`);

/** The Eastern Time calendar date (YYYY-MM-DD) of a timestamp. */
export const ymdInAppTz = (instant: string | number | Date) => partsInAppTz(new Date(instant)).ymd;

/** A YYYY-MM-DD date as YYYY-MM-DD from a local-noon Date (calendar maths result). */
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The exact moment Eastern Time midnight starts on a calendar day, as an ISO
 * string — for "created today / this week" filters on timestamp columns.
 */
export const appDayStartISO = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  // Start from UTC midnight, then correct by Toronto's offset on that day (handles daylight saving).
  let guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const p = partsInAppTz(guess);
    const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess -= wall - Date.UTC(y, m - 1, d, 0, 0, 0);
  }
  return new Date(guess).toISOString();
};
