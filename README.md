# Transport Management System

A transport management system with a PostgreSQL database, an Express API, and a browser-based frontend.

**Author:** Jonathan Acheampong

## Project status

| Part | Status |
|---|---|
| Database | PostgreSQL schemas, tables, functions, triggers, and seed data are built and tested |
| Backend API (Node.js + Express) | Login and public endpoints for users, drivers, fleet, operations, billing, and monitoring; no session or access control |
| Frontend | Multicolour landing page, customer signup, and login check implemented; operational pages are still templates |

## Tech stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 13 or newer (developed on 18), with the `pgcrypto` extension |
| Backend | Node.js, Express, `pg`, `express-rate-limit` |
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
│   ├── 08_trip_insurance_check.sql  migration for older databases (trip insurance check)
│   ├── 09_backend_views.sql         API-safe user and driver views
│   ├── 10_vehicle_api.sql           vehicle CRUD database functions
│   ├── 11_authentication.sql        login credential verification function
│   ├── 12_user_driver_api.sql       JSON adapters for user and driver routes
│   ├── 13_backend_api.sql           shared and specialized API functions for other resources
│   ├── 14_admin_registration.sql    JSON adapter for administrator account registration
│   ├── 15_database_rules.sql        account, trip-state, and driver-verification rules
│   └── 16_billing_pagination.sql    indexed invoice/payment pagination and filtering
├── backend/                Express API
│   ├── server.js, db.js
│   ├── routes/              auth.js, users.js, drivers.js, maintenance.js,
│   │                        routeTemplates.js, trips.js, bookings.js,
│   │                        invoices.js, payments.js, fuel.js, incidents.js,
│   │                        notifications.js, auditLogs.js, reports.js, vehicles.js
│   └── utils/               apiTable.js, dbError.js
├── frontend/
│   ├── index.html
│   ├── pages/              HTML pages (landing, login, signup, role dashboards,
│   │                       profile, user management, vehicles, drivers, trips,
│   │                       bookings, fuel, billing, notifications, reports)
│   ├── css/style.css
│   └── js/                 API, authentication, role navigation, and profile scripts
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

The current `master` branch exposes the database-backed endpoints listed below. Login checks credentials and returns the public user row, but does not create a session or token. These API endpoints have no authentication or role checks. The complete backend implementation is preserved on the `backend-full` branch.

| Method | Endpoint |
|---|---|
| GET | `/api/health` |
| POST | `/api/auth/login` |
| GET, POST | `/api/users` |
| GET | `/api/users/:id` |
| PUT | `/api/users/:id/profile` |
| DELETE | `/api/users/:id` |
| GET, POST | `/api/drivers` |
| GET | `/api/drivers/:id` |
| GET, POST | `/api/maintenance` |
| GET, PUT, PATCH | `/api/maintenance/:id` |
| GET, POST | `/api/route-templates` |
| GET, PUT, PATCH | `/api/route-templates/:id` |
| GET, POST | `/api/trips` |
| GET | `/api/trips/:id` |
| PUT, PATCH | `/api/trips/:id/status` |
| GET, POST | `/api/bookings` |
| GET, PUT, PATCH | `/api/bookings/:id` |
| GET, POST | `/api/invoices` |
| GET | `/api/invoices/:id` |
| GET, POST | `/api/payments` |
| GET, PUT, PATCH | `/api/payments/:id` |
| GET | `/api/billing/invoices?page=1&pageSize=25&status=unpaid&from=YYYY-MM-DD&to=YYYY-MM-DD&search=...` |
| GET | `/api/billing/payments?page=1&pageSize=25&status=pending&from=YYYY-MM-DD&to=YYYY-MM-DD&search=...` |
| GET | `/api/billing/invoices/export?format=csv|pdf` |
| GET | `/api/billing/payments/export?format=csv|pdf` |
| GET, POST | `/api/fuel` |
| GET | `/api/fuel/:id` |
| GET, POST | `/api/incidents` |
| GET | `/api/incidents/:id` |
| GET | `/api/notifications?user_id=:id` |
| PUT | `/api/notifications/:id` |
| PUT | `/api/notifications/read-all` (body: `user_id`) |
| GET | `/api/audit-logs?limit=:n&offset=:n` |
| GET | `/api/reports` |
| GET | `/api/reports/export?format=csv|pdf` |
| GET, POST | `/api/vehicles` |
| GET, PATCH, DELETE | `/api/vehicles/:id` |

