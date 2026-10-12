-- ============================================================
-- 08_trip_insurance_check.sql  (migration, run in pgAdmin)
-- For databases built BEFORE the trip insurance check existed.
-- Replaces operations.validate_trip_assignment() so a vehicle with
-- insurance = FALSE cannot be assigned to a trip.
-- The trigger stays attached, and no data is changed.
-- A fresh build does not need this file: 03_operations.sql already
-- contains the same function.
-- ============================================================

-- 1. validate_trip_assignment()
-- Rejects a trip when the vehicle or driver is not allowed to go.
-- A vehicle must be flagged as insured, and its insurance and license
-- must not expire before the trip starts (checked against the expiry DATES).
CREATE OR REPLACE FUNCTION operations.validate_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_status VARCHAR(20);
  v_insured BOOLEAN;
  v_insurance DATE;
  v_license DATE;
  d_status VARCHAR(20);
  d_license DATE;
  d_verified BOOLEAN;
BEGIN
  SELECT status, insurance, insurance_expiry, license_expiry
  INTO v_status, v_insured, v_insurance, v_license
  FROM fleet.vehicles
  WHERE id = NEW.vehicle_id;

  SELECT status, license_expiry, license_verified
  INTO d_status, d_license, d_verified
  FROM fleet.drivers
  WHERE id = NEW.driver_id;

  IF v_status = 'maintenance' THEN
    RAISE EXCEPTION 'Vehicle is under maintenance and cannot be assigned to a trip';
  END IF;

  IF v_insured = FALSE THEN
    RAISE EXCEPTION 'Vehicle has no insurance and cannot be assigned to a trip';
  END IF;

  IF v_insurance < NEW.scheduled_start::DATE THEN
    RAISE EXCEPTION 'Vehicle insurance expires before the trip starts';
  END IF;

  IF v_license < NEW.scheduled_start::DATE THEN
    RAISE EXCEPTION 'Vehicle license expires before the trip starts';
  END IF;

  IF d_status = 'off_duty' THEN
    RAISE EXCEPTION 'Driver is off duty and cannot be assigned to a trip';
  END IF;

  IF d_verified = FALSE THEN
    RAISE EXCEPTION 'Driver license has not been verified';
  END IF;

  IF d_license < NEW.scheduled_start::DATE THEN
    RAISE EXCEPTION 'Driver license expires before the trip starts';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
