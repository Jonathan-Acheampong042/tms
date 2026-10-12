-- Read-only projections for API responses.
-- Keep authentication and password-reset secrets out of profile queries.

CREATE OR REPLACE VIEW accounts.user_profiles AS
SELECT
  id,
  username,
  email,
  first_name,
  middle_name,
  last_name,
  phone,
  address,
  role,
  is_active,
  two_factor_enabled,
  created_at
FROM accounts.users;

CREATE OR REPLACE VIEW fleet.driver_details AS
SELECT
  d.id,
  d.user_id,
  d.license_number,
  d.license_expiry,
  d.license_verified,
  d.status,
  d.vehicle_id,
  u.first_name,
  u.middle_name,
  u.last_name,
  u.email,
  u.phone
FROM fleet.drivers d
JOIN accounts.users u ON u.id = d.user_id;
