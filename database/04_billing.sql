-- ============================================================
-- Transport Management System (TMS) - 04_billing.sql
-- Schema: billing
-- Tables:    invoices, payments
-- Functions: mark_overdue_invoices, update_invoice_after_payment
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

CREATE TABLE billing.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES operations.bookings(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  issued_date TIMESTAMP NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'paid', 'overdue'))
);

CREATE TABLE billing.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES billing.invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  method VARCHAR(20) NOT NULL
    CHECK (method IN ('cash', 'mobile_money', 'card')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed'))
);

-- ------------------------------------------------------------
-- FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------

-- 1. mark_overdue_invoices()
CREATE OR REPLACE FUNCTION billing.mark_overdue_invoices()
RETURNS INT AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE billing.invoices
  SET status = 'overdue'
  WHERE status = 'unpaid'
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;


-- 2. update_invoice_after_payment()
CREATE OR REPLACE FUNCTION billing.update_invoice_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_amount NUMERIC(10,2);
  total_paid NUMERIC(10,2);
BEGIN
  SELECT amount INTO invoice_amount
  FROM billing.invoices
  WHERE id = NEW.invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM billing.payments
  WHERE invoice_id = NEW.invoice_id
    AND status = 'completed';

  IF total_paid >= invoice_amount THEN
    UPDATE billing.invoices
    SET status = 'paid'
    WHERE id = NEW.invoice_id;
  ELSE
    UPDATE billing.invoices
    SET status = CASE WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'unpaid' END
    WHERE id = NEW.invoice_id
      AND status = 'paid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_after_payment ON billing.payments;
CREATE TRIGGER trg_update_invoice_after_payment
AFTER INSERT OR UPDATE OF status, amount ON billing.payments
FOR EACH ROW EXECUTE FUNCTION billing.update_invoice_after_payment();
