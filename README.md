# Transport Management System (TMS)

A system for managing transport operations: vehicles, drivers, trips and routes, fuel, bookings, billing and notifications. The database is built and tested. The Express API now covers authentication and the database-backed operations; the frontend currently consists of page templates.

**Author:** Jonathan Acheampong

## Project status

| Part | Status |
|---|---|
| Database (6 schemas, 13 tables, 16 functions, 10 triggers, seed data) | Built and tested |
| Backend API (Node.js + Express) | Authenticated API for users, fleet, operations, billing, notifications and reports |
| Frontend | HTML page templates and an `api.js` helper. No page logic yet |

## Tech stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 13 or newer (developed on 18), with the `pgcrypto` extension |
| Backend | Node.js, Express, `pg`, JWT, `bcrypt`, `express-rate-limit` |
| Frontend | HTML, CSS, JavaScript (`fetch`) |

## Project structure

```
tms/
├── database/
│   ├── 00_setup.sql        schemas and the pgcrypto extension
│   ├── 01_accounts.sql     users and user functions
│   ├── 02_fleet.sql        vehicles, maintenance, drivers, fuel
│   ├── 03_operations.sql   routes, trips, incidents, bookings
│   ├── 04_billing.sql      invoices and payments
│   ├── 05_monitoring.sql   notifications and audit logs
│   ├── 06_seed.sql         sample data (development only)
│   ├── 07_vehicle_insurance.sql     migration for older databases (adds vehicles.insurance)
│   └── 08_trip_insurance_check.sql  migration for older databases (trip insurance check)
├── backend/                Express API
│   ├── server.js, db.js
│   ├── routes/              API modules for auth, users, fleet, operations,
│   │                        billing, notifications and reports
│   ├── middleware/auth.js   JWT authentication and role authorization
│   └── utils/               crud.js, crudRouter.js, dbError.js
├── frontend/
│   ├── index.html
│   ├── pages/              HTML templates (login, signup, dashboard, vehicles,
│   │                       drivers, trips, bookings, fuel, billing,
│   │                       notifications, reports)
│   ├── css/style.css
│   └── js/                 api.js helper plus one placeholder script per page
├── backend-plan.html       planning document for the full API
├── .gitignore
└── README.md
```

## Database design

The tables are split into schemas by module. Each schema holds its own tables and functions. The default `public` schema is not used.

| Schema | Tables | Functions |
|---|---|---|
| `accounts` | `users` | `register_user`, `get_user_for_login`, `update_user_profile`, `deactivate_user`, `request_password_reset`, `get_active_reset`, `record_failed_reset_attempt`, `complete_password_reset` |
| `fleet` | `vehicles`, `maintenance_records`, `drivers`, `fuel_records` | `register_driver` |
| `operations` | `routes`, `trips`, `driver_incidents`, `bookings` | `validate_trip_assignment`, `set_trip_times`, `sync_trip_status` (triggers) |
| `billing` | `invoices`, `payments` | `mark_overdue_invoices`, `update_invoice_after_payment` (trigger) |
| `monitoring` | `notifications`, `audit_logs` | `log_audit` (trigger), `create_expiry_notifications` |
| `extensions` | none | holds `pgcrypto` (`crypt`, `gen_salt`) |

### Tables

| Table | Purpose |
|---|---|
| `accounts.users` | Accounts for admins, drivers and customers. Names are split into first, middle (optional) and last. Holds the one-time code used for password reset |
| `fleet.vehicles` | Plate number, category (bus, truck, van), model, capacity, status, insured flag, insurance and license expiry |
| `fleet.maintenance_records` | Service date, next service date, cost and status per vehicle |
| `fleet.drivers` | Driver profile for a user: license number, expiry, verification, status, current vehicle |
| `fleet.fuel_records` | Litres, cost and station per vehicle and driver |
| `operations.routes` | Origin, destination, distance and estimated duration |
| `operations.trips` | One scheduled run of a route with a vehicle and driver, with scheduled and actual times |
| `operations.driver_incidents` | Incidents per driver, with severity, optionally linked to a trip |
| `operations.bookings` | Passenger or cargo bookings made by a user, optionally allocated to a trip |
| `billing.invoices` | One invoice per booking, with amount, due date and status |
| `billing.payments` | Payments against an invoice |
| `monitoring.notifications` | Alerts and reminders for users, with read status |
| `monitoring.audit_logs` | Record of changes to vehicles, drivers, trips, bookings, invoices and payments |

