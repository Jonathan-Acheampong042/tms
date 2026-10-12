-- Adds the vehicle insurance flag for databases that have already run
-- scripts 00-06. Keep insurance_expiry as a DATE for expiry checks.
ALTER TABLE fleet.vehicles
  ADD COLUMN IF NOT EXISTS insurance BOOLEAN NOT NULL DEFAULT TRUE;
