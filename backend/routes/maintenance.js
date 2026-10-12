
const createCrudRouter = require('../utils/crudRouter');

module.exports = createCrudRouter({
  schema: 'fleet',
  table: 'maintenance_records',
  readRoles: ['admin'],
  writeRoles: ['admin'],
  allowDelete: false,
});
