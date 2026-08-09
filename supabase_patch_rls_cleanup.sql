-- Phase 6: Clean Up All Leftover and Conflicting RLS Policies on profiles & wages

-- 1. Disable RLS temporarily to clean up policies cleanly
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_wages DISABLE ROW LEVEL SECURITY;

-- 2. Drop every possible policy name that could exist on profiles and profile_wages
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile basic info" ON public.profiles;
DROP POLICY IF EXISTS "Allow office staff to manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to select their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

DROP POLICY IF EXISTS "Allow office staff to read wages" ON public.profile_wages;
DROP POLICY IF EXISTS "Allow office staff to write wages" ON public.profile_wages;
DROP POLICY IF EXISTS "Allow users to view their own wage" ON public.profile_wages;
DROP POLICY IF EXISTS "Allow users to view their own wages" ON public.profile_wages;
DROP POLICY IF EXISTS "wages_select_policy" ON public.profile_wages;

-- 3. Re-enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_wages ENABLE ROW LEVEL SECURITY;

-- 4. Create the helper function if not already present
CREATE OR REPLACE FUNCTION public.is_office_staff(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'office_staff'::public.user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create ONLY the correct, non-conflicting policies on public.profiles
-- A. Allow any logged-in user to select/read profiles (so roster loads correctly for everyone)
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- B. Allow users to update their own basic info (phone, availability)
CREATE POLICY "Allow users to update their own profile basic info" ON public.profiles
    FOR UPDATE TO authenticated 
    USING (id = auth.uid()) 
    WITH CHECK (id = auth.uid());

-- C. Allow office staff full insert/update/delete management of all profiles (using the helper to bypass recursion)
CREATE POLICY "Allow office staff to manage profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

-- 6. Create ONLY the correct, non-conflicting policies on public.profile_wages
-- A. Allow office staff to select/read wages
CREATE POLICY "Allow office staff to read wages" ON public.profile_wages
    FOR SELECT TO authenticated
    USING (public.is_office_staff(auth.uid()));

-- B. Allow office staff to write/insert/update/delete wages
CREATE POLICY "Allow office staff to write wages" ON public.profile_wages
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

-- 7. Rebuild Postgrest schema cache
NOTIFY pgrst, 'reload schema';
