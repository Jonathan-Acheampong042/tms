-- Public administrator registration adapter. The application currently
-- permits self-registration for every role; do not expose it to untrusted users.

CREATE OR REPLACE FUNCTION accounts.create_admin(p_user JSONB)
RETURNS SETOF accounts.user_profiles
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF jsonb_typeof(p_user) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'User data must be a JSON object'
      USING ERRCODE = 'P0001';
  END IF;

  v_user_id := accounts.register_user(
    p_user->>'username',
    p_user->>'email',
    p_user->>'password',
    p_user->>'first_name',
    p_user->>'last_name',
    p_user->>'middle_name',
    p_user->>'phone',
    p_user->>'address',
    'admin'
  );

  RETURN QUERY
  SELECT profile.*
  FROM accounts.user_profiles AS profile
  WHERE profile.id = v_user_id;
END;
$$;
