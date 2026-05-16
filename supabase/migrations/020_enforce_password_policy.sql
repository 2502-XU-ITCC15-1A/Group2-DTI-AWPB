-- Enforce the same password policy in admin-managed account RPCs that the
-- frontend applies in create/edit/reset password forms.

CREATE OR REPLACE FUNCTION public.validate_password_policy(p_password text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF COALESCE(p_password, '') = '' THEN
        RAISE EXCEPTION 'Password is required.'
            USING ERRCODE = '22023';
    END IF;

    IF length(p_password) < 8
        OR p_password !~ '[A-Z]'
        OR p_password !~ '[a-z]'
        OR p_password !~ '[0-9]'
        OR p_password !~ '[^A-Za-z0-9[:space:]]' THEN
        RAISE EXCEPTION 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
            USING ERRCODE = '22023';
    END IF;
END;
$$;

DO $$
BEGIN
    IF to_regprocedure('public.admin_create_user_account(text,text,text,text,text)') IS NOT NULL
        AND to_regprocedure('public.admin_create_user_account_without_password_policy(text,text,text,text,text)') IS NULL THEN
        ALTER FUNCTION public.admin_create_user_account(text, text, text, text, text)
            RENAME TO admin_create_user_account_without_password_policy;
    END IF;

    IF to_regprocedure('public.admin_update_user_account(uuid,text,text,text,text,text,text)') IS NOT NULL
        AND to_regprocedure('public.admin_update_user_account_without_password_policy(uuid,text,text,text,text,text,text)') IS NULL THEN
        ALTER FUNCTION public.admin_update_user_account(uuid, text, text, text, text, text, text)
            RENAME TO admin_update_user_account_without_password_policy;
    END IF;
END;
$$;

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
SET search_path = public
AS $$
BEGIN
    PERFORM public.validate_password_policy(p_password);

    RETURN public.admin_create_user_account_without_password_policy(
        p_username,
        p_full_name,
        p_email,
        p_role,
        p_password
    );
END;
$$;

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
SET search_path = public
AS $$
BEGIN
    IF p_password IS NOT NULL AND p_password <> '' THEN
        PERFORM public.validate_password_policy(p_password);
    END IF;

    RETURN public.admin_update_user_account_without_password_policy(
        p_user_id,
        p_username,
        p_full_name,
        p_email,
        p_role,
        p_status,
        p_password
    );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_password_policy(text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_create_user_account_without_password_policy(text, text, text, text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_user_account_without_password_policy(uuid, text, text, text, text, text, text)
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_create_user_account(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user_account(text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_user_account(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_account(uuid, text, text, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
