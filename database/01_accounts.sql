-- ============================================================
-- Transport Management System (TMS) - 01_accounts.sql
-- Schema: accounts
-- Tables:    users
-- Functions: register_user, get_user_for_login, update_user_profile,
--            deactivate_user, request_password_reset, get_active_reset,
--            record_failed_reset_attempt, complete_password_reset
-- (register_driver lives in the fleet schema, see 02_fleet.sql)
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

CREATE TABLE accounts.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'driver', 'customer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Point 1: OTP Fields on Users table (no hash, direct OTP)
  otp VARCHAR(100) DEFAULT NULL,
  otp_attempts INT NOT NULL DEFAULT 0,
  otp_expires_at TIMESTAMP DEFAULT NULL
);


-- ------------------------------------------------------------
-- FUNCTIONS
-- ------------------------------------------------------------

-- 1. register_user()
-- Creates a user and returns the new user id.
CREATE OR REPLACE FUNCTION accounts.register_user(
  p_username VARCHAR,
  p_email VARCHAR,
  p_password VARCHAR,
  p_first_name VARCHAR,
  p_last_name VARCHAR,
  p_middle_name VARCHAR DEFAULT NULL,
  p_phone VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_role VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  INSERT INTO accounts.users
    (username, email, password_hash, first_name, middle_name, last_name, phone, address, role)
  VALUES
    (p_username, LOWER(p_email), extensions.crypt(p_password, extensions.gen_salt('bf', 10)), p_first_name, p_middle_name, p_last_name, p_phone, p_address, COALESCE(p_role, 'customer'))
  RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;


-- 2. get_user_for_login()
-- Point 2: Login type parameter to differentiate between standard login and reset
CREATE OR REPLACE FUNCTION accounts.get_user_for_login(
  p_identifier VARCHAR,
  p_login_type VARCHAR DEFAULT 'login'
)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  email VARCHAR,
  password_hash TEXT,
  role VARCHAR,
  two_factor_enabled BOOLEAN,
  otp_valid BOOLEAN
) AS $$
  SELECT
    u.id,
    u.username,
    u.email,
    u.password_hash,
    u.role,
    u.two_factor_enabled,
    CASE
      WHEN p_login_type = 'reset' THEN (u.otp IS NOT NULL AND u.otp_expires_at > NOW() AND u.otp_attempts < 5)
      ELSE TRUE
    END AS otp_valid
  FROM accounts.users u
  WHERE u.is_active = TRUE
    AND (u.username = p_identifier OR u.email = LOWER(p_identifier))
  LIMIT 1;
$$ LANGUAGE sql STABLE;


-- 3. update_user_profile()
CREATE OR REPLACE FUNCTION accounts.update_user_profile(
  p_user_id UUID,
  p_first_name VARCHAR DEFAULT NULL,
  p_middle_name VARCHAR DEFAULT NULL,
  p_last_name VARCHAR DEFAULT NULL,
  p_phone VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE accounts.users
  SET first_name = COALESCE(p_first_name, first_name),
      middle_name = CASE
                      WHEN p_middle_name IS NULL THEN middle_name
                      ELSE NULLIF(p_middle_name, '')
                    END,
      last_name = COALESCE(p_last_name, last_name),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- 4. deactivate_user()
CREATE OR REPLACE FUNCTION accounts.deactivate_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE accounts.users
  SET is_active = FALSE
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE fleet.drivers
  SET status = 'off_duty'
  WHERE user_id = p_user_id
    AND status = 'available';
END;
$$ LANGUAGE plpgsql;


-- 5. request_password_reset()
-- Point 1: directly records OTP (unhashed) on user record
CREATE OR REPLACE FUNCTION accounts.request_password_reset(
  p_email VARCHAR,
  p_otp VARCHAR
)
RETURNS UUID AS $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id
  FROM accounts.users
  WHERE email = LOWER(p_email)
    AND is_active = TRUE;

  IF target_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE accounts.users
  SET otp = p_otp,
      otp_attempts = 0,
      otp_expires_at = NOW() + INTERVAL '10 minutes'
  WHERE id = target_id;

  RETURN target_id;
END;
$$ LANGUAGE plpgsql;


-- 6. get_active_reset()
-- Point 1: checks direct OTP directly from users table
CREATE OR REPLACE FUNCTION accounts.get_active_reset(p_email VARCHAR)
RETURNS TABLE (
  reset_user_id UUID,
  otp VARCHAR,
  otp_attempts INT
) AS $$
  SELECT u.id, u.otp, u.otp_attempts
  FROM accounts.users u
  WHERE u.email = LOWER(p_email)
    AND u.is_active = TRUE
    AND u.otp IS NOT NULL
    AND u.otp_expires_at > NOW()
    AND u.otp_attempts < 5
  LIMIT 1;
$$ LANGUAGE sql STABLE;


-- 7. record_failed_reset_attempt()
CREATE OR REPLACE FUNCTION accounts.record_failed_reset_attempt(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  new_attempts INT;
BEGIN
  UPDATE accounts.users
  SET otp_attempts = otp_attempts + 1
  WHERE id = p_user_id
  RETURNING otp_attempts INTO new_attempts;

  RETURN new_attempts;
END;
$$ LANGUAGE plpgsql;


-- 8. complete_password_reset()
-- The caller must supply the OTP. It is checked here, so a password
-- cannot be changed just by knowing the user id. Raises an error if
-- the code is wrong, expired, or locked (5 failed attempts).
-- When it fails, the application should call record_failed_reset_attempt().
CREATE OR REPLACE FUNCTION accounts.complete_password_reset(
  p_user_id UUID,
  p_otp VARCHAR,
  p_new_password VARCHAR
)
RETURNS VOID AS $$
BEGIN
  UPDATE accounts.users
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      otp = NULL,
      otp_attempts = 0,
      otp_expires_at = NULL
  WHERE id = p_user_id
    AND otp IS NOT NULL
    AND otp = p_otp
    AND otp_expires_at > NOW()
    AND otp_attempts < 5;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reset code is invalid or expired';
  END IF;
END;
$$ LANGUAGE plpgsql;
