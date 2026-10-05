-- ============================================================
-- Transport Management System (TMS) - functions and triggers
-- Run this AFTER schema.sql. It does not change any table.
-- Safe to re-run: functions use CREATE OR REPLACE and each
-- trigger is dropped before it is created.
-- ============================================================


-- ------------------------------------------------------------
-- 1. mark_overdue_invoices()
-- Sets unpaid invoices past their due date to 'overdue'.
-- Returns how many invoices were changed.
-- Run it daily:  SELECT mark_overdue_invoices();
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS INT AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status = 'unpaid'
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 2. update_invoice_after_payment()  (trigger function)
-- After a payment is saved, add up the completed payments for
-- its invoice. If they cover the amount, the invoice is 'paid'.
-- If a payment is later reversed, the invoice goes back to
-- 'unpaid' (or 'overdue' if the due date has passed).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_invoice_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_amount NUMERIC(10,2);
  total_paid NUMERIC(10,2);
BEGIN
  SELECT amount INTO invoice_amount
  FROM invoices
  WHERE id = NEW.invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND status = 'completed';

  IF total_paid >= invoice_amount THEN
    UPDATE invoices
    SET status = 'paid'
    WHERE id = NEW.invoice_id;
  ELSE
    UPDATE invoices
    SET status = CASE WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'unpaid' END
    WHERE id = NEW.invoice_id
      AND status = 'paid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_after_payment ON payments;
CREATE TRIGGER trg_update_invoice_after_payment
AFTER INSERT OR UPDATE OF status, amount ON payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_after_payment();


-- ------------------------------------------------------------
-- 3. validate_trip_assignment()  (trigger function)
-- Blocks a trip when the vehicle or driver is not allowed to go:
-- vehicle in maintenance, insurance or license expired by the
-- start date, driver off duty, unverified, or license expired.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_status VARCHAR(20);
  v_insurance DATE;
  v_license DATE;
  d_status VARCHAR(20);
  d_license DATE;
  d_verified BOOLEAN;
BEGIN
  SELECT status, insurance_expiry, license_expiry
  INTO v_status, v_insurance, v_license
  FROM vehicles
  WHERE id = NEW.vehicle_id;

  SELECT status, license_expiry, license_verified
  INTO d_status, d_license, d_verified
  FROM drivers
  WHERE id = NEW.driver_id;

  IF v_status = 'maintenance' THEN
    RAISE EXCEPTION 'Vehicle is under maintenance and cannot be assigned to a trip';
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

DROP TRIGGER IF EXISTS trg_validate_trip_assignment ON trips;
CREATE TRIGGER trg_validate_trip_assignment
BEFORE INSERT OR UPDATE OF vehicle_id, driver_id, scheduled_start ON trips
FOR EACH ROW EXECUTE FUNCTION validate_trip_assignment();


-- ------------------------------------------------------------
-- 4. set_trip_times()  (trigger function)
-- Fills in actual_start when a trip becomes 'in_progress' and
-- actual_end when it becomes 'completed', if not already set.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_trip_times()
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

DROP TRIGGER IF EXISTS trg_set_trip_times ON trips;
CREATE TRIGGER trg_set_trip_times
BEFORE INSERT OR UPDATE OF status ON trips
FOR EACH ROW EXECUTE FUNCTION set_trip_times();


-- ------------------------------------------------------------
-- 5. sync_trip_status()  (trigger function)
-- Keeps vehicle and driver status in step with the trip:
-- in_progress -> both 'on_trip'; completed/cancelled -> back to
-- 'available'. A vehicle in 'maintenance' is never overwritten.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_trip_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' THEN
    UPDATE vehicles SET status = 'on_trip' WHERE id = NEW.vehicle_id;
    UPDATE drivers  SET status = 'on_trip' WHERE id = NEW.driver_id;
  ELSIF NEW.status IN ('completed', 'cancelled') THEN
    UPDATE vehicles SET status = 'available'
    WHERE id = NEW.vehicle_id AND status = 'on_trip';

    UPDATE drivers SET status = 'available'
    WHERE id = NEW.driver_id AND status = 'on_trip';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_trip_status ON trips;
CREATE TRIGGER trg_sync_trip_status
AFTER INSERT OR UPDATE OF status ON trips
FOR EACH ROW EXECUTE FUNCTION sync_trip_status();


-- ------------------------------------------------------------
-- 6. create_expiry_notifications(days_ahead)
-- Finds vehicle insurance, vehicle license and driver license
-- dates that are expired or expire within days_ahead days, and
-- sends a 'reminder' notification to every active admin.
-- Skips a notification the admin already has unread.
-- Returns how many notifications were created.
-- Run it daily:  SELECT create_expiry_notifications();
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_expiry_notifications(days_ahead INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
  item_rec RECORD;
  admin_rec RECORD;
  msg TEXT;
  created_count INT := 0;
BEGIN
  FOR item_rec IN
    SELECT 'Vehicle ' || plate_number || ' insurance' AS item,
           insurance_expiry AS expiry
    FROM vehicles
    WHERE insurance_expiry <= CURRENT_DATE + days_ahead

    UNION ALL

    SELECT 'Vehicle ' || plate_number || ' license',
           license_expiry
    FROM vehicles
    WHERE license_expiry <= CURRENT_DATE + days_ahead

    UNION ALL

    SELECT 'Driver ' || u.full_name || ' license',
           d.license_expiry
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    WHERE d.license_expiry <= CURRENT_DATE + days_ahead
  LOOP
    IF item_rec.expiry < CURRENT_DATE THEN
      msg := item_rec.item || ' expired on ' || to_char(item_rec.expiry, 'YYYY-MM-DD');
    ELSE
      msg := item_rec.item || ' expires on ' || to_char(item_rec.expiry, 'YYYY-MM-DD');
    END IF;

    FOR admin_rec IN
      SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = admin_rec.id
          AND message = msg
          AND is_read = FALSE
      ) THEN
        INSERT INTO notifications (user_id, type, message)
        VALUES (admin_rec.id, 'reminder', msg);

        created_count := created_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN created_count;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 7. log_audit()  (trigger function)
-- Writes a row to audit_logs for every insert, update or delete
-- on the tables listed in the DO block below.
-- The acting user comes from the setting app.current_user_id.
-- If it is not set, user_id is left empty.
-- Express sets it inside each transaction:
--   SELECT set_config('app.current_user_id', '<user uuid>', true);
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
  actor UUID;
  rec_id UUID;
BEGIN
  actor := NULLIF(current_setting('app.current_user_id', true), '')::UUID;

  IF TG_OP = 'DELETE' THEN
    rec_id := OLD.id;
  ELSE
    rec_id := NEW.id;
  END IF;

  INSERT INTO audit_logs (user_id, action, table_name, record_id)
  VALUES (actor, TG_OP, TG_TABLE_NAME, rec_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach log_audit() to each table in the list.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles', 'drivers', 'trips', 'bookings', 'invoices', 'payments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH ROW EXECUTE FUNCTION log_audit()', t, t);
  END LOOP;
END $$;