-- Track when customers open their quote link and when the office last followed up.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ;

-- Supports the "needs follow-up" query on sent quotes.
CREATE INDEX IF NOT EXISTS idx_estimates_status_sent_at ON public.estimates(status, sent_at);

NOTIFY pgrst, 'reload schema';
