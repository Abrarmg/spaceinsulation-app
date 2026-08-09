-- Phase 6: Add User Status Column & Auto-Update Login Trigger

-- 1. Add status column to public.profiles table (defaults to 'invited')
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'invited';

-- 2. Set existing seeded users to 'active'
UPDATE public.profiles 
SET status = 'active' 
WHERE id IN ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');

-- 3. Create a SECURITY DEFINER trigger function on auth.users
-- This function automatically transitions a user's status in public.profiles
-- from 'invited' to 'active' upon their first successful login (when last_sign_in_at is set).
CREATE OR REPLACE FUNCTION public.handle_user_login_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_sign_in_at IS NOT NULL AND (OLD.last_sign_in_at IS NULL OR OLD.last_sign_in_at <> NEW.last_sign_in_at) THEN
        UPDATE public.profiles
        SET status = 'active'
        WHERE id = NEW.id AND status = 'invited';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on auth.users (re-creating it cleanly)
DROP TRIGGER IF EXISTS on_auth_user_login_status ON auth.users;

CREATE TRIGGER on_auth_user_login_status
    AFTER UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_login_status_transition();

-- 5. Reload Postgrest schema cache
NOTIFY pgrst, 'reload schema';
