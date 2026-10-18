-- Optional custom colour for a job's calendar card (a palette key such as 'blue'); NULL = status colour.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS color TEXT;

NOTIFY pgrst, 'reload schema';
