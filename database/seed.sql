-- ============================================================
-- Transport Management System (TMS) - sample data
-- Run LAST, after schema.sql, functions.sql and user_functions.sql.
--
-- Safe to re-run: section 0 deletes this file's own rows first,
-- children before parents, so foreign keys stay satisfied.
--
-- NOTE: every password_hash below is a bcrypt hash of the
-- shared DEV password "Password123". For local testing only -
-- replace it before any real use.
--
-- NOTE: the trips trigger sync_trip_status() runs as rows are
-- inserted, so the truck (GR-1002-26) and driver Yaw end up
-- 'on_trip' after seeding. That is the trigger working, not a bug.
--
-- NOTE: section 14 removes every empty-user DELETE audit row,
-- not only the ones this file created. That is fine on a dev
-- database. Never run this file where you have real audit history.
-- ============================================================


-- ------------------------------------------------------------
-- 0. CLEANUP - remove this file's rows (children first)
-- ------------------------------------------------------------

-- audit_logs first: it references the rows we are about to delete
DELETE FROM audit_logs WHERE user_id IN (
  SELECT id FROM users WHERE username IN
    ('admin_jon','admin_ama','customer_kofi','customer_efua','driver_kwame','driver_yaw')
)
OR record_id IN (
  SELECT id FROM vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26')
  UNION ALL
  SELECT id FROM drivers WHERE user_id IN (SELECT id FROM users WHERE username IN ('driver_kwame','driver_yaw'))
  UNION ALL
  SELECT id FROM trips WHERE route_id IN (SELECT id FROM routes WHERE name IN ('Accra-Kumasi Express','Tema Harbour Shuttle','Ring Road Loop'))
  UNION ALL
  SELECT id FROM bookings WHERE user_id IN (SELECT id FROM users WHERE username IN ('customer_kofi','customer_efua'))
  UNION ALL
  SELECT id FROM invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002')
  UNION ALL
  SELECT id FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002'))
);

DELETE FROM notifications WHERE user_id IN (
  SELECT id FROM users WHERE username IN
    ('admin_jon','admin_ama','customer_kofi','customer_efua','driver_kwame','driver_yaw')
);

DELETE FROM password_resets WHERE user_id IN (
  SELECT id FROM users WHERE username IN
    ('admin_jon','admin_ama','customer_kofi','customer_efua','driver_kwame','driver_yaw')
);

DELETE FROM payments WHERE invoice_id IN (
  SELECT id FROM invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002')
);

DELETE FROM invoices WHERE invoice_number IN ('INV-2026-0000','INV-2026-0001','INV-2026-0002');

-- Bookings are deleted by owner, not by trip: the pending
-- booking has trip_id NULL, so a trip-based delete would
-- miss it and the user delete below would hit RESTRICT.
DELETE FROM bookings WHERE user_id IN (
  SELECT id FROM users WHERE username IN
    ('customer_kofi','customer_efua')
);

DELETE FROM driver_incidents WHERE driver_id IN (
  SELECT id FROM drivers WHERE user_id IN (SELECT id FROM users WHERE username IN ('driver_kwame','driver_yaw'))
);

DELETE FROM trips WHERE route_id IN (
  SELECT id FROM routes WHERE name IN ('Accra-Kumasi Express','Tema Harbour Shuttle','Ring Road Loop')
);

DELETE FROM fuel_records WHERE vehicle_id IN (
  SELECT id FROM vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26')
);

DELETE FROM maintenance_records WHERE vehicle_id IN (
  SELECT id FROM vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26')
);

DELETE FROM drivers WHERE user_id IN (
  SELECT id FROM users WHERE username IN ('driver_kwame','driver_yaw')
);

DELETE FROM vehicles WHERE plate_number IN ('GR-1001-26','GR-1002-26','GR-1003-26','GR-1004-26');

DELETE FROM routes WHERE name IN ('Accra-Kumasi Express','Tema Harbour Shuttle','Ring Road Loop');