### Business rules enforced in the database

| Rule | Where |
|---|---|
| A trip is rejected if the vehicle is in maintenance or not insured, its insurance or license expires before the trip starts, or the driver is off duty, unverified or has an expired license | `validate_trip_assignment` |
| `actual_start` and `actual_end` are filled in when a trip starts or completes | `set_trip_times` |
| Vehicle and driver status follow the trip (`on_trip` while in progress, back to `available` afterwards) | `sync_trip_status` |
| An invoice becomes `paid` once its completed payments cover the amount | `update_invoice_after_payment` |
| Unpaid invoices past their due date become `overdue` (call daily) | `mark_overdue_invoices()` |
| Admins get reminders for expired or soon-to-expire insurance and licenses (call daily) | `create_expiry_notifications()` |
| Changes to vehicles, drivers, trips, bookings, invoices and payments are logged | `log_audit` |
| Only a user with the driver role can get a driver profile | `register_driver` |

### Design decisions

- **Primary keys** are UUIDs generated by `gen_random_uuid()`.
- **Delete rules:** `RESTRICT` protects history (trips, bookings, payments, audit logs), and `CASCADE` is used only for notifications. Users with history are deactivated, not deleted.
- **Roles:** `admin`, `driver` and `customer`.
- **Insurance:** each vehicle has an `insurance` flag and an expiry date. A trip is rejected if the flag is false or the date passes before the trip starts.
- **Passwords** are hashed inside the database with bcrypt (`extensions.crypt`, cost 10). The database receives the plain password and hashes it.
- **Password reset:** a 6-digit code is stored on the user row with an expiry (10 minutes) and an attempt counter (locked after 5 wrong attempts). The reset only completes if the correct code is supplied.
- **Route stops** are not modelled, per supervisor decision. A route has an origin and a destination.
- **Normalization:** the schema is in third normal form.

## Backend API

| Method | Endpoint |
|---|---|
| GET | `/api/health` |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/request-reset`, `/api/auth/complete-reset` |
| GET | `/api/users/me` |
| PUT | `/api/users/profile` |
| DELETE | `/api/users/:id` (deactivates account) |
| GET, POST, PUT, PATCH, DELETE | `/api/vehicles`, `/api/vehicles/:id` |
| GET, POST, PUT, PATCH | `/api/maintenance`, `/api/maintenance/:id` |
| GET, POST, PUT, PATCH | `/api/routes`, `/api/routes/:id` |
| GET, POST | `/api/drivers`, `/api/fuel`, `/api/incidents`, `/api/bookings`, `/api/invoices`, `/api/payments` |
| PUT, PATCH | `/api/bookings/:id` |
| PUT | `/api/drivers/:id/verify`, `/api/payments/:id`, `/api/trips/:id/status`, `/api/notifications/:id`, `/api/notifications/read-all` |
| GET | `/api/trips`, `/api/notifications`, `/api/reports`, `/api/audit-logs` |

To run it: `cd backend`, `npm install`, configure `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and a strong `JWT_SECRET` in `backend/.env`, then `npm run dev`. Set `JWT_EXPIRES_IN` to override the default eight-hour token lifetime.

**Fields are not repeated in generic CRUD routes.** `utils/crud.js` discovers writable table columns from PostgreSQL's `information_schema`; the database schema remains the source of column constraints and defaults. SQL values are parameterized, and dynamic identifiers are selected from that metadata rather than the request. Domain-specific operations use the database functions and triggers where available. Authenticated routes require a bearer token; public signup creates customer accounts only, while admins create driver accounts.

The profile endpoints read from `accounts.user_profiles` and `fleet.driver_details`, created by `database/09_backend_views.sql`. The server also runs `billing.mark_overdue_invoices()` and `monitoring.create_expiry_notifications(30)` daily at midnight UTC. Set `DAILY_JOBS_TIMEZONE` to an IANA timezone (for example, `America/New_York`) to change the schedule's timezone.

## Setup

### 1. Create the database
```bash
createdb -U postgres tms_db
```
Optionally remove the unused default schema:
```sql
DROP SCHEMA public;
```

### 2. Run the SQL files in order
From the project root:
```bash
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/00_setup.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/01_accounts.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/02_fleet.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/03_operations.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/04_billing.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/05_monitoring.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/06_seed.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/09_backend_views.sql
```
The order matters, because later files reference tables and functions from earlier ones. The `NOTICE: trigger ... does not exist, skipping` messages are normal on a first run.

