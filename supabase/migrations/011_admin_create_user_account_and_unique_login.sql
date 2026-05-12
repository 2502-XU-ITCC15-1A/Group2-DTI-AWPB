-- Centralize admin-created accounts behind an RPC and enforce case-insensitive
-- username uniqueness plus role-scoped email uniqueness for profile rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
    DROP INDEX IF EXISTS public.idx_profiles_email_lower_unique;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        GROUP BY lower(username)
        HAVING count(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower_unique
            ON public.profiles (lower(username));
    ELSE
        RAISE NOTICE 'Skipped idx_profiles_username_lower_unique because duplicate usernames already exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        GROUP BY lower(email), role
        HAVING count(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_role_lower_unique
            ON public.profiles (lower(email), role);
    ELSE
        RAISE NOTICE 'Skipped idx_profiles_email_role_lower_unique because duplicate emails already exist within the same role.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_username text := lower(trim(NEW.raw_user_meta_data->>'username'));
    v_email text := lower(trim(NEW.email));
    v_role public.user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'encoder')::public.user_role;
BEGIN
    IF COALESCE(v_username, '') = '' OR COALESCE(v_email, '') = '' THEN
        RAISE EXCEPTION 'Username and email are required.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_username) THEN
        RAISE EXCEPTION 'This username is already assigned to another account.'
            USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE lower(email) = v_email
            AND role = v_role
    ) THEN
        RAISE EXCEPTION 'This email is already assigned to another account with this role.'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.profiles (id, username, full_name, email, role, status)
    VALUES (
        NEW.id,
        v_username,
        COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), v_email),
        v_email,
        v_role,
        'active'
    );

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_role_auth_email(
    p_email text,
    p_username text,
    p_role text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_local text;
    v_domain text;
    v_suffix text;
BEGIN
    v_local := split_part(lower(trim(p_email)), '@', 1);
    v_domain := split_part(lower(trim(p_email)), '@', 2);
    v_suffix := regexp_replace(lower(trim(p_role || '_' || p_username)), '[^a-z0-9]+', '_', 'g');

    IF v_local = '' OR v_domain = '' THEN
        RETURN lower(trim(p_username)) || '+' || lower(trim(p_role)) || '@awpb.local';
    END IF;

    RETURN v_local || '+' || v_suffix || '@' || v_domain;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
    SELECT u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.username = lower(trim(p_username))
        AND u.deleted_at IS NULL
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_username(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_user_account(
    p_username text,
    p_full_name text,
    p_email text,
    p_role text,
    p_password text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_profile public.profiles;
    v_user_id uuid := gen_random_uuid();
    v_username text := lower(trim(p_username));
    v_full_name text := trim(p_full_name);
    v_email text := lower(trim(p_email));
    v_auth_email text;
    v_role public.user_role := p_role::public.user_role;
    v_identity_data jsonb;
    v_identity_id_expr text;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active admins can create user accounts.'
            USING ERRCODE = '42501';
    END IF;

    IF COALESCE(v_username, '') = ''
        OR COALESCE(v_full_name, '') = ''
        OR COALESCE(v_email, '') = ''
        OR COALESCE(p_password, '') = '' THEN
        RAISE EXCEPTION 'Username, full name, email, and password are required.'
            USING ERRCODE = '22023';
    END IF;

    IF length(p_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_username) THEN
        RAISE EXCEPTION 'This username is already assigned to another account.'
            USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE lower(email) = v_email
            AND role = v_role
    ) THEN
        RAISE EXCEPTION 'This email is already assigned to another account with this role.'
            USING ERRCODE = '23505';
    END IF;

    v_auth_email := v_email;

    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE lower(email) = v_auth_email
            AND deleted_at IS NULL
    ) THEN
        v_auth_email := public.build_role_auth_email(v_email, v_username, v_role::text);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE lower(email) = v_auth_email
            AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'This username/email combination is already used by another auth account.'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_auth_email,
        extensions.crypt(p_password, extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
            'username', v_username,
            'full_name', v_full_name,
            'role', v_role::text
        ),
        now(),
        now(),
        '',
        '',
        ''
    );

    v_identity_data := jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_auth_email,
        'email_verified', true,
        'phone_verified', false
    );

    SELECT CASE
        WHEN data_type = 'uuid' THEN 'gen_random_uuid()'
        ELSE quote_literal(v_user_id::text)
    END
    INTO v_identity_id_expr
    FROM information_schema.columns
    WHERE table_schema = 'auth'
        AND table_name = 'identities'
        AND column_name = 'id';

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'auth'
            AND table_name = 'identities'
            AND column_name = 'provider_id'
    ) THEN
        EXECUTE format(
            'INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
             VALUES (%s, $1, $2, $3, $4, now(), now(), now())',
            COALESCE(v_identity_id_expr, 'gen_random_uuid()')
        )
        USING v_user_id, v_auth_email, v_identity_data, 'email';
    ELSE
        EXECUTE format(
            'INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
             VALUES (%s, $1, $2, $3, now(), now(), now())',
            COALESCE(v_identity_id_expr, quote_literal(v_user_id::text))
        )
        USING v_user_id, v_identity_data, 'email';
    END IF;

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile was not created.'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.profiles
    SET email = v_email
    WHERE id = v_user_id
    RETURNING * INTO v_profile;

    RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user_account(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user_account(text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_account(
    p_user_id uuid,
    p_username text,
    p_full_name text,
    p_email text,
    p_role text,
    p_status text,
    p_password text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_profile public.profiles;
    v_username text := lower(trim(p_username));
    v_full_name text := trim(p_full_name);
    v_email text := lower(trim(p_email));
    v_auth_email text;
    v_role public.user_role := p_role::public.user_role;
    v_status public.user_status := p_status::public.user_status;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active admins can update user accounts.'
            USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User id is required.'
            USING ERRCODE = '22023';
    END IF;

    IF COALESCE(v_username, '') = ''
        OR COALESCE(v_full_name, '') = ''
        OR COALESCE(v_email, '') = '' THEN
        RAISE EXCEPTION 'Username, full name, and email are required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_password IS NOT NULL AND p_password <> '' AND length(p_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE lower(username) = v_username
            AND id <> p_user_id
    ) THEN
        RAISE EXCEPTION 'This username is already assigned to another account.'
            USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE lower(email) = v_email
            AND role = v_role
            AND id <> p_user_id
    ) THEN
        RAISE EXCEPTION 'This email is already assigned to another account with this role.'
            USING ERRCODE = '23505';
    END IF;

    v_auth_email := v_email;

    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE lower(email) = v_auth_email
            AND id <> p_user_id
            AND deleted_at IS NULL
    ) THEN
        v_auth_email := public.build_role_auth_email(v_email, v_username, v_role::text);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE lower(email) = v_auth_email
            AND id <> p_user_id
            AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'This username/email combination is already used by another auth account.'
            USING ERRCODE = '23505';
    END IF;

    UPDATE auth.users
    SET
        email = v_auth_email,
        encrypted_password = CASE
            WHEN p_password IS NOT NULL AND p_password <> ''
                THEN extensions.crypt(p_password, extensions.gen_salt('bf'))
            ELSE encrypted_password
        END,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
            jsonb_build_object(
                'username', v_username,
                'full_name', v_full_name,
                'role', v_role::text
            ),
        updated_at = now()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auth user was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'auth'
            AND table_name = 'identities'
            AND column_name = 'identity_data'
    ) THEN
        EXECUTE $identity_update$
            UPDATE auth.identities
            SET
                identity_data = jsonb_set(
                    COALESCE(identity_data, '{}'::jsonb),
                    '{email}',
                    to_jsonb($1::text),
                    true
                ),
                updated_at = now()
            WHERE user_id = $2
                AND provider = 'email'
        $identity_update$
        USING v_auth_email, p_user_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'auth'
            AND table_name = 'identities'
            AND column_name = 'provider_id'
    ) THEN
        EXECUTE $provider_update$
            UPDATE auth.identities
            SET provider_id = $1, updated_at = now()
            WHERE user_id = $2
                AND provider = 'email'
        $provider_update$
        USING v_auth_email, p_user_id;
    END IF;

    UPDATE public.profiles
    SET
        username = v_username,
        full_name = v_full_name,
        email = v_email,
        role = v_role,
        status = v_status
    WHERE id = p_user_id
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_account(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_account(uuid, text, text, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
