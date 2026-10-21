-- Shared JSON API access for whitelisted resource operations. Existing table
-- constraints and triggers remain responsible for enforcing their rules.

CREATE OR REPLACE FUNCTION extensions.api_table(
  p_resource TEXT,
  p_operation TEXT,
  p_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_table REGCLASS;
  v_schema TEXT;
  v_table_name TEXT;
  v_columns TEXT[];
  v_values TEXT[];
  v_assignments TEXT[];
  v_order TEXT;
BEGIN
  v_table := CASE p_resource
    WHEN 'fleet.maintenance_records' THEN 'fleet.maintenance_records'::REGCLASS
    WHEN 'operations.routes' THEN 'operations.routes'::REGCLASS
    WHEN 'operations.trips' THEN 'operations.trips'::REGCLASS
    WHEN 'operations.bookings' THEN 'operations.bookings'::REGCLASS
    WHEN 'billing.invoices' THEN 'billing.invoices'::REGCLASS
    WHEN 'billing.payments' THEN 'billing.payments'::REGCLASS
    WHEN 'fleet.fuel_records' THEN 'fleet.fuel_records'::REGCLASS
    WHEN 'operations.driver_incidents' THEN 'operations.driver_incidents'::REGCLASS
    ELSE NULL
  END;

  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Unsupported API resource'
      USING ERRCODE = 'P0001';
  END IF;

  v_schema := split_part(p_resource, '.', 1);
  v_table_name := split_part(p_resource, '.', 2);

  IF p_operation = 'list' THEN
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = v_schema AND table_name = v_table_name
          AND column_name = 'issued_date'
        ) THEN 't.issued_date DESC'
      WHEN EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = v_schema AND table_name = v_table_name
            AND column_name = 'created_at'
        ) THEN 't.created_at DESC'
      ELSE 't.id' END
    INTO v_order;

    RETURN QUERY EXECUTE format(
      'SELECT to_jsonb(t) FROM %s AS t ORDER BY %s',
      v_table, v_order
    );
    RETURN;
  ELSIF p_operation = 'get' THEN
    RETURN QUERY EXECUTE format(
      'SELECT to_jsonb(t) FROM %s AS t WHERE t.id = $1',
      v_table
    ) USING p_id;
    RETURN;
  ELSIF p_operation NOT IN ('create', 'update') THEN
    RAISE EXCEPTION 'Unsupported API operation'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Request data must be a JSON object'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    array_agg(format('%I', c.column_name) ORDER BY c.ordinal_position),
    array_agg(format('r.%I', c.column_name) ORDER BY c.ordinal_position),
    array_agg(
      format('%1$I = r.%1$I', c.column_name)
      ORDER BY c.ordinal_position
    )
  INTO v_columns, v_values, v_assignments
  FROM information_schema.columns AS c
  WHERE c.table_schema = v_schema
    AND c.table_name = v_table_name
    AND c.column_name NOT IN ('id', 'created_at')
    AND p_data ? c.column_name;

  IF v_columns IS NULL THEN
    RAISE EXCEPTION 'Provide at least one writable field'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_operation = 'create' THEN
    RETURN QUERY EXECUTE format(
      'INSERT INTO %s AS t (%s)
       SELECT %s
       FROM jsonb_populate_record(NULL::%s, $1) AS r
       RETURNING to_jsonb(t)',
      v_table,
      array_to_string(v_columns, ', '),
      array_to_string(v_values, ', '),
      v_table
    ) USING p_data;
  ELSE
    RETURN QUERY EXECUTE format(
      'UPDATE %s AS t
       SET %s
       FROM jsonb_populate_record(NULL::%s, $1) AS r
       WHERE t.id = $2
       RETURNING to_jsonb(t)',
      v_table,
      array_to_string(v_assignments, ', '),
      v_table
    ) USING p_data, p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION operations.api_trips(p_trip_id UUID DEFAULT NULL)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT to_jsonb(t) || jsonb_build_object(
    'route_name', r.name,
    'origin', r.origin,
    'destination', r.destination,
    'plate_number', v.plate_number,
    'driver_user_id', d.user_id
  )
  FROM operations.trips AS t
  JOIN operations.routes AS r ON r.id = t.route_id
  JOIN fleet.vehicles AS v ON v.id = t.vehicle_id
  JOIN fleet.drivers AS d ON d.id = t.driver_id
  WHERE p_trip_id IS NULL OR t.id = p_trip_id
  ORDER BY t.scheduled_start DESC
