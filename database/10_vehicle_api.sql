-- Vehicle API functions. Column discovery and CRUD statements stay in the
-- database; the Express routes only invoke these functions.

CREATE OR REPLACE FUNCTION fleet.list_vehicles()
RETURNS SETOF fleet.vehicles
LANGUAGE sql
STABLE
AS $$
  SELECT v.*
  FROM fleet.vehicles AS v
  ORDER BY v.created_at DESC
$$;

CREATE OR REPLACE FUNCTION fleet.get_vehicle(p_id UUID)
RETURNS SETOF fleet.vehicles
LANGUAGE sql
STABLE
AS $$
  SELECT v.*
  FROM fleet.vehicles AS v
  WHERE v.id = p_id
$$;

CREATE OR REPLACE FUNCTION fleet.create_vehicle(p_vehicle JSONB)
RETURNS SETOF fleet.vehicles
LANGUAGE plpgsql
AS $$
DECLARE
  v_columns TEXT[];
  v_values TEXT[];
  v_vehicle fleet.vehicles%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_vehicle) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Vehicle data must be a JSON object'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    array_agg(format('%I', c.column_name) ORDER BY c.ordinal_position),
    array_agg(
      format('(jsonb_populate_record(NULL::fleet.vehicles, $1)).%I', c.column_name)
      ORDER BY c.ordinal_position
    )
  INTO v_columns, v_values
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'fleet'
    AND c.table_name = 'vehicles'
    AND c.column_name NOT IN ('id', 'created_at')
    AND p_vehicle ? c.column_name;

  IF v_columns IS NULL THEN
    RAISE EXCEPTION 'Provide at least one vehicle field'
      USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format(
    'INSERT INTO fleet.vehicles (%s) SELECT %s RETURNING *',
    array_to_string(v_columns, ', '),
    array_to_string(v_values, ', ')
  )
  USING p_vehicle
  INTO v_vehicle;

  RETURN NEXT v_vehicle;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION fleet.update_vehicle(p_id UUID, p_vehicle JSONB)
RETURNS SETOF fleet.vehicles
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignments TEXT[];
  v_vehicle fleet.vehicles%ROWTYPE;
  v_rows_updated INTEGER;
BEGIN
  IF jsonb_typeof(p_vehicle) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Vehicle data must be a JSON object'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(
    format(
      '%1$I = (jsonb_populate_record(NULL::fleet.vehicles, $1)).%1$I',
      c.column_name
    )
    ORDER BY c.ordinal_position
  )
  INTO v_assignments
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'fleet'
    AND c.table_name = 'vehicles'
    AND c.column_name NOT IN ('id', 'created_at')
    AND p_vehicle ? c.column_name;

  IF v_assignments IS NULL THEN
    RAISE EXCEPTION 'Provide at least one vehicle field'
      USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format(
    'UPDATE fleet.vehicles SET %s WHERE id = $2 RETURNING *',
    array_to_string(v_assignments, ', ')
  )
  USING p_vehicle, p_id
  INTO v_vehicle;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RETURN NEXT v_vehicle;
  END IF;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION fleet.delete_vehicle(p_id UUID)
RETURNS SETOF fleet.vehicles
LANGUAGE plpgsql
AS $$
DECLARE
  v_vehicle fleet.vehicles%ROWTYPE;
BEGIN
  DELETE FROM fleet.vehicles
  WHERE id = p_id
  RETURNING * INTO v_vehicle;

  IF FOUND THEN
    RETURN NEXT v_vehicle;
  END IF;
  RETURN;
END;
$$;
