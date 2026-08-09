-- SQL Migration Patch: Migrate Estimates to JSONB Line Items (Safe Wrapper)

DO $$ 
BEGIN
    -- 1. Add line_items column to estimates if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema='public' 
          AND table_name='estimates' 
          AND column_name='line_items'
    ) THEN
        ALTER TABLE public.estimates ADD COLUMN line_items JSONB;
    END IF;

    -- 2. Migrate records if extra_work_amount column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema='public' 
          AND table_name='estimates' 
          AND column_name='extra_work_amount'
    ) THEN
        -- Run the migration query using dynamic SQL to avoid parsing compilation errors
        EXECUTE '
            UPDATE public.estimates
            SET line_items = jsonb_build_array(
                jsonb_build_object(
                    ''description'', ''Insulation Services: '' || insulation_type || '' Insulation ('' || home_size || '' sq ft at $'' || to_char(insulation_rate, ''FM999,999.00'') || ''/sq ft)'',
                    ''quantity'', 1,
                    ''unit_price'', home_size * insulation_rate
                )
            ) || 
            CASE 
                WHEN extra_work_amount > 0 THEN 
                    jsonb_build_array(
                        jsonb_build_object(
                            ''description'', coalesce(extra_work_description, ''Supplementary Prep Work''),
                            ''quantity'', 1,
                            ''unit_price'', extra_work_amount
                        )
                    )
                ELSE 
                    ''[]''::jsonb
            END
            WHERE line_items IS NULL;
        ';
        
        -- Drop the old columns
        ALTER TABLE public.estimates DROP COLUMN IF EXISTS extra_work_description;
        ALTER TABLE public.estimates DROP COLUMN IF EXISTS extra_work_amount;
    END IF;
END $$;

-- 3. Add sent_at column to invoices for unified sending logs
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