$$;

CREATE OR REPLACE FUNCTION fleet.api_fuel_records(p_record_id UUID DEFAULT NULL)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT to_jsonb(f) || jsonb_build_object('plate_number', v.plate_number)
  FROM fleet.fuel_records AS f
  JOIN fleet.vehicles AS v ON v.id = f.vehicle_id
  WHERE p_record_id IS NULL OR f.id = p_record_id
  ORDER BY f.created_at DESC
$$;

CREATE OR REPLACE FUNCTION monitoring.api_notifications(
  p_operation TEXT,
  p_user_id UUID,
  p_notification_id UUID DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_operation = 'list' THEN
    RETURN QUERY
    SELECT to_jsonb(n)
    FROM monitoring.notifications AS n
    WHERE n.user_id = p_user_id
    ORDER BY n.created_at DESC;
  ELSIF p_operation = 'read' THEN
    RETURN QUERY
    UPDATE monitoring.notifications AS n
    SET is_read = TRUE
    WHERE n.id = p_notification_id
      AND n.user_id = p_user_id
    RETURNING to_jsonb(n);
  ELSIF p_operation = 'read_all' THEN
    RETURN QUERY
    UPDATE monitoring.notifications AS n
    SET is_read = TRUE
    WHERE n.user_id = p_user_id
      AND n.is_read = FALSE
    RETURNING to_jsonb(n);
  ELSE
    RAISE EXCEPTION 'Unsupported notification operation'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION monitoring.api_audit_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT to_jsonb(a)
  FROM monitoring.audit_logs AS a
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION monitoring.api_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'fleet', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', f.status, 'count', f.count))
      FROM (
        SELECT status, COUNT(*)::INTEGER AS count
        FROM fleet.vehicles
        GROUP BY status
        ORDER BY status
      ) AS f
    ), '[]'::JSONB),
    'trips', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', t.status, 'count', t.count))
      FROM (
        SELECT status, COUNT(*)::INTEGER AS count
        FROM operations.trips
        GROUP BY status
        ORDER BY status
      ) AS t
    ), '[]'::JSONB),
    'bookings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', b.status, 'count', b.count))
      FROM (
        SELECT status, COUNT(*)::INTEGER AS count
        FROM operations.bookings
        GROUP BY status
        ORDER BY status
      ) AS b
    ), '[]'::JSONB),
    'invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', i.status, 'count', i.count))
      FROM (
        SELECT status, COUNT(*)::INTEGER AS count
        FROM billing.invoices
        GROUP BY status
        ORDER BY status
      ) AS i
    ), '[]'::JSONB),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', p.status, 'count', p.count))
      FROM (
        SELECT status, COUNT(*)::INTEGER AS count
        FROM billing.payments
        GROUP BY status
        ORDER BY status
      ) AS p
    ), '[]'::JSONB),
    'revenue', (
      SELECT jsonb_build_object(
        'collected', COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0),
        'pending', COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)
      )
      FROM billing.payments
        ),
        'drivers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('status', d.status, 'count', d.count))
          FROM (
            SELECT status, COUNT(*)::INTEGER AS count
            FROM fleet.drivers
            GROUP BY status
            ORDER BY status
          ) AS d
        ), '[]'::JSONB),
        'fuel', COALESCE((
          SELECT jsonb_build_object(
            'total_litres', COALESCE(SUM(litres), 0),
            'total_cost', COALESCE(SUM(cost), 0)
          )
          FROM fleet.fuel_records
        ), '[]'::JSONB)
      )
    $$;
