const cron = require('node-cron');
const db = require('../db');

function startDailyJobs() {
  const timezone = process.env.DAILY_JOBS_TIMEZONE || 'UTC';

  return cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        const result = await db.transaction(null, async (client) => {
          const lock = await client.query(
            'SELECT pg_try_advisory_xact_lock(746231, 1) AS acquired'
          );
          if (!lock.rows[0].acquired) return null;

          const overdue = await client.query(
            'SELECT billing.mark_overdue_invoices() AS updated'
          );
          const notifications = await client.query(
            'SELECT monitoring.create_expiry_notifications(30) AS created'
          );
          return {
            updated: overdue.rows[0].updated,
            created: notifications.rows[0].created,
          };
        });
        if (!result) return;
        console.info(
          `Daily database jobs completed: ${result.updated} invoices marked overdue; ${result.created} expiry notifications created.`
        );
      } catch (error) {
        console.error('Daily database jobs failed:', error);
      }
    },
    { timezone, noOverlap: true }
  );
}

module.exports = startDailyJobs;