DELETE FROM users WHERE username IN
  ('admin_jon','admin_ama','customer_kofi','customer_efua','driver_kwame','driver_yaw');


-- ------------------------------------------------------------
-- 1. users - two admins, two customers, two drivers
-- ------------------------------------------------------------
INSERT INTO users (username, email, password_hash, full_name, phone, address, role)
VALUES
  -- All six users share the dev password "Password123"
  ('admin_jon',    'jon@tms.example',    '$2b$10$f8FvYM1PBtR8BS4fq7.9memJfRbUi8MsXfBVTZE7oyvzLIvFUatzK', 'Jonathan Acheampong', '0551112233', '12 Accra Rd, Accra',   'admin'),
  ('admin_ama',    'ama@tms.example',    '$2b$10$f8FvYM1PBtR8BS4fq7.9memJfRbUi8MsXfBVTZE7oyvzLIvFUatzK', 'Ama Serwaa',          '0551112244', '34 Kumasi Ave, Kumasi','admin'),
  ('customer_kofi', 'kofi@tms.example',  '$2b$10$f8FvYM1PBtR8BS4fq7.9memJfRbUi8MsXfBVTZE7oyvzLIvFUatzK', 'Kofi Mensah',         '0551112255', '56 Ring Rd, Accra',    'customer'),
  ('customer_efua', 'efua@tms.example',  '$2b$10$f8FvYM1PBtR8BS4fq7.9memJfRbUi8MsXfBVTZE7oyvzLIvFUatzK', 'Efua Owusu',          '0551112266', '78 Labadi Rd, Accra',  'customer'),
  ('driver_kwame', 'kwame@tms.example',  '$2b$10$f8FvYM1PBtR8BS4fq7.9memJfRbUi8MsXfBVTZE7oyvzLIvFUatzK', 'Kwame Boateng',       '0551112277', '90 Tema Rd, Tema',     'driver'),
  ('driver_yaw',   'yaw@tms.example',    '$2b$10$f8FvYM1PBtR8BS4fq7.9memJfRbUi8MsXfBVTZE7oyvzLIvFUatzK', 'Yaw Frimpong',        '0551112288', '21 Takoradi Rd, Sekondi','driver');


-- ------------------------------------------------------------
-- 2. drivers - one profile per driver user
-- ------------------------------------------------------------
INSERT INTO drivers (user_id, license_number, license_expiry, license_verified, status)
VALUES
  ((SELECT id FROM users WHERE username = 'driver_kwame'), 'DRV-2021-1001', '2028-06-30', TRUE, 'available'),
  ((SELECT id FROM users WHERE username = 'driver_yaw'),   'DRV-2021-1002', '2028-06-30', TRUE, 'available');


-- ------------------------------------------------------------
-- 3. vehicles - one of each category, plus one in maintenance
-- ------------------------------------------------------------
INSERT INTO vehicles (plate_number, category, model, year, capacity, status, insurance_expiry, license_expiry)
VALUES
  ('GR-1001-26', 'bus',   'Mercedes-Benz Sprinter', '2022', 15, 'available',   '2027-03-31', '2027-03-31'),
  ('GR-1002-26', 'truck', 'Hino 300',               '2021',  5, 'available',   '2027-01-15', '2027-01-15'),
  ('GR-1003-26', 'van',   'Toyota Hiace',           '2023', 14, 'available',   '2026-12-01', '2026-12-01'),
  ('GR-1004-26', 'bus',   'Volvo B7R',              '2020', 30, 'maintenance', '2026-10-20', '2026-10-20');


-- ------------------------------------------------------------
-- 4. maintenance_records - completed, scheduled, in progress
-- ------------------------------------------------------------
INSERT INTO maintenance_records (vehicle_id, description, service_date, next_service_date, cost, status)
VALUES
  ((SELECT id FROM vehicles WHERE plate_number = 'GR-1001-26'),
   'Routine oil and filter change', '2026-08-01', '2027-02-01', 450.00, 'completed'),
  ((SELECT id FROM vehicles WHERE plate_number = 'GR-1002-26'),
   'Brake pad replacement', '2026-10-15', '2027-04-15', 1200.00, 'scheduled'),
  ((SELECT id FROM vehicles WHERE plate_number = 'GR-1004-26'),
   'Engine diagnostics and repair', '2026-09-20', NULL, 3800.00, 'in_progress');


