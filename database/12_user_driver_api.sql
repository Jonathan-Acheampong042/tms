-- JSON request adapters keep request-field mapping in PostgreSQL.
-- Existing account and driver functions continue to enforce table rules.

CREATE OR REPLACE FUNCTION accounts.create_customer(p_user JSONB)
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
    'customer'
  );

  RETURN QUERY
  SELECT profile.*
  FROM accounts.user_profiles AS profile
  WHERE profile.id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION accounts.update_user_profile_json(
  p_user_id UUID,
  p_profile JSONB
)
RETURNS SETOF accounts.user_profiles
LANGUAGE plpgsql
AS $$
BEGIN
  IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Profile data must be a JSON object'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE accounts.users AS account
  SET first_name = CASE
        WHEN p_profile ? 'first_name'
          THEN COALESCE(NULLIF(btrim(p_profile->>'first_name'), ''), account.first_name)
        ELSE account.first_name
      END,
      middle_name = CASE
        WHEN p_profile ? 'middle_name'
          THEN NULLIF(btrim(p_profile->>'middle_name'), '')
        ELSE account.middle_name
      END,
      last_name = CASE
        WHEN p_profile ? 'last_name'
          THEN COALESCE(NULLIF(btrim(p_profile->>'last_name'), ''), account.last_name)
        ELSE account.last_name
      END,
      phone = CASE
        WHEN p_profile ? 'phone'
          THEN NULLIF(btrim(p_profile->>'phone'), '')
        ELSE account.phone
      END,
      address = CASE
        WHEN p_profile ? 'address'
          THEN NULLIF(btrim(p_profile->>'address'), '')
        ELSE account.address
      END
  WHERE account.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT profile.*
  FROM accounts.user_profiles AS profile
  WHERE profile.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION fleet.create_driver(p_driver JSONB)
RETURNS SETOF fleet.driver_details
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_driver_id UUID;
BEGIN
  IF jsonb_typeof(p_driver) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Driver data must be a JSON object'
      USING ERRCODE = 'P0001';
  END IF;

  v_user_id := accounts.register_user(
    p_driver->>'username',
    p_driver->>'email',
    p_driver->>'password',
    p_driver->>'first_name',
    p_driver->>'last_name',
    p_driver->>'middle_name',
    p_driver->>'phone',
    p_driver->>'address',
    'driver'
  );

  v_driver_id := fleet.register_driver(
    v_user_id,
    p_driver->>'license_number',
    (p_driver->>'license_expiry')::DATE
  );

  RETURN QUERY
  SELECT detail.*
  FROM fleet.driver_details AS detail
  WHERE detail.id = v_driver_id;
END;
$$;
