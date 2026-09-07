-- Add pipeline_stage column to public.leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new_request';

-- Add check constraint for allowed pipeline stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_pipeline_stage_check'
  ) THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_pipeline_stage_check
    CHECK (pipeline_stage IN (
      'new_request',
      'assessment_unscheduled',
      'assessment_scheduled',
      'assessment_completed',
      'quote_draft',
      'awaiting_response',
      'changes_requested'
    ));
  END IF;
END $$;

-- Create index on pipeline_stage
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON public.leads(pipeline_stage);

-- Ensure all existing leads have new_request
UPDATE public.leads
SET pipeline_stage = 'new_request'
WHERE pipeline_stage IS NULL;

-- Reload postgrest schema cache
NOTIFY pgrst, 'reload schema';