-- ------------------------------------------------------------
-- 5. routes
-- ------------------------------------------------------------
INSERT INTO routes (name, origin, destination, distance, duration)
VALUES
  ('Accra-Kumasi Express', 'Accra', 'Kumasi', 250.00, INTERVAL '04:30:00'),
  ('Tema Harbour Shuttle', 'Tema',   'Accra',  35.00, INTERVAL '01:00:00'),
  ('Ring Road Loop',       'Accra',  'Accra',  45.00, INTERVAL '01:30:00');


-- ------------------------------------------------------------
-- 6. trips - two completed, one in progress, one scheduled
-- ------------------------------------------------------------
INSERT INTO trips (route_id, vehicle_id, driver_id, status, location,
                   scheduled_start, scheduled_end, actual_start, actual_end)
VALUES
  -- Completed: yesterday, Kwame on the bus
  ((SELECT id FROM routes WHERE name = 'Accra-Kumasi Express'),
   (SELECT id FROM vehicles WHERE plate_number = 'GR-1001-26'),
   (SELECT id FROM drivers WHERE license_number = 'DRV-2021-1001'),
   'completed', 'Kumasi Station',
   (CURRENT_DATE - 1) + TIME '06:00:00',  (CURRENT_DATE - 1) + TIME '10:30:00',
   (CURRENT_DATE - 1) + TIME '06:05:00',  (CURRENT_DATE - 1) + TIME '10:25:00'),

  -- Completed: 30 days ago, same bus and driver (older trip, for the overdue invoice)
  ((SELECT id FROM routes WHERE name = 'Accra-Kumasi Express'),
   (SELECT id FROM vehicles WHERE plate_number = 'GR-1001-26'),
   (SELECT id FROM drivers WHERE license_number = 'DRV-2021-1001'),
   'completed', 'Kumasi Station',
   (CURRENT_DATE - 30) + TIME '06:00:00', (CURRENT_DATE - 30) + TIME '10:30:00',
   (CURRENT_DATE - 30) + TIME '06:10:00', (CURRENT_DATE - 30) + TIME '10:40:00'),

  -- In progress: right now, Yaw on the truck
  ((SELECT id FROM routes WHERE name = 'Tema Harbour Shuttle'),
   (SELECT id FROM vehicles WHERE plate_number = 'GR-1002-26'),
   (SELECT id FROM drivers WHERE license_number = 'DRV-2021-1002'),
   'in_progress', 'Tema Junction',
   CURRENT_DATE + TIME '08:00:00', CURRENT_DATE + TIME '09:00:00',
   CURRENT_DATE + TIME '08:02:00', NULL),

  -- Scheduled: tomorrow morning, Kwame on the van
  ((SELECT id FROM routes WHERE name = 'Ring Road Loop'),
   (SELECT id FROM vehicles WHERE plate_number = 'GR-1003-26'),
   (SELECT id FROM drivers WHERE license_number = 'DRV-2021-1001'),
   'scheduled', NULL,
   (CURRENT_DATE + 1) + TIME '07:00:00', (CURRENT_DATE + 1) + TIME '08:30:00',
   NULL, NULL);


-- ------------------------------------------------------------
-- 7. driver_incidents - one low-severity note for Kwame
-- ------------------------------------------------------------
INSERT INTO driver_incidents (driver_id, trip_id, description, incident_date, severity)
VALUES
  ((SELECT id FROM drivers WHERE license_number = 'DRV-2021-1001'),
   (SELECT t.id FROM trips t
    JOIN routes r ON r.id = t.route_id
    WHERE r.name = 'Accra-Kumasi Express' AND t.scheduled_start::DATE = CURRENT_DATE - 1),
   'Minor delay due to traffic near Nsawam', CURRENT_DATE - 1, 'low');