On Windows, if `psql` is not recognized, add the PostgreSQL `bin` folder to your `PATH`, or open each file in the pgAdmin Query Tool (connected to `tms_db`) and run it in the same order.

### Updating an existing database (migrations)
A fresh build already contains everything, so skip this. If your database was built before these changes, run the matching migration in pgAdmin:

| File | What it does |
|---|---|
| `07_vehicle_insurance.sql` | Adds the `insurance` column to `fleet.vehicles` (safe to re-run) |
| `08_trip_insurance_check.sql` | Replaces `operations.validate_trip_assignment()` so an uninsured vehicle cannot be put on a trip. Triggers and data are untouched |
| `09_backend_views.sql` | Creates/replaces the API-safe `accounts.user_profiles` and `fleet.driver_details` views |

In pgAdmin: right-click `tms_db`, choose **Query Tool**, click the **Open File** folder icon, pick the file, and press **F5**. The result should say the query returned successfully.

### 3. Rebuild from scratch
This deletes all data in these schemas. Run it, then repeat step 2:
```sql
DROP SCHEMA IF EXISTS monitoring, billing, operations, fleet, accounts CASCADE;
```

### 4. Check the result
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema IN ('accounts','fleet','operations','billing','monitoring')
  AND table_type = 'BASE TABLE';                              -- 13

SELECT status, COUNT(*) FROM operations.trips GROUP BY status ORDER BY status;
  -- completed 2, in_progress 1, scheduled 1
SELECT status, COUNT(*) FROM fleet.vehicles GROUP BY status ORDER BY status;
  -- available 2, maintenance 1, on_trip 1
SELECT status, COUNT(*) FROM billing.invoices GROUP BY status ORDER BY status;
  -- paid 1, unpaid 2
SELECT billing.mark_overdue_invoices();                        -- 1
```
The trip, vehicle and invoice counts come from the triggers, for example the truck is `on_trip` because a seeded trip is in progress.

## Sample data and test accounts

`06_seed.sql` loads six users, four vehicles, three routes, four trips, bookings, invoices, a payment, notifications and audit entries. It can be re-run safely, because it deletes its own rows first. It is for development only and must not be run where real data exists.

| Username | Role |
|---|---|
| `admin_jon`, `admin_ama` | admin |
| `customer_kofi`, `customer_efua` | customer |
| `driver_kwame`, `driver_yaw` | driver |

All six share the development password `Password123`, which is public in this file. There is no login screen connected yet, but you can check a password in SQL:
```sql
SELECT password_hash = extensions.crypt('Password123', password_hash) AS password_ok
FROM accounts.users WHERE username = 'admin_jon';
```

## Requirements coverage

| Requirement | Status |
|---|---|
| User management, roles, password reset | Database functions and API routes implemented; reset delivery is development-only |
| Vehicle management, maintenance, expiry alerts | Database and API routes implemented |
| Driver management, license verification, incidents | Database and API routes implemented |
| Trip and route management, status tracking | Database and API routes implemented. Route stops not modelled |
| Fuel records | Database and API routes implemented; efficiency reports and anomaly detection not built |
| Booking and dispatch | Database and API routes implemented. Automatic trip allocation not built |
| Billing and payments | Database and API routes implemented; payment gateway integration not built |
| Reporting and analytics | Basic fleet, trip and payment summaries implemented |
| Notifications and alerts | User notification routes and expiry reminder function implemented; delivery (email, SMS) not built |
| Audit logs | Done for six tables |
| Two-factor authentication | A flag exists on the user. Not implemented |
| Backup, scalability, performance targets | Not addressed yet |

## Security notes

- Seeded accounts use a public development password. Never use the seed outside local testing.
- The database receives plain passwords for hashing and reset codes for temporary storage. Use TLS between the API and PostgreSQL and do not enable statement logging.
- The reset code is stored in plain text for at most 10 minutes. That is acceptable for this project but would be hashed in a production system.
- Use a strong, private `JWT_SECRET`; never expose it to the frontend or commit it.
- Password-reset OTPs are only logged in non-production development mode. Reset requests return 503 in production until email/SMS delivery is configured.

## Planned work

- Automated backend tests and deployment configuration.
- Frontend page logic using `frontend/js/api.js`.
- Reports, fuel anomaly detection, and OTP delivery by email or SMS.