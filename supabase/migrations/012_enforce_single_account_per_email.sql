-- Admin accounts can now switch into the Account Officer workspace, so a
-- person should only have one profile/email regardless of role.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
    DROP INDEX IF EXISTS public.idx_profiles_email_role_lower_unique;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        GROUP BY lower(email)
        HAVING count(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower_unique
            ON public.profiles (lower(email));
    ELSE
        RAISE NOTICE 'Skipped idx_profiles_email_lower_unique because duplicate profile emails already exist.';
    END IF;
END;
$$;

UPDATE auth.users
SET email_change = ''
WHERE email_change IS NULL;

DELETE FROM auth.identities
WHERE user_id IN (
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
);

DELETE FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = u.id
);

CREATE OR REPLACE FUNCTION public.delete_auth_user_for_deleted_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    DELETE FROM auth.identities
    WHERE user_id = OLD.id;

    DELETE FROM auth.users
    WHERE id = OLD.id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_auth_user_after_profile_delete ON public.profiles;

CREATE TRIGGER delete_auth_user_after_profile_delete
    AFTER DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.delete_auth_user_for_deleted_profile();

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

    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
        RAISE EXCEPTION 'This email is already assigned to another account.'
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

    UPDATE auth.users
    SET email_change = COALESCE(email_change, '')
    WHERE id = NEW.id;

    RETURN NEW;
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
    WHERE lower(p.username) = lower(trim(p_username))
        AND u.deleted_at IS NULL
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_username(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT email
    FROM public.profiles
    WHERE lower(username) = lower(trim(p_username))
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

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

    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
        RAISE EXCEPTION 'This email is already assigned to another account.'
            USING ERRCODE = '23505';
    END IF;

    DELETE FROM auth.identities
    WHERE user_id IN (
        SELECT u.id
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE lower(u.email) = v_email
            AND p.id IS NULL
    );

    DELETE FROM auth.users u
    WHERE lower(u.email) = v_email
        AND NOT EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = u.id
        );

    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE lower(email) = v_email
            AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'This email is already used by another auth account.'
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
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
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
        '',
        ''
    );

    v_identity_data := jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
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
        USING v_user_id, v_email, v_identity_data, 'email';
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
            AND id <> p_user_id
    ) THEN
        RAISE EXCEPTION 'This email is already assigned to another account.'
            USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE lower(email) = v_email
            AND id <> p_user_id
            AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'This email is already used by another auth account.'
            USING ERRCODE = '23505';
    END IF;

    UPDATE auth.users
    SET
        email = v_email,
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
        email_change = COALESCE(email_change, ''),
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
        USING v_email, p_user_id;
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
        USING v_email, p_user_id;
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