-- ------------------------------------------------------------
-- 8. fuel_records - refuels for the bus and truck
-- ------------------------------------------------------------
INSERT INTO fuel_records (vehicle_id, litres, cost, station, created_at)
VALUES
  ((SELECT id FROM vehicles WHERE plate_number = 'GR-1001-26'), 60.00,  900.00,  'Shell Accra',  CURRENT_DATE - 3),
  ((SELECT id FROM vehicles WHERE plate_number = 'GR-1001-26'), 55.00,  825.00,  'Total Kumasi', CURRENT_DATE - 1),
  ((SELECT id FROM vehicles WHERE plate_number = 'GR-1002-26'), 120.00, 2160.00, 'Goil Tema',    CURRENT_DATE - 2);


-- ------------------------------------------------------------
-- 9. bookings - completed, dispatched, pending, and an old one
-- ------------------------------------------------------------
INSERT INTO bookings (trip_id, user_id, booking_type, weight, pickup, dropoff, status, created_at)
VALUES
  -- Completed passenger booking on yesterday's trip -> INV-2026-0001 (paid)
  ((SELECT t.id FROM trips t
    JOIN routes r ON r.id = t.route_id
    WHERE r.name = 'Accra-Kumasi Express' AND t.scheduled_start::DATE = CURRENT_DATE - 1),
   (SELECT id FROM users WHERE username = 'customer_kofi'),
   'passenger', NULL, 'Accra Circle', 'Kumasi Station', 'completed', CURRENT_DATE - 2),

  -- Cargo booking on today's in-progress trip -> INV-2026-0002 (unpaid)
  ((SELECT t.id FROM trips t
    JOIN routes r ON r.id = t.route_id
    WHERE r.name = 'Tema Harbour Shuttle'),
   (SELECT id FROM users WHERE username = 'customer_efua'),
   'cargo', 2.50, 'Tema Harbour Gate 3', 'Accra Central Market', 'dispatched', CURRENT_DATE - 1),

  -- Pending passenger booking, not yet allocated to a trip
  (NULL,
   (SELECT id FROM users WHERE username = 'customer_kofi'),
   'passenger', NULL, 'Osu', 'Airport Junction', 'pending', CURRENT_DATE),

  -- Older completed booking (30 days ago) -> INV-2026-0000 (overdue)
  ((SELECT t.id FROM trips t
    JOIN routes r ON r.id = t.route_id
    WHERE r.name = 'Accra-Kumasi Express' AND t.scheduled_start::DATE = CURRENT_DATE - 30),
   (SELECT id FROM users WHERE username = 'customer_efua'),
   'passenger', NULL, 'Accra Circle', 'Kumasi Station', 'completed', CURRENT_DATE - 35);


-- ------------------------------------------------------------
-- 10. invoices
-- INV-2026-0001 is inserted as 'unpaid'; the payments trigger
-- update_invoice_after_payment() flips it to 'paid' in section 11.
-- ------------------------------------------------------------
INSERT INTO invoices (booking_id, invoice_number, amount, issued_date, due_date, status)
VALUES
  ((SELECT id FROM bookings WHERE booking_type = 'passenger' AND status = 'completed'
    AND created_at::DATE = CURRENT_DATE - 2
    AND user_id = (SELECT id FROM users WHERE username = 'customer_kofi')),
   'INV-2026-0001', 85.00, CURRENT_DATE - 2, CURRENT_DATE + 13, 'unpaid'),

  ((SELECT id FROM bookings WHERE booking_type = 'cargo' AND status = 'dispatched'
    AND user_id = (SELECT id FROM users WHERE username = 'customer_efua')),
   'INV-2026-0002', 450.00, CURRENT_DATE - 1, CURRENT_DATE + 6, 'unpaid'),

  ((SELECT id FROM bookings WHERE booking_type = 'passenger' AND status = 'completed'
    AND created_at::DATE = CURRENT_DATE - 35
    AND user_id = (SELECT id FROM users WHERE username = 'customer_efua')),
   'INV-2026-0000', 40.00, CURRENT_DATE - 35, CURRENT_DATE - 5, 'unpaid');


