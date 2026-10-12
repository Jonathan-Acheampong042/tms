
const createCrudRouter = require('../utils/crudRouter');

module.exports = createCrudRouter({
  schema: 'operations',
  table: 'routes',
  readRoles: ['admin', 'driver', 'customer'],
  writeRoles: ['admin'],
  allowDelete: false,
});
