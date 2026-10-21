-- Credential verification stays in PostgreSQL. The API receives only the
-- authenticated user's public fields and never reads password_hash.

CREATE OR REPLACE FUNCTION accounts.authenticate_user(
  p_identifier VARCHAR,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  email VARCHAR,
  role VARCHAR
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_username VARCHAR;
  v_email VARCHAR;
  v_role VARCHAR;
  v_password_hash TEXT;
  v_candidate_hash CONSTANT TEXT :=
    '$2a$10$m7eYS3HWCLpjqHVYBt.Spewq0cDURvh8o7Tk2x/6Axf6OE1VhV18S';
  v_password_matches BOOLEAN;
BEGIN
  SELECT u.id, u.username, u.email, u.role, u.password_hash
  INTO v_user_id, v_username, v_email, v_role, v_password_hash
  FROM accounts.users AS u
  WHERE u.is_active = TRUE
    AND (u.username = p_identifier OR u.email = LOWER(p_identifier))
  LIMIT 1;

  v_password_matches :=
    extensions.crypt(p_password, COALESCE(v_password_hash, v_candidate_hash))
      = COALESCE(v_password_hash, v_candidate_hash);

  IF v_user_id IS NOT NULL AND v_password_matches THEN
    RETURN QUERY SELECT v_user_id, v_username, v_email, v_role;
  END IF;
END;
$$;