-- ------------------------------------------------------------
-- 11. payments
-- One completed payment covering INV-2026-0001 in full.
-- The trigger marks that invoice 'paid' automatically.
-- ------------------------------------------------------------
INSERT INTO payments (invoice_id, amount, method, created_at, status)
VALUES
  ((SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0001'),
   85.00, 'mobile_money', CURRENT_DATE - 1, 'completed');


-- ------------------------------------------------------------
-- 12. notifications - a read welcome note and two unread reminders
-- ------------------------------------------------------------
INSERT INTO notifications (user_id, type, message, created_at, is_read)
VALUES
  ((SELECT id FROM users WHERE username = 'admin_jon'),
   'reminder', 'Welcome to TMS. Database seeded with sample data.', CURRENT_DATE - 5, TRUE),
  ((SELECT id FROM users WHERE username = 'admin_jon'),
   'reminder', 'Vehicle GR-1004-26 insurance expires on 2026-10-20', CURRENT_DATE - 1, FALSE),
  ((SELECT id FROM users WHERE username = 'admin_ama'),
   'reminder', 'Vehicle GR-1003-26 license expires on 2026-12-01', CURRENT_DATE - 1, FALSE);


-- ------------------------------------------------------------
-- 13. audit_logs - two manual entries so the log is not empty.
-- (The log_audit() trigger also writes entries automatically
-- for every insert above, with user_id empty because
-- app.current_user_id is only set inside the API.)
-- ------------------------------------------------------------
INSERT INTO audit_logs (user_id, action, table_name, record_id, created_at)
VALUES
  ((SELECT id FROM users WHERE username = 'admin_jon'),
   'INSERT', 'vehicles', (SELECT id FROM vehicles WHERE plate_number = 'GR-1001-26'), CURRENT_DATE - 30),
  ((SELECT id FROM users WHERE username = 'admin_jon'),
   'INSERT', 'vehicles', (SELECT id FROM vehicles WHERE plate_number = 'GR-1002-26'), CURRENT_DATE - 29);


-- ------------------------------------------------------------
-- 14. Final tidy-up
-- The section-0 deletes fired the log_audit() trigger and wrote
-- 'DELETE' rows (user_id empty, since the API is what sets
-- app.current_user_id). Remove them so re-runs stay clean.
-- ------------------------------------------------------------
DELETE FROM audit_logs
WHERE action = 'DELETE' AND user_id IS NULL
  AND table_name IN ('vehicles','drivers','trips','bookings','invoices','payments');


-- ============================================================
-- Verify (run these in psql after seeding):
-- Note: on a completely fresh/reconstructed database, counts are as follows.
-- If you have extra test data from API requests on your local machine, counts may vary.
--
--   SELECT status, COUNT(*) FROM trips GROUP BY status ORDER BY status;
--     -> completed 2, in_progress 1, scheduled 1
--
--   SELECT status, COUNT(*) FROM vehicles GROUP BY status ORDER BY status;
--     -> available 2, maintenance 1, on_trip 1   (on_trip set by trigger)
--
--   SELECT status, COUNT(*) FROM drivers GROUP BY status ORDER BY status;
--     -> available 1, on_trip 1                  (on_trip set by trigger)
--
--   SELECT invoice_number, status FROM invoices ORDER BY invoice_number;
--     -> INV-2026-0000 unpaid, INV-2026-0001 paid, INV-2026-0002 unpaid
--
--   SELECT mark_overdue_invoices();
--     -> 1   (INV-2026-0000 becomes 'overdue' on first run, returns 0 on subsequent runs)
-- ============================================================
