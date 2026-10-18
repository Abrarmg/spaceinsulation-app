-- When the customer was last emailed an appointment confirmation / day-before reminder for a job.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
