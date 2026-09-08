-- Migration: Extend public.estimates for Jobber-style quotes

-- Lead / Assessment relationships
ALTER TABLE public.estimates
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,

-- Quote Overview
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS property_address TEXT,

-- Introduction
ADD COLUMN IF NOT EXISTS intro_title TEXT DEFAULT 'Estimate / Scope of Work',
ADD COLUMN IF NOT EXISTS header_image_url TEXT,

-- Pricing
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0.13,

-- Deposit
ADD COLUMN IF NOT EXISTS deposit_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS deposit_value NUMERIC DEFAULT 0,

-- Customer price visibility
ADD COLUMN IF NOT EXISTS client_view_settings JSONB DEFAULT '{"show_quantity": true, "show_unit_price": true, "show_line_item_totals": true, "show_total": true}'::jsonb,

-- Customer communication
ADD COLUMN IF NOT EXISTS client_message TEXT,
ADD COLUMN IF NOT EXISTS contract_disclaimer TEXT,
ADD COLUMN IF NOT EXISTS terms TEXT,

-- Future customer interaction
ADD COLUMN IF NOT EXISTS client_signature_url TEXT,
ADD COLUMN IF NOT EXISTS client_selected_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS change_request_notes TEXT;

-- Constraints: discount_type and deposit_type checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estimates_discount_type_check'
  ) THEN
    ALTER TABLE public.estimates
    ADD CONSTRAINT estimates_discount_type_check
    CHECK (discount_type IN ('none', 'percentage', 'fixed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estimates_deposit_type_check'
  ) THEN
    ALTER TABLE public.estimates
    ADD CONSTRAINT estimates_deposit_type_check
    CHECK (deposit_type IN ('none', 'percentage', 'fixed'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_estimates_lead_id ON public.estimates(lead_id);
CREATE INDEX IF NOT EXISTS idx_estimates_assessment_id ON public.estimates(assessment_id);

NOTIFY pgrst, 'reload schema';
