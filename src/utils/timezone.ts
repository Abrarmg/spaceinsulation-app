/**
 * The whole app runs on Eastern Time (Toronto), whatever time zone the
 * device is set to. Importing this file (done first in main.tsx) makes every
 * date and time the app formats show Eastern Time by default.
 *
 * Rules for the rest of the code:
 *  - "Today" / the current hour: use todayLocal(), todayDate() or nowInAppTz() from utils/dates.
 *  - Calendar dates (YYYY-MM-DD) are turned into Dates at 12:00 local
 *    (`${ymd}T12:00:00`), which is the same calendar day in Eastern Time for
 *    any device within ±11 hours of Toronto.
 *  - Real timestamps (created_at, clock_in…) can be formatted directly.
 */

export const APP_TIME_ZONE = 'America/Toronto';

type FormatOptions = Intl.DateTimeFormatOptions | undefined;

const withAppZone = (options: FormatOptions): Intl.DateTimeFormatOptions =>
  options && options.timeZone ? options : { ...(options || {}), timeZone: APP_TIME_ZONE };

let installed = false;

export const installAppTimeZone = () => {
  if (installed || typeof Intl === 'undefined') return;
  installed = true;

  const proto = Date.prototype;
  const origString = proto.toLocaleString;
  const origDate = proto.toLocaleDateString;
  const origTime = proto.toLocaleTimeString;

  proto.toLocaleString = function (this: Date, locales?: Intl.LocalesArgument, options?: FormatOptions) {
    return origString.call(this, locales, withAppZone(options));
  };
  proto.toLocaleDateString = function (this: Date, locales?: Intl.LocalesArgument, options?: FormatOptions) {
    return origDate.call(this, locales, withAppZone(options));
  };
  proto.toLocaleTimeString = function (this: Date, locales?: Intl.LocalesArgument, options?: FormatOptions) {
    return origTime.call(this, locales, withAppZone(options));
  };

  const OrigDTF = Intl.DateTimeFormat;
  const PatchedDTF = function (this: unknown, locales?: Intl.LocalesArgument, options?: FormatOptions) {
    return new OrigDTF(locales, withAppZone(options));
  } as unknown as typeof Intl.DateTimeFormat;
  Object.setPrototypeOf(PatchedDTF, OrigDTF);
  (PatchedDTF as { prototype: Intl.DateTimeFormat }).prototype = OrigDTF.prototype;
  Intl.DateTimeFormat = PatchedDTF;
};

installAppTimeZone();
