-- ============================================================
-- Transport Management System (TMS) - 15_database_rules.sql
-- Rules that the API used to enforce in JavaScript. They live in
-- the database now, so every client gets them.
--   1. users: valid email and non-blank names
--   2. trips: status can only move forward
--   3. fleet.verify_driver(): the only way a license becomes verified
-- Run after 14_admin_registration.sql.
-- ============================================================


-- 1. Email format and non-blank names (error 23514 when broken).
-- If rows that break the rule already exist, fix or delete them first.
ALTER TABLE accounts.users
  ADD CONSTRAINT users_email_format
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  ADD CONSTRAINT users_names_not_blank
    CHECK (btrim(first_name) <> '' AND btrim(last_name) <> '');


-- 2. Trip status can only move forward:
--    scheduled -> in_progress -> completed, and cancelled from either.
--    completed and cancelled trips are final. Raises P0001 (HTTP 400).
CREATE OR REPLACE FUNCTION operations.validate_trip_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
       (OLD.status = 'scheduled'   AND NEW.status IN ('in_progress', 'cancelled'))
    OR (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'A % trip cannot change to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_trip_status_change ON operations.trips;
CREATE TRIGGER trg_validate_trip_status_change
BEFORE UPDATE OF status ON operations.trips
FOR EACH ROW EXECUTE FUNCTION operations.validate_trip_status_change();


-- 3. verify_driver(id): marks the driver's license as verified and returns
-- the driver, or no rows if the id does not exist.
CREATE OR REPLACE FUNCTION fleet.verify_driver(p_driver_id UUID)
RETURNS SETOF fleet.driver_details AS $$
  UPDATE fleet.drivers SET license_verified = TRUE WHERE id = p_driver_id;
  SELECT * FROM fleet.driver_details WHERE id = p_driver_id;
$$ LANGUAGE sql;
