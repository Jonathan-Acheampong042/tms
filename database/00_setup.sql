-- ============================================================
-- Transport Management System (TMS) - 00_setup.sql
-- Creates the five schemas plus an 'extensions' schema for pgcrypto.
-- Run this FIRST. Works whether or not the default 'public' schema
-- has been dropped.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS accounts;
CREATE SCHEMA IF NOT EXISTS fleet;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS monitoring;

COMMENT ON SCHEMA accounts   IS 'Users, authentication and password resets';
COMMENT ON SCHEMA fleet      IS 'Vehicles, maintenance, drivers and fuel';
COMMENT ON SCHEMA operations IS 'Routes, trips, incidents and bookings';
COMMENT ON SCHEMA billing    IS 'Invoices and payments';
COMMENT ON SCHEMA monitoring IS 'Notifications and audit logs';
COMMENT ON SCHEMA extensions IS 'Installed extensions (pgcrypto: crypt, gen_salt)';
