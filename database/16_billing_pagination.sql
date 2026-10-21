-- Paginated billing queries used by the billing workspace and its exports.
-- Run after 15_database_rules.sql.

CREATE INDEX IF NOT EXISTS billing_invoices_issued_date_id_idx
  ON billing.invoices (issued_date DESC, id);
CREATE INDEX IF NOT EXISTS billing_invoices_status_issued_date_id_idx
  ON billing.invoices (status, issued_date DESC, id);
CREATE INDEX IF NOT EXISTS billing_payments_created_at_id_idx
  ON billing.payments (created_at DESC, id);
CREATE INDEX IF NOT EXISTS billing_payments_status_created_at_id_idx
  ON billing.payments (status, created_at DESC, id);

CREATE OR REPLACE FUNCTION billing.list_invoice_page(
  p_page_size INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE(total_count BIGINT, items JSONB)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT i.*
    FROM billing.invoices AS i
    WHERE (p_status IS NULL OR i.status = p_status)
      AND (p_from_date IS NULL OR i.issued_date >= p_from_date::TIMESTAMP)
      AND (p_to_date IS NULL OR i.issued_date < (p_to_date + 1)::TIMESTAMP)
      AND (NULLIF(btrim(p_search), '') IS NULL
        OR i.invoice_number ILIKE '%' || btrim(p_search) || '%')
  ),
  page AS (
    SELECT *
    FROM filtered
    ORDER BY issued_date DESC, id
    LIMIT LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 10000)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::JSONB)
$$;

CREATE OR REPLACE FUNCTION billing.list_payment_page(
  p_page_size INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE(total_count BIGINT, items JSONB)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT p.*, i.invoice_number
    FROM billing.payments AS p
    JOIN billing.invoices AS i ON i.id = p.invoice_id
    WHERE (p_status IS NULL OR p.status = p_status)
      AND (p_from_date IS NULL OR p.created_at >= p_from_date::TIMESTAMP)
      AND (p_to_date IS NULL OR p.created_at < (p_to_date + 1)::TIMESTAMP)
      AND (NULLIF(btrim(p_search), '') IS NULL
        OR i.invoice_number ILIKE '%' || btrim(p_search) || '%')
  ),
  page AS (
    SELECT *
    FROM filtered
    ORDER BY created_at DESC, id
    LIMIT LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 10000)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::JSONB)
$$;