To run the frontend, open a terminal in `frontend/` and run `npm start`; it serves the static pages at `http://localhost:3011` (override with `FRONTEND_PORT`). To run the API, open a separate terminal in `backend/`, run `npm install`, configure `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `backend/.env`, then run `npm start` (API defaults to port 3001).

The login route returns the public row from `accounts.authenticate_user()` in `database/11_authentication.sql`; credential verification stays in PostgreSQL. It does not issue a JWT or establish a session. Signup dispatches customers and drivers to the existing functions in `database/12_user_driver_api.sql`; administrator signup uses `accounts.create_admin()` in `database/14_admin_registration.sql`. Role-specific dashboard pages are frontend navigation only, not authorization. Anyone can register as an administrator, and operational APIs/pages are not protected; do not expose this build to untrusted users.

The dashboard reads its vehicle, active-trip, pending-booking, and unpaid-invoice counts from `/api/reports`; recent activity comes from `/api/audit-logs`. The report summary is calculated in PostgreSQL.

The billing workspace requests paginated invoice and payment results (25 rows by default, maximum 100 per page), with status, date-range, and invoice-number filters. CSV/PDF billing exports use the same filters; CSV exports are limited to 10,000 records and PDF exports to 500. The Reports page displays and exports the all-time summary returned by `/api/reports`.

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
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/10_vehicle_api.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/11_authentication.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/12_user_driver_api.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/13_backend_api.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/14_admin_registration.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/15_database_rules.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/16_billing_pagination.sql
```
The order matters, because later files reference tables and functions from earlier ones. The `NOTICE: trigger ... does not exist, skipping` messages are normal on a first run.

On Windows, if `psql` is not recognized, add the PostgreSQL `bin` folder to your `PATH`, or open each file in the pgAdmin Query Tool (connected to `tms_db`) and run it in the same order.

### Updating an existing database (migrations)
A fresh build already contains everything, so skip this. If your database was built before these changes, run the matching migration in pgAdmin:

| File | What it does |
|---|---|
| `07_vehicle_insurance.sql` | Adds the `insurance` column to `fleet.vehicles` (safe to re-run) |
| `08_trip_insurance_check.sql` | Replaces `operations.validate_trip_assignment()` so an uninsured vehicle cannot be put on a trip. Triggers and data are untouched |
| `09_backend_views.sql` | Creates/replaces safe profile views used by the users and drivers routes |
| `10_vehicle_api.sql` | Creates/replaces the vehicle list, get, create, update and delete functions |
| `11_authentication.sql` | Creates/replaces the database login credential verification function |
| `12_user_driver_api.sql` | Creates/replaces JSON request adapters for customer creation, profile update, and driver creation |
| `13_backend_api.sql` | Creates/replaces shared resource, trip, fuel, notification, audit-log, and report API functions |
| `14_admin_registration.sql` | Creates/replaces the JSON adapter for administrator account registration |
| `15_database_rules.sql` | Adds user email/name checks, a forward-only trip status transition, and driver verification |
| `16_billing_pagination.sql` | Adds billing list functions and indexes for paginated/filterable invoice and payment queries |

Apply any missing files to an existing database from the project root, in this order:
```bash
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/09_backend_views.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/10_vehicle_api.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/11_authentication.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/12_user_driver_api.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/13_backend_api.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/14_admin_registration.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/15_database_rules.sql
psql -U postgres -d tms_db -v ON_ERROR_STOP=1 -f database/16_billing_pagination.sql
```
Files 09-14 create or replace views and functions; files 15-16 add database constraints, functions, and indexes. Before running 15 on a populated database, check that existing users satisfy its new email and non-blank name constraints. If using pgAdmin instead, connect to `tms_db`, open each needed file from the project root in Query Tool, and execute the entire file with **F5**, in the same order.

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

All six share the development password `Password123`, which is public in this file. You can sign in through the login screen with one of these accounts, or check a password in SQL:
```sql
SELECT password_hash = extensions.crypt('Password123', password_hash) AS password_ok
FROM accounts.users WHERE username = 'admin_jon';
```

## Requirements coverage

| Requirement | Status |
|---|---|
| User profiles and account deactivation | Public users API available; no authentication or role checks |
| Vehicle management | Vehicles API baseline available |
| Driver profiles | Public drivers API available; no authentication or role checks |
| Billing and reports | Paginated billing views and CSV/PDF exports connected; API still has no authentication or role checks |
| Audit logs | Public read-only endpoint available |
| Landing, login and signup UI | Transport Management System branding; customer signup and credential check are connected to the API |
| Two-factor authentication | A flag exists on the user. Not implemented |
| Backup, scalability, performance targets | Not addressed yet |

## Security notes

- Seeded accounts use a public development password. Never use the seed outside local testing.
- Login only verifies credentials; it does not authenticate later requests. All routes are public, including user deactivation, billing records, audit logs, and vehicle create/update/delete. Notification routes accept a caller-supplied user ID. Do not expose this API to untrusted networks.
- Keep database credentials in the ignored `backend/.env`; never commit secrets.

## Planned work

- More complete API implementations are preserved on the `backend-full` branch.
- Automated backend tests and deployment configuration.
- Frontend data pages for the remaining API routes using `frontend/js/api.js`.
- Fuel anomaly detection and OTP delivery by email or SMS.