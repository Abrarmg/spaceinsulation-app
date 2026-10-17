// Matches the default terms text customers see ("valid for 30 days").
export const ESTIMATE_VALID_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Validity runs from when the quote was sent; unsent drafts fall back to creation time.
export const getValidUntil = (est: { sent_at?: string | null; created_at: string }) =>
  new Date(new Date(est.sent_at || est.created_at).getTime() + ESTIMATE_VALID_DAYS * DAY_MS);

// Sent estimates sent before this moment are past their validity window.
export const expiredSentBefore = () => new Date(Date.now() - ESTIMATE_VALID_DAYS * DAY_MS).toISOString();

export const FOLLOWUP_AFTER_DAYS = 3;
export const FOLLOWUP_URGENT_DAYS = 7;

interface TrackedEstimate {
  status: string;
  sent_at?: string | null;
  created_at: string;
  last_followup_at?: string | null;
}

// Days since the customer last heard from us (send or follow-up), for Sent quotes still within validity.
export const daysWaiting = (est: TrackedEstimate): number | null => {
  if (est.status !== 'Sent' || !est.sent_at) return null;
  if (getValidUntil(est).getTime() < Date.now()) return null;
  const last = Math.max(new Date(est.sent_at).getTime(), est.last_followup_at ? new Date(est.last_followup_at).getTime() : 0);
  return Math.floor((Date.now() - last) / DAY_MS);
};

export const needsFollowUp = (est: TrackedEstimate) => {
  const d = daysWaiting(est);
  return d !== null && d >= FOLLOWUP_AFTER_DAYS;
};

export const followUpCutoff = () => new Date(Date.now() - FOLLOWUP_AFTER_DAYS * DAY_MS).toISOString();

export const relativeTime = (iso: string) => {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};
