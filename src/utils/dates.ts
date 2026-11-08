/** Today's date (optionally shifted by a number of days) as YYYY-MM-DD in the user's time zone. */
export const todayLocal = (plusDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
