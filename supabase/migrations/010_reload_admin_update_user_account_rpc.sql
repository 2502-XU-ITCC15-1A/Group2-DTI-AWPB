-- Re-apply the admin account update RPC in a fresh migration so deployed
-- Supabase projects that already recorded migration 009 will still create or
-- refresh the function and PostgREST schema cache.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
SET search_path = public, auth
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

    IF v_username = '' OR v_full_name = '' OR v_email = '' THEN
        RAISE EXCEPTION 'Username, full name, and email are required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_password IS NOT NULL AND p_password <> '' AND length(p_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters.'
            USING ERRCODE = '22023';
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
