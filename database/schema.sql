-- ============================================================
-- Transport Management System (TMS) - database schema
-- Database: PostgreSQL 13+ (gen_random_uuid() is built in)
-- Run in order: each table only references tables above it.
-- ============================================================

-- To rebuild from scratch, uncomment this block first.
-- WARNING: it deletes all data in these tables.
--
-- DROP TABLE IF EXISTS audit_logs;
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS payments;
-- DROP TABLE IF EXISTS invoices;
-- DROP TABLE IF EXISTS bookings;
-- DROP TABLE IF EXISTS fuel_records;
-- DROP TABLE IF EXISTS driver_incidents;
-- DROP TABLE IF EXISTS trips;
-- DROP TABLE IF EXISTS routes;
-- DROP TABLE IF EXISTS drivers;
-- DROP TABLE IF EXISTS maintenance_records;
-- DROP TABLE IF EXISTS vehicles;
-- DROP TABLE IF EXISTS password_resets;
-- DROP TABLE IF EXISTS users;


-- 1. users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'driver', 'customer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. password_resets
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. vehicles
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('bus', 'truck', 'van')),
  model VARCHAR(50) NOT NULL,
  year TEXT, -- age of the vehicle
  capacity INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'on_trip', 'maintenance')),
  insurance_expiry DATE NOT NULL,
  license_expiry DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. maintenance_records
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  description TEXT,
  service_date DATE NOT NULL,
  next_service_date DATE
    CHECK (next_service_date IS NULL OR next_service_date >= service_date),
  cost NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

-- 5. drivers
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  license_number VARCHAR(100) UNIQUE NOT NULL,
  license_expiry DATE NOT NULL,
  license_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'on_trip', 'off_duty')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL
);

-- 6. routes
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- user option
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  distance NUMERIC(10,2),
  duration INTERVAL
);

-- 7. trips
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  location TEXT,
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP
    CHECK (scheduled_end IS NULL OR scheduled_end >= scheduled_start),
  actual_start TIMESTAMP,
  actual_end TIMESTAMP
);

-- 8. driver_incidents
CREATE TABLE driver_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  incident_date DATE NOT NULL,
  severity VARCHAR(30) NOT NULL
    CHECK (severity IN ('low', 'medium', 'high'))
);

-- 9. fuel_records
CREATE TABLE fuel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  litres NUMERIC(10,2) NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  station VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (litres > 0 AND cost >= 0)
);

-- 10. bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_type VARCHAR(20) NOT NULL
    CHECK (booking_type IN ('passenger', 'cargo')),
  weight NUMERIC(10,2),
  pickup VARCHAR(100) NOT NULL,
  dropoff VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'allocated', 'dispatched', 'completed', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  issued_date TIMESTAMP NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'paid', 'overdue'))
);

-- 12. payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  method VARCHAR(20) NOT NULL
    CHECK (method IN ('cash', 'mobile_money', 'card')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed'))
);

-- 13. notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE
);

-- 14. audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);