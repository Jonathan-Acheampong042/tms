-- ============================================================
-- Transport Management System (TMS) - 02_fleet.sql
-- Schema: fleet
-- Tables:    vehicles, maintenance_records, drivers, fuel_records
-- Functions: register_driver
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

CREATE TABLE fleet.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('bus', 'truck', 'van')),
  model VARCHAR(50) NOT NULL,
  year TEXT,
  capacity INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'on_trip', 'maintenance')),
  insurance BOOLEAN NOT NULL DEFAULT TRUE,
  insurance_expiry DATE NOT NULL,
  license_expiry DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE fleet.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES fleet.vehicles(id) ON DELETE RESTRICT,
  description TEXT,
  service_date DATE NOT NULL,
  next_service_date DATE
    CHECK (next_service_date IS NULL OR next_service_date >= service_date),
  cost NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

CREATE TABLE fleet.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES accounts.users(id) ON DELETE RESTRICT,
  license_number VARCHAR(100) UNIQUE NOT NULL,
  license_expiry DATE NOT NULL,
  license_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'on_trip', 'off_duty')),
  vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE SET NULL
);

CREATE TABLE fleet.fuel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES fleet.vehicles(id) ON DELETE RESTRICT,
  driver_id UUID NOT NULL REFERENCES fleet.drivers(id) ON DELETE RESTRICT,
  litres NUMERIC(10,2) NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  station VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (litres > 0 AND cost >= 0)
);

-- ------------------------------------------------------------
-- FUNCTIONS
-- ------------------------------------------------------------

-- register_driver()
-- Attaches a driver profile to an EXISTING user. The user must exist,
-- be active, and have the role 'driver' (create them first with
-- accounts.register_user(..., p_role => 'driver')). Run both calls in
-- ONE transaction so a failure leaves nothing behind.
-- Errors: 'User not found' (P0002), not a driver role / deactivated
-- (P0001), duplicate license number (23505).
CREATE OR REPLACE FUNCTION fleet.register_driver(
  p_user_id UUID,
  p_license_number VARCHAR,
  p_license_expiry DATE
)
RETURNS UUID AS $$
DECLARE
  v_role VARCHAR(20);
  v_active BOOLEAN;
  new_driver_id UUID;
BEGIN
  SELECT role, is_active INTO v_role, v_active
  FROM accounts.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'driver' THEN
    RAISE EXCEPTION 'Only a user with the driver role can have a driver profile';
  END IF;

  IF v_active = FALSE THEN
    RAISE EXCEPTION 'A deactivated user cannot be registered as a driver';
  END IF;

  INSERT INTO fleet.drivers (user_id, license_number, license_expiry)
  VALUES (p_user_id, p_license_number, p_license_expiry)
  RETURNING id INTO new_driver_id;

  RETURN new_driver_id;
END;
$$ LANGUAGE plpgsql;
