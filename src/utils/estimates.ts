// Matches the default terms text customers see ("valid for 30 days").
export const ESTIMATE_VALID_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Validity runs from when the quote was sent; unsent drafts fall back to creation time.
export const getValidUntil = (est: { sent_at?: string | null; created_at: string }) =>
  new Date(new Date(est.sent_at || est.created_at).getTime() + ESTIMATE_VALID_DAYS * DAY_MS);

// Sent estimates sent before this moment are past their validity window.
export const expiredSentBefore = () => new Date(Date.now() - ESTIMATE_VALID_DAYS * DAY_MS).toISOString();
