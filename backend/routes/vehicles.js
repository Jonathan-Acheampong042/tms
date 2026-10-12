const createCrudRouter = require('../utils/crudRouter');

module.exports = createCrudRouter({
  schema: 'fleet',
  table: 'vehicles',
  readRoles: ['admin', 'driver'],
  writeRoles: ['admin'],
});
