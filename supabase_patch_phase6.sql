-- Phase 6: Admin-initiated Auth Invitations & Security Definer Function

-- 0. Ensure pgcrypto extension is active for crypt and gen_random_uuid functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create a secure RPC function to register/invite employees
-- This function runs with SECURITY DEFINER (superuser privileges) so it can insert records
-- directly into auth.users and auth.identities, but it strictly checks that the caller
-- holds the 'office_staff' role in public.profiles.
CREATE OR REPLACE FUNCTION public.invite_new_staff_member(
    new_email TEXT,
    new_full_name TEXT,
    new_role TEXT,
    new_phone TEXT DEFAULT NULL,
    new_availability TEXT DEFAULT NULL,
    new_wage NUMERIC DEFAULT 0.00
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- A. Verify that the caller is an authenticated office admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'office_staff'::public.user_role
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only office admin staff can register new credentials.';
    END IF;

    -- B. Verify that the email is not already taken
    IF EXISTS (
        SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(new_email))
    ) THEN
        RAISE EXCEPTION 'User email % is already registered in the system.', new_email;
    END IF;

    -- C. Generate a random UUID for the new account
    new_user_id := gen_random_uuid();

    -- D. Insert the account into auth.users
    -- Set email confirmation to NULL (they must confirm or reset password)
    -- Sets a temp password they must change via 'forgot password' reset link
    INSERT INTO auth.users (
        id, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        invited_at,
        raw_app_meta_data, 
        raw_user_meta_data, 
        role, 
        aud,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        LOWER(TRIM(new_email)),
        crypt('temp_password_change_me_123', gen_salt('bf', 10)),
        now(), -- Auto-confirm email so they can log in immediately after setting password via reset loop
        now(), -- Sets invited_at
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', new_full_name),
        'authenticated',
        'authenticated',
        now(),
        now()
    );

    -- E. Insert matching record into auth.identities
    -- Sets provider_id to UUID (required in newer Supabase schemas)
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        new_user_id,
        jsonb_build_object('sub', new_user_id, 'email', LOWER(TRIM(new_email))),
        'email',
        new_user_id,
        now(),
        now(),
        now()
    );

    -- F. Insert basic information into public.profiles (explicitly casting new_role to user_role enum)
    INSERT INTO public.profiles (
        id,
        full_name,
        role,
        phone,
        availability
    ) VALUES (
        new_user_id,
        new_full_name,
        new_role::public.user_role,
        new_phone,
        new_availability
    );

    -- G. Insert wage rate into public.profile_wages if role is field_worker or office_staff
    IF new_wage > 0 THEN
        INSERT INTO public.profile_wages (
            id,
            hourly_rate
        ) VALUES (
            new_user_id,
            new_wage
        );
    END IF;

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Notify cache reload
NOTIFY pgrst, 'reload schema';
