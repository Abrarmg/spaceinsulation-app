-- Migration: Add Stripe columns to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_checkout_url TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS duplicate_payment_flagged BOOLEAN DEFAULT FALSE;
