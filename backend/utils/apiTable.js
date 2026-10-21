const db = require('../db');

async function apiTable(resource, operation, id = null, data = null) {
  const { rows } = await db.query(
    'SELECT * FROM extensions.api_table($1, $2, $3::uuid, $4::jsonb)',
    [resource, operation, id, data === null ? null : JSON.stringify(data)]
  );
  return operation === 'list'
    ? rows.map((row) => row.api_table)
    : rows[0]?.api_table ?? null;
}

module.exports = apiTable;
