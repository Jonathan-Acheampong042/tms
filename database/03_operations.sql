-- ============================================================
-- Transport Management System (TMS) - 03_operations.sql
-- Schema: operations
-- Tables:    routes, trips, driver_incidents, bookings
-- Functions: validate_trip_assignment, set_trip_times, sync_trip_status
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

CREATE TABLE operations.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  distance NUMERIC(10,2),
  duration INTERVAL
);

CREATE TABLE operations.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES operations.routes(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES fleet.vehicles(id) ON DELETE RESTRICT,
  driver_id UUID NOT NULL REFERENCES fleet.drivers(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  location TEXT,
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP
    CHECK (scheduled_end IS NULL OR scheduled_end >= scheduled_start),
  actual_start TIMESTAMP,
  actual_end TIMESTAMP
);

CREATE TABLE operations.driver_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES fleet.drivers(id) ON DELETE RESTRICT,
  trip_id UUID REFERENCES operations.trips(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  incident_date DATE NOT NULL,
  severity VARCHAR(30) NOT NULL
    CHECK (severity IN ('low', 'medium', 'high'))
);

CREATE TABLE operations.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES operations.trips(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES accounts.users(id) ON DELETE RESTRICT,
  booking_type VARCHAR(20) NOT NULL
    CHECK (booking_type IN ('passenger', 'cargo')),
  weight NUMERIC(10,2),
  pickup VARCHAR(100) NOT NULL,
  dropoff VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'allocated', 'dispatched', 'completed', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------

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

DROP TRIGGER IF EXISTS trg_validate_trip_assignment ON operations.trips;
CREATE TRIGGER trg_validate_trip_assignment
BEFORE INSERT OR UPDATE OF vehicle_id, driver_id, scheduled_start ON operations.trips
FOR EACH ROW EXECUTE FUNCTION operations.validate_trip_assignment();


-- 2. set_trip_times()
CREATE OR REPLACE FUNCTION operations.set_trip_times()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND NEW.actual_start IS NULL THEN
    NEW.actual_start := NOW();
  END IF;

  IF NEW.status = 'completed' AND NEW.actual_end IS NULL THEN
    NEW.actual_end := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_trip_times ON operations.trips;
CREATE TRIGGER trg_set_trip_times
BEFORE INSERT OR UPDATE OF status ON operations.trips
FOR EACH ROW EXECUTE FUNCTION operations.set_trip_times();


-- 3. sync_trip_status()
CREATE OR REPLACE FUNCTION operations.sync_trip_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' THEN
    UPDATE fleet.vehicles SET status = 'on_trip' WHERE id = NEW.vehicle_id;
    UPDATE fleet.drivers  SET status = 'on_trip' WHERE id = NEW.driver_id;
  ELSIF NEW.status IN ('completed', 'cancelled') THEN
    UPDATE fleet.vehicles SET status = 'available'
    WHERE id = NEW.vehicle_id AND status = 'on_trip';

    UPDATE fleet.drivers SET status = 'available'
    WHERE id = NEW.driver_id AND status = 'on_trip';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_trip_status ON operations.trips;
CREATE TRIGGER trg_sync_trip_status
AFTER INSERT OR UPDATE OF status ON operations.trips
FOR EACH ROW EXECUTE FUNCTION operations.sync_trip_status();