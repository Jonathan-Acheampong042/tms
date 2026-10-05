-- ============================================================
-- Transport Management System (TMS) - user data functions
-- Run AFTER schema.sql. Does not change any table.
-- Safe to re-run (CREATE OR REPLACE).
--
-- Passwords and OTP codes are hashed in Node with bcrypt.
-- These functions only ever receive and store HASHES.
-- ============================================================


-- ------------------------------------------------------------
-- 1. register_user()
-- Creates a user and returns the new user id.
-- Email is stored in lower case so lookups are not case sensitive.
-- Duplicate username/email raises error 23505 (unique violation).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_user(
  p_username VARCHAR,
  p_email VARCHAR,
  p_password_hash TEXT,
  p_full_name VARCHAR,
  p_phone VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_role VARCHAR DEFAULT 'customer'
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  INSERT INTO users (username, email, password_hash, full_name, phone, address, role)
  VALUES (p_username, LOWER(p_email), p_password_hash, p_full_name, p_phone, p_address, p_role)
  RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 2. register_driver()
-- Creates the user (role 'driver') AND the drivers row together.
-- If either insert fails, both are rolled back, so you never get
-- a driver user without a driver profile.
-- Returns the new driver id.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_driver(
  p_username VARCHAR,
  p_email VARCHAR,
  p_password_hash TEXT,
  p_full_name VARCHAR,
  p_license_number VARCHAR,
  p_license_expiry DATE,
  p_phone VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
  new_driver_id UUID;
BEGIN
  new_user_id := register_user(
    p_username, p_email, p_password_hash, p_full_name, p_phone, p_address, 'driver'
  );

  INSERT INTO drivers (user_id, license_number, license_expiry)
  VALUES (new_user_id, p_license_number, p_license_expiry)
  RETURNING id INTO new_driver_id;

  RETURN new_driver_id;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 3. get_user_for_login()
-- Finds an ACTIVE user by username or email and returns the data
-- Node needs to check the password with bcrypt.compare().
-- Returns no rows if the user does not exist or is deactivated.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_for_login(p_identifier VARCHAR)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  email VARCHAR,
  password_hash TEXT,
  role VARCHAR,
  two_factor_enabled BOOLEAN
) AS $$
  SELECT u.id, u.username, u.email, u.password_hash, u.role, u.two_factor_enabled
  FROM users u
  WHERE u.is_active = TRUE
    AND (u.username = p_identifier OR u.email = LOWER(p_identifier))
  LIMIT 1;
$$ LANGUAGE sql STABLE;


-- ------------------------------------------------------------
-- 4. update_user_profile()
-- Updates name, phone and address. A NULL argument keeps the
-- current value. Raises 'User not found' (error code P0002)
-- when the id does not exist.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_full_name VARCHAR DEFAULT NULL,
  p_phone VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET full_name = COALESCE(p_full_name, full_name),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 5. deactivate_user()
-- Users with history cannot be deleted (ON DELETE RESTRICT), so
-- they are deactivated instead. If the user is a driver who is
-- 'available', the driver is also set to 'off_duty' so no new
-- trip can be assigned to them.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION deactivate_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET is_active = FALSE
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE drivers
  SET status = 'off_duty'
  WHERE user_id = p_user_id
    AND status = 'available';
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 6. request_password_reset()
-- Node generates the OTP, hashes it, and passes the hash here.
-- Old unused codes for the user are cancelled and a new one is
-- stored (it expires in 10 minutes by the table default).
-- Returns the user id, or NULL if no active user has that email.
-- Node must give the SAME reply to the visitor either way.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION request_password_reset(
  p_email VARCHAR,
  p_otp_hash TEXT
)
RETURNS UUID AS $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id
  FROM users
  WHERE email = LOWER(p_email)
    AND is_active = TRUE;

  IF target_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE password_resets
  SET used = TRUE
  WHERE user_id = target_id
    AND used = FALSE;

  INSERT INTO password_resets (user_id, otp_hash)
  VALUES (target_id, p_otp_hash);

  RETURN target_id;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 7. get_active_reset()
-- Returns the newest reset request for this email that is unused,
-- not expired, and has fewer than 5 wrong attempts. Node then
-- compares the OTP the user typed with otp_hash using bcrypt.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_active_reset(p_email VARCHAR)
RETURNS TABLE (
  reset_id UUID,
  reset_user_id UUID,
  otp_hash TEXT,
  attempts INT
) AS $$
  SELECT pr.id, pr.user_id, pr.otp_hash, pr.attempts
  FROM password_resets pr
  JOIN users u ON u.id = pr.user_id
  WHERE u.email = LOWER(p_email)
    AND pr.used = FALSE
    AND pr.expires_at > NOW()
    AND pr.attempts < 5
  ORDER BY pr.expires_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;


-- ------------------------------------------------------------
-- 8. record_failed_reset_attempt()
-- Call this when the typed OTP does not match. Adds 1 to attempts
-- and returns the new count. After 5, get_active_reset() stops
-- returning the request, which locks it.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_failed_reset_attempt(p_reset_id UUID)
RETURNS INT AS $$
DECLARE
  new_attempts INT;
BEGIN
  UPDATE password_resets
  SET attempts = attempts + 1
  WHERE id = p_reset_id
  RETURNING attempts INTO new_attempts;

  RETURN new_attempts;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 9. complete_password_reset()
-- Call this after Node has confirmed the OTP is correct.
-- Marks the request used and saves the new password HASH.
-- Raises an error if the request is already used or expired.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_password_reset(
  p_reset_id UUID,
  p_new_password_hash TEXT
)
RETURNS VOID AS $$
DECLARE
  target_id UUID;
BEGIN
  UPDATE password_resets
  SET used = TRUE
  WHERE id = p_reset_id
    AND used = FALSE
    AND expires_at > NOW()
  RETURNING user_id INTO target_id;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Reset code is invalid or expired';
  END IF;

  UPDATE users
  SET password_hash = p_new_password_hash
  WHERE id = target_id;
END;
$$ LANGUAGE plpgsql;