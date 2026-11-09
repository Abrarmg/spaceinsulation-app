/** Today's date (optionally shifted by a number of days) as YYYY-MM-DD in the user's time zone. */
export const todayLocal = (plusDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Adds days to a YYYY-MM-DD date without time-zone drift. */
export const addDaysToDate = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
