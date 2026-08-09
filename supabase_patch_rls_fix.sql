-- Phase 6: Row Level Security Recursion and Profile Visibility Fix

-- 1. Create a SECURITY DEFINER helper function to bypass RLS recursion
-- This function runs as superuser to check roles safely without triggering infinite policy loops.
CREATE OR REPLACE FUNCTION public.is_office_staff(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'office_staff'::public.user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing policies to prevent duplicate errors
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile basic info" ON public.profiles;
DROP POLICY IF EXISTS "Allow office staff to manage profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow office staff to read wages" ON public.profile_wages;
DROP POLICY IF EXISTS "Allow office staff to write wages" ON public.profile_wages;

DROP POLICY IF EXISTS "Allow office staff to manage time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow workers to read own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow workers to insert own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow workers to update own time entries" ON public.time_entries;

-- 3. Recreate public.profiles policies
-- A. Allow any logged-in user to see coworker profiles (roster visibility)
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- B. Allow users to update their own basic info (phone, availability)
CREATE POLICY "Allow users to update their own profile basic info" ON public.profiles
    FOR UPDATE TO authenticated 
    USING (id = auth.uid()) 
    WITH CHECK (id = auth.uid());

-- C. Allow office staff full management of all profiles (using the helper to bypass recursion)
CREATE POLICY "Allow office staff to manage profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

-- 4. Recreate public.profile_wages policies (Restricting wage access to admins only)
CREATE POLICY "Allow office staff to read wages" ON public.profile_wages
    FOR SELECT TO authenticated
    USING (public.is_office_staff(auth.uid()));

CREATE POLICY "Allow office staff to write wages" ON public.profile_wages
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

-- 5. Recreate public.time_entries policies
CREATE POLICY "Allow office staff to manage time entries" ON public.time_entries
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

CREATE POLICY "Allow workers to read own time entries" ON public.time_entries
    FOR SELECT TO authenticated
    USING (worker_id = auth.uid());

CREATE POLICY "Allow workers to insert own time entries" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Allow workers to update own time entries" ON public.time_entries
    FOR UPDATE TO authenticated
    USING (worker_id = auth.uid())
    WITH CHECK (worker_id = auth.uid());

-- 6. Reload cache
NOTIFY pgrst, 'reload schema';
