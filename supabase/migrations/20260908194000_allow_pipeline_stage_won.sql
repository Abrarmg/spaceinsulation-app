-- Migration: Add 'won' to leads_pipeline_stage_check constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_pipeline_stage_check;

ALTER TABLE public.leads
ADD CONSTRAINT leads_pipeline_stage_check
CHECK (pipeline_stage IN (
  'new_request',
  'assessment_unscheduled',
  'assessment_scheduled',
  'assessment_completed',
  'quote_draft',
  'awaiting_response',
  'changes_requested',
  'won'
));

NOTIFY pgrst, 'reload schema';
