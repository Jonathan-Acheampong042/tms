-- ============================================================
-- Transport Management System (TMS) - 06_seed.sql
-- Run LAST, after 05_monitoring.sql has been executed.
--
-- Safe to re-run: deletes this file's own rows first,
-- children before parents, so foreign keys stay satisfied.
-- ============================================================

-- ------------------------------------------------------------
-- 0. CLEANUP - remove this file's rows (children first)
-- ------------------------------------------------------------

DELETE FROM monitoring.audit_logs WHERE user_id IN (
  SELECT id FROM accounts.users WHERE username IN
    ('admin_jon','admin_ama','customer_kofi','customer_efua','driver_kwame','driver_yaw')
)
OR record_id IN (
  SELECT id FROM fleet.vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26')
  UNION ALL
  SELECT id FROM fleet.drivers WHERE user_id IN (SELECT id FROM accounts.users WHERE username IN ('driver_kwame','driver_yaw'))
  UNION ALL
  SELECT id FROM operations.trips WHERE route_id IN (SELECT id FROM operations.routes WHERE name IN ('Accra-Kumasi Express','Tema Harbour Shuttle','Ring Road Loop'))
  UNION ALL
  SELECT id FROM operations.bookings WHERE user_id IN (SELECT id FROM accounts.users WHERE username IN ('customer_kofi','customer_efua'))
  UNION ALL
  SELECT id FROM billing.invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002')
  UNION ALL
  SELECT id FROM billing.payments WHERE invoice_id IN (SELECT id FROM billing.invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002'))
);

DELETE FROM monitoring.notifications WHERE user_id IN (
  SELECT id FROM accounts.users WHERE username IN
    ('admin_jon','admin_ama','customer_kofi','customer_efua','driver_kwame','driver_yaw')
);

DELETE FROM billing.payments WHERE invoice_id IN (
  SELECT id FROM billing.invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002')
);

DELETE FROM billing.invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002');

DELETE FROM operations.bookings WHERE user_id IN (
  SELECT id FROM accounts.users WHERE username IN
    ('customer_kofi','customer_efua')
);

DELETE FROM operations.driver_incidents WHERE driver_id IN (
  SELECT id FROM fleet.drivers WHERE user_id IN (SELECT id FROM accounts.users WHERE username IN ('driver_kwame','driver_yaw'))
);

DELETE FROM operations.trips WHERE route_id IN (
  SELECT id FROM operations.routes WHERE name IN ('Accra-Kumasi Express','Tema Harbour Shuttle','Ring Road Loop')
);

DELETE FROM fleet.fuel_records WHERE vehicle_id IN (
  SELECT id FROM fleet.vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26')
);

DELETE FROM fleet.maintenance_records WHERE vehicle_id IN (
  SELECT id FROM fleet.vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26')
);

DELETE FROM fleet.drivers WHERE user_id IN (
  SELECT id FROM accounts.users WHERE username IN ('driver_kwame','driver_yaw')
);

DELETE FROM fleet.vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26');

DELETE FROM operations.routes WHERE name IN ('Accra-Kumasi Express','Tema Harbour Shuttle','Ring Road Loop');

DELETE FROM accounts.users WHERE username IN
  ('admin_jon','admin_ama','customer_kofi','customer_efua','driver_kwame','driver_yaw');


-- ------------------------------------------------------------
-- 1. users - two admins, two customers, two drivers
-- ------------------------------------------------------------
INSERT INTO accounts.users (username, email, password_hash, first_name, middle_name, last_name, phone, address, role)
VALUES
  -- Passwords are hashed in SQL with pgcrypto (extensions.crypt, bcrypt cost 10)
  ('admin_jon',     'jon@tms.example',     extensions.crypt('Password123', extensions.gen_salt('bf', 10)), 'Jonathan', 'Kofi', 'Acheampong', '0551112233', '12 Accra Rd, Accra',    'admin'),
  ('admin_ama',     'ama@tms.example',     extensions.crypt('Password123', extensions.gen_salt('bf', 10)), 'Ama',      NULL,   'Serwaa',     '0551112244', '34 Kumasi Ave, Kumasi', 'admin'),
  ('customer_kofi', 'kofi@tms.example',    extensions.crypt('Password123', extensions.gen_salt('bf', 10)), 'Kofi',     NULL,   'Mensah',     '0551112255', '56 Ring Rd, Accra',     'customer'),
  ('customer_efua', 'efua@tms.example',    extensions.crypt('Password123', extensions.gen_salt('bf', 10)), 'Efua',     NULL,   'Owusu',      '0551112266', '78 Labadi Rd, Accra',   'customer'),
  ('driver_kwame',  'kwame@tms.example',   extensions.crypt('Password123', extensions.gen_salt('bf', 10)), 'Kwame',    NULL,   'Boateng',    '0551112277', '90 Tema Rd, Tema',      'driver'),
  ('driver_yaw',    'yaw@tms.example',     extensions.crypt('Password123', extensions.gen_salt('bf', 10)), 'Yaw',      NULL,   'Frimpong',   '0551112288', '21 Takoradi Rd, Sekondi', 'driver');


-- ------------------------------------------------------------
-- 2. drivers - one profile per driver user
-- ------------------------------------------------------------
INSERT INTO fleet.drivers (user_id, license_number, license_expiry, license_verified, status)
VALUES
  ((SELECT id FROM accounts.users WHERE username = 'driver_kwame'), 'DRV-2021-1001', '2028-06-30', TRUE, 'available'),
  ((SELECT id FROM accounts.users WHERE username = 'driver_yaw'),   'DRV-2021-1002', '2028-06-30', TRUE, 'available');


-- ------------------------------------------------------------
-- 3. vehicles - one of each category, plus one in maintenance
-- ------------------------------------------------------------
INSERT INTO fleet.vehicles (plate_number, category, model, year, capacity, status, insurance_expiry, license_expiry)
VALUES
  ('GR-1001-26', 'bus',   'Mercedes-Benz Sprinter', '2022', 15, 'available',   '2027-03-31', '2027-03-31'),
  ('GR-1002-26', 'truck', 'Hino 300',               '2021',  5, 'available',   '2027-01-15', '2027-01-15'),
  ('GR-1003-26', 'van',   'Toyota Hiace',           '2023', 14, 'available',   '2026-12-01', '2026-12-01'),
  ('GR-1004-26', 'bus',   'Volvo B7R',              '2020', 30, 'maintenance', '2026-10-20', '2026-10-20');


-- ------------------------------------------------------------
-- 4. maintenance_records - completed, scheduled, in progress
-- ------------------------------------------------------------
INSERT INTO fleet.maintenance_records (vehicle_id, description, service_date, next_service_date, cost, status)
VALUES
  ((SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1001-26'),
   'Routine oil and filter change', '2026-08-01', '2027-02-01', 450.00, 'completed'),
  ((SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1002-26'),
   'Brake pad replacement', '2026-10-15', '2027-04-15', 1200.00, 'scheduled'),
  ((SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1004-26'),
   'Engine diagnostics and repair', '2026-09-20', NULL, 3800.00, 'in_progress');


-- ------------------------------------------------------------
-- 5. routes
-- ------------------------------------------------------------
INSERT INTO operations.routes (name, origin, destination, distance, duration)
VALUES
  ('Accra-Kumasi Express', 'Accra', 'Kumasi', 250.00, INTERVAL '04:30:00'),
  ('Tema Harbour Shuttle', 'Tema',   'Accra',  35.00, INTERVAL '01:00:00'),
  ('Ring Road Loop',       'Accra',  'Accra',  45.00, INTERVAL '01:30:00');


-- ------------------------------------------------------------
-- 6. trips - two completed, one in progress, one scheduled
-- ------------------------------------------------------------
INSERT INTO operations.trips (route_id, vehicle_id, driver_id, status, location,
                   scheduled_start, scheduled_end, actual_start, actual_end)
VALUES
  -- Completed: yesterday, Kwame on the bus
  ((SELECT id FROM operations.routes WHERE name = 'Accra-Kumasi Express'),
   (SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1001-26'),
   (SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1001'),
   'completed', 'Kumasi Station',
   (CURRENT_DATE - 1) + TIME '06:00:00',  (CURRENT_DATE - 1) + TIME '10:30:00',
   (CURRENT_DATE - 1) + TIME '06:05:00',  (CURRENT_DATE - 1) + TIME '10:25:00'),

  -- Completed: 30 days ago, same bus and driver (older trip, for the overdue invoice)
  ((SELECT id FROM operations.routes WHERE name = 'Accra-Kumasi Express'),
   (SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1001-26'),
   (SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1001'),
   'completed', 'Kumasi Station',
   (CURRENT_DATE - 30) + TIME '06:00:00', (CURRENT_DATE - 30) + TIME '10:30:00',
   (CURRENT_DATE - 30) + TIME '06:10:00', (CURRENT_DATE - 30) + TIME '10:40:00'),

  -- In progress: right now, Yaw on the truck
  ((SELECT id FROM operations.routes WHERE name = 'Tema Harbour Shuttle'),
   (SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1002-26'),
   (SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1002'),
   'in_progress', 'Tema Junction',
   CURRENT_DATE + TIME '08:00:00', CURRENT_DATE + TIME '09:00:00',
   CURRENT_DATE + TIME '08:02:00', NULL),

  -- Scheduled: tomorrow morning, Kwame on the van
  ((SELECT id FROM operations.routes WHERE name = 'Ring Road Loop'),
   (SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1003-26'),
   (SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1001'),
   'scheduled', NULL,
   (CURRENT_DATE + 1) + TIME '07:00:00', (CURRENT_DATE + 1) + TIME '08:30:00',
   NULL, NULL);


-- ------------------------------------------------------------
-- 7. driver_incidents - one low-severity note for Kwame
-- ------------------------------------------------------------
INSERT INTO operations.driver_incidents (driver_id, trip_id, description, incident_date, severity)
VALUES
  ((SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1001'),
   (SELECT t.id FROM operations.trips t
    JOIN operations.routes r ON r.id = t.route_id
    WHERE r.name = 'Accra-Kumasi Express' AND t.scheduled_start::DATE = CURRENT_DATE - 1),
   'Minor delay due to traffic near Nsawam', CURRENT_DATE - 1, 'low');


-- ------------------------------------------------------------
-- 8. fuel_records - refuels for the bus and truck
-- ------------------------------------------------------------
INSERT INTO fleet.fuel_records (vehicle_id, driver_id, litres, cost, station, created_at)
VALUES
  ((SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1001-26'), (SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1001'), 60.00,  900.00,  'Shell Accra',  CURRENT_DATE - 3),
  ((SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1001-26'), (SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1001'), 55.00,  825.00,  'Total Kumasi', CURRENT_DATE - 1),
  ((SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1002-26'), (SELECT id FROM fleet.drivers WHERE license_number = 'DRV-2021-1002'), 120.00, 2160.00, 'Goil Tema',    CURRENT_DATE - 2);


-- ------------------------------------------------------------
-- 9. bookings - completed, dispatched, pending, and an old one
-- ------------------------------------------------------------
INSERT INTO operations.bookings (trip_id, user_id, booking_type, weight, pickup, dropoff, status, created_at)
VALUES
  -- Completed passenger booking on yesterday's trip -> INV-2026-0001 (paid)
  ((SELECT t.id FROM operations.trips t
    JOIN operations.routes r ON r.id = t.route_id
    WHERE r.name = 'Accra-Kumasi Express' AND t.scheduled_start::DATE = CURRENT_DATE - 1),
   (SELECT id FROM accounts.users WHERE username = 'customer_kofi'),
   'passenger', NULL, 'Accra Circle', 'Kumasi Station', 'completed', CURRENT_DATE - 2),

  -- Cargo booking on today's in-progress trip -> INV-2026-0002 (unpaid)
  ((SELECT t.id FROM operations.trips t
    JOIN operations.routes r ON r.id = t.route_id
    WHERE r.name = 'Tema Harbour Shuttle'),
   (SELECT id FROM accounts.users WHERE username = 'customer_efua'),
   'cargo', 2.50, 'Tema Harbour Gate 3', 'Accra Central Market', 'dispatched', CURRENT_DATE - 1),

  -- Pending passenger booking, not yet allocated to a trip
  (NULL,
   (SELECT id FROM accounts.users WHERE username = 'customer_kofi'),
   'passenger', NULL, 'Osu', 'Airport Junction', 'pending', CURRENT_DATE),

  -- Older completed booking (30 days ago) -> INV-2026-0000 (overdue)
  ((SELECT t.id FROM operations.trips t
    JOIN operations.routes r ON r.id = t.route_id
    WHERE r.name = 'Accra-Kumasi Express' AND t.scheduled_start::DATE = CURRENT_DATE - 30),
   (SELECT id FROM accounts.users WHERE username = 'customer_efua'),
   'passenger', NULL, 'Accra Circle', 'Kumasi Station', 'completed', CURRENT_DATE - 35);


-- ------------------------------------------------------------
-- 10. invoices
-- INV-2026-0001 is inserted as 'unpaid'; the payments trigger
-- update_invoice_after_payment() flips it to 'paid' in section 11.
-- ------------------------------------------------------------
INSERT INTO billing.invoices (booking_id, invoice_number, amount, issued_date, due_date, status)
VALUES
  ((SELECT id FROM operations.bookings WHERE booking_type = 'passenger' AND status = 'completed'
    AND created_at::DATE = CURRENT_DATE - 2
    AND user_id = (SELECT id FROM accounts.users WHERE username = 'customer_kofi')),
   'INV-2026-0001', 85.00, CURRENT_DATE - 2, CURRENT_DATE + 13, 'unpaid'),

  ((SELECT id FROM operations.bookings WHERE booking_type = 'cargo' AND status = 'dispatched'
    AND user_id = (SELECT id FROM accounts.users WHERE username = 'customer_efua')),
   'INV-2026-0002', 450.00, CURRENT_DATE - 1, CURRENT_DATE + 6, 'unpaid'),

  ((SELECT id FROM operations.bookings WHERE booking_type = 'passenger' AND status = 'completed'
    AND created_at::DATE = CURRENT_DATE - 35
    AND user_id = (SELECT id FROM accounts.users WHERE username = 'customer_efua')),
   'INV-2026-0000', 40.00, CURRENT_DATE - 35, CURRENT_DATE - 5, 'unpaid');


-- ------------------------------------------------------------
-- 11. payments
-- One completed payment covering INV-2026-0001 in full.
-- The trigger marks that invoice 'paid' automatically.
-- ------------------------------------------------------------
INSERT INTO billing.payments (invoice_id, amount, method, created_at, status)
VALUES
  ((SELECT id FROM billing.invoices WHERE invoice_number = 'INV-2026-0001'),
   85.00, 'mobile_money', CURRENT_DATE - 1, 'completed');


-- ------------------------------------------------------------
-- 12. notifications - a read welcome note and two unread reminders
-- ------------------------------------------------------------
INSERT INTO monitoring.notifications (user_id, type, message, created_at, is_read)
VALUES
  ((SELECT id FROM accounts.users WHERE username = 'admin_jon'),
   'reminder', 'Welcome to TMS. Database seeded with sample data.', CURRENT_DATE - 5, TRUE),
  ((SELECT id FROM accounts.users WHERE username = 'admin_jon'),
   'reminder', 'Vehicle GR-1004-26 insurance expires on 2026-10-20', CURRENT_DATE - 1, FALSE),
  ((SELECT id FROM accounts.users WHERE username = 'admin_ama'),
   'reminder', 'Vehicle GR-1003-26 license expires on 2026-12-01', CURRENT_DATE - 1, FALSE);


-- ------------------------------------------------------------
-- 13. audit_logs - two manual entries so the log is not empty.
-- ------------------------------------------------------------
INSERT INTO monitoring.audit_logs (user_id, action, table_name, record_id, created_at)
VALUES
  ((SELECT id FROM accounts.users WHERE username = 'admin_jon'),
   'INSERT', 'vehicles', (SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1001-26'), CURRENT_DATE - 30),
  ((SELECT id FROM accounts.users WHERE username = 'admin_jon'),
   'INSERT', 'vehicles', (SELECT id FROM fleet.vehicles WHERE plate_number = 'GR-1002-26'), CURRENT_DATE - 29);


-- ------------------------------------------------------------
-- 14. Final tidy-up
-- ------------------------------------------------------------
DELETE FROM monitoring.audit_logs
WHERE action = 'DELETE' AND user_id IS NULL
  AND table_name IN ('vehicles','drivers','trips','bookings','invoices','payments');
