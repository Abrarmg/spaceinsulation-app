-- Add start_time and end_time to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Reload postgrest schema
NOTIFY pgrst, 'reload schema';
