// Generic table helpers.
//
// Route files never list a table's fields. The column names are read from
// the database itself (information_schema), so adding or renaming a column
// in the SQL files needs no backend change. Values are always sent as
// parameters ($1, $2, ...). Identifiers come from the database's own
// column list, never from the request, and are quoted.
const { pool } = require('../db');

// Columns the database fills in itself; clients cannot set them.
const SERVER_MANAGED = ['id', 'created_at'];

const columnCache = new Map();

const quote = (name) => '"' + String(name).replace(/"/g, '""') + '"';
const tableName = (schema, table) => `${quote(schema)}.${quote(table)}`;
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

async function getColumns(schema, table) {
  const key = `${schema}.${table}`;
  if (!columnCache.has(key)) {
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    );
    if (rows.length === 0) throw new Error(`Unknown table ${key}`);
    columnCache.set(key, rows.map((r) => r.column_name));
  }
  return columnCache.get(key);
}

// Fields from the request body that are real, writable columns.
async function writableFields(schema, table, body) {
  const columns = await getColumns(schema, table);
  const source = body || {};
  return columns.filter((c) => !SERVER_MANAGED.includes(c) && has(source, c));
}

function noFieldsError() {
  const err = new Error('Provide at least one valid field.');
  err.code = 'NO_FIELDS';
  return err;
}

async function findAll(schema, table) {
  const columns = await getColumns(schema, table);
  const order = columns.includes('created_at') ? ` ORDER BY ${quote('created_at')} DESC` : '';
  const { rows } = await pool.query(`SELECT * FROM ${tableName(schema, table)}${order}`);
  return rows;
}

async function findById(schema, table, id) {
  const { rows } = await pool.query(
    `SELECT * FROM ${tableName(schema, table)} WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function insert(schema, table, body, client = pool) {
  const fields = await writableFields(schema, table, body);
  if (fields.length === 0) throw noFieldsError();
  const { rows } = await client.query(
    `INSERT INTO ${tableName(schema, table)} (${fields.map(quote).join(', ')})
     VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING *`,
    fields.map((f) => body[f])
  );
  return rows[0];
}

// Returns the updated row, or null if the id does not exist.
async function update(schema, table, id, body, client = pool) {
  const fields = await writableFields(schema, table, body);
  if (fields.length === 0) throw noFieldsError();
  const sets = fields.map((f, i) => `${quote(f)} = $${i + 1}`);
  const values = fields.map((f) => body[f]);
  values.push(id);
  const { rows } = await client.query(
    `UPDATE ${tableName(schema, table)}
     SET ${sets.join(', ')}
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

// Returns true if a row was deleted.
async function remove(schema, table, id, client = pool) {
  const { rowCount } = await client.query(
    `DELETE FROM ${tableName(schema, table)} WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
}

module.exports = { findAll, findById, insert, update, remove };
