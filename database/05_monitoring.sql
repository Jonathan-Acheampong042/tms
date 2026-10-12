-- ============================================================
-- Transport Management System (TMS) - 05_monitoring.sql
-- Schema: monitoring
-- Tables:    notifications, audit_logs
-- Functions: log_audit, create_expiry_notifications
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

CREATE TABLE monitoring.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE monitoring.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES accounts.users(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------

-- 1. log_audit()
CREATE OR REPLACE FUNCTION monitoring.log_audit()
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

  INSERT INTO monitoring.audit_logs (user_id, action, table_name, record_id)
  VALUES (actor, TG_OP, TG_TABLE_NAME, rec_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 2. create_expiry_notifications()
CREATE OR REPLACE FUNCTION monitoring.create_expiry_notifications(days_ahead INT DEFAULT 30)
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
    FROM fleet.vehicles
    WHERE insurance_expiry <= CURRENT_DATE + days_ahead

    UNION ALL

    SELECT 'Vehicle ' || plate_number || ' license',
           license_expiry
    FROM fleet.vehicles
    WHERE license_expiry <= CURRENT_DATE + days_ahead

    UNION ALL

    SELECT 'Driver ' || concat_ws(' ', u.first_name, u.middle_name, u.last_name) || ' license',
           d.license_expiry
    FROM fleet.drivers d
    JOIN accounts.users u ON u.id = d.user_id
    WHERE d.license_expiry <= CURRENT_DATE + days_ahead
  LOOP
    IF item_rec.expiry < CURRENT_DATE THEN
      msg := item_rec.item || ' expired on ' || to_char(item_rec.expiry, 'YYYY-MM-DD');
    ELSE
      msg := item_rec.item || ' expires on ' || to_char(item_rec.expiry, 'YYYY-MM-DD');
    END IF;

    FOR admin_rec IN
      SELECT id FROM accounts.users WHERE role = 'admin' AND is_active = TRUE
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM monitoring.notifications
        WHERE user_id = admin_rec.id
          AND message = msg
          AND is_read = FALSE
      ) THEN
        INSERT INTO monitoring.notifications (user_id, type, message)
        VALUES (admin_rec.id, 'reminder', msg);

        created_count := created_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN created_count;
END;
$$ LANGUAGE plpgsql;


-- Attach log_audit() trigger to audited tables in other schemas
DO $$
DECLARE
  t TEXT;
  sch TEXT;
  tbl TEXT;
  parts TEXT[];
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fleet.vehicles', 'fleet.drivers',
    'operations.trips', 'operations.bookings',
    'billing.invoices', 'billing.payments'
  ]
  LOOP
    parts := string_to_array(t, '.');
    sch := parts[1];
    tbl := parts[2];

    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON %s.%s', tbl, sch, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %s.%s
       FOR EACH ROW EXECUTE FUNCTION monitoring.log_audit()', tbl, sch, tbl);
  END LOOP;
END $$;
