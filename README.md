# Transport Management System (TMS)

A lightweight, robust Transport Management System (TMS) built with a layered architecture: a PostgreSQL database layer, an Express.js REST API backend, and a static HTML/CSS/JavaScript frontend.

The project is designed with modularity and extensibility in mind, employing database-level triggers, structured Postgres error handling, atomic stored functions, and fully parameterised queries to prevent security vulnerabilities like SQL Injection.

---

## Technical Stack

- **Frontend:** HTML5, CSS3, and asynchronous JavaScript (`fetch` API).
- **Backend:** Node.js, Express.js (Express 5 Router pattern), and the `pg` driver for PostgreSQL pool connectivity.
- **Database:** PostgreSQL 18 (comprising 14 core tables, custom triggers, audit logging, and stored functions).

---

## System Architecture

```
 tms/
 ├── backend/                   # Express.js REST API
 │   ├── middleware/            # Route protection & role checks
 │   │   └── auth.js            # JWT Validation and authentication middleware (Stub)
 │   ├── routes/                # Endpoint controllers
 │   │   ├── vehicles.js        # Implemented Vehicles CRUD routes
 │   │   ├── routeTemplates.js  # Endpoints for the routes table (origin/destination templates)
 │   │   └── ...js              # Stubs for trips, drivers, fuel, billing, etc.
 │   ├── utils/                 # General-purpose utility helpers
 │   │   └── dbError.js         # Shared PostgreSQL error code handler
 │   ├── db.js                  # Pool connection configuration
 │   ├── server.js              # Express app initialization & server entrypoint
 │   └── .env                   # Local backend configuration (ignored)
 ├── database/                  # PostgreSQL schema, functions, and seed datasets
 │   ├── schema.sql             # 14-table relational database model
 │   ├── functions.sql          # Invoicing, assignment, and status-sync triggers
 │   ├── user_functions.sql    # Atomic stored functions for users & password resets
 │   └── seed.sql               # Verified sample data with idempotent safe-re-runs
 ├── frontend/                  # Static UI page views & styling templates
 │   ├── css/                   # Global stylesheet (style.css)
 │   ├── js/                    # Asynchronous fetch and page action files
 │   │   ├── api.js             # Shared fetch helper and centralized BASE_URL
 │   │   └── ...js              # Stubs for page-level state logic
 │   ├── pages/                 # HTML templates for page layouts (logic to be built)
 │   └── index.html             # Entry landing page
 └── README.md                  # Main project guide
```

---

## Database Schema (14 Tables)

Intermediate route stops are currently not modeled in this system (per supervisor decision). The database is structured into 14 relational tables:

| # | Table Name | Purpose |
| :--- | :--- | :--- |
| 1 | **users** | Core credentials, profiles, and accounts (`admin`, `customer`, `driver`) |
| 2 | **password_resets** | Single-use password OTP verification and lockout tracking |
| 3 | **vehicles** | Plate numbers, categories (`bus`, `truck`, `van`), model details, status |
| 4 | **maintenance_records** | Service dates, cost, and status per vehicle |
| 5 | **drivers** | License details, verification, status, and current vehicle |
| 6 | **routes** | Travel routes (origin, destination, distance, estimated time) |
| 7 | **trips** | Scheduled and actual times, status, vehicle and driver |
| 8 | **driver_incidents** | Incidents per driver, with severity, optionally linked to a trip |
| 9 | **fuel_records** | Litres, cost, and station per vehicle |
| 10 | **bookings** | Cargo or passenger service requests linked to schedules/trips |
| 11 | **invoices** | One invoice per booking, with amount, due date, and status |
| 12 | **payments** | Receipts log sheet (payment modes, status tracking, amount) |
| 13 | **notifications** | Alerts and reminders for users, with read status |
| 14 | **audit_logs** | Changes to vehicles, drivers, trips, bookings, invoices, and payments |

---

## Setting Up and Running the Project

Follow these steps to configure your local environment and spin up the database and services.

### 1. Database Setup

First, ensure you have PostgreSQL installed (or running in a Docker container on port `5432`). Create a database named `tms_db`:

```bash
createdb -U postgres tms_db
```

Apply the database scripts **in the exact order** listed below. This order resolves all dependencies.

*Note for Windows users:* If `psql` is not recognized in your command line, add the PostgreSQL `bin` folder to your system `PATH`, or open the **pgAdmin Query Tool**, connect to the `tms_db` database, and paste the contents of each file to execute them in order.

```bash
# 1. Base database tables and relationships
psql -U postgres -d tms_db -f database/schema.sql

# 2. Automation triggers and status-sync functions
psql -U postgres -d tms_db -f database/functions.sql

# 3. Custom authentication, user profiles and password reset functions
psql -U postgres -d tms_db -f database/user_functions.sql

# 4. Populating sample data (safe to re-run multiple times)
psql -U postgres -d tms_db -f database/seed.sql
```

### 2. Backend API Setup

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory with your database connection details and auth secrets:
   ```env
   PORT=3001
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=tms_db
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   
   # Authentication Secrets (Planned)
   JWT_SECRET=your_super_secure_jwt_secret_key_here
   JWT_EXPIRES_IN=1h
   ```
4. Start the server in development mode (using Nodemon for auto-reload):
   ```bash
   npm run dev
   ```
   Or in production start mode:
   ```bash
   npm start
   ```

The backend server runs on `http://localhost:3001`. You can test the connection with a healthcheck request to `http://localhost:3001/api/health`.

### 3. Frontend Web Client Setup

To open the application:
- Serve the files locally using a lightweight server (e.g. `npx serve frontend` or VS Code Live Server).
- Or, directly double-click `frontend/index.html` in your file explorer to open it in any modern browser.

---

## Local Testing Logins

These share a development password that is public in this README. Never use it outside local testing.

| Username | Role | Purpose |
| :--- | :--- | :--- |
| **admin_jon** | `admin` | Administrator |
| **admin_ama** | `admin` | Administrator |
| **customer_kofi** | `customer` | Customer |
| **customer_efua** | `customer` | Customer (Heavy cargo) |
| **driver_kwame** | `driver` | Driver |
| **driver_yaw** | `driver` | Driver |

*Password for all accounts:* `Password123`

---

## Current Status and API Tables

### Available Core Services
| Entity | Type | Handler File | Implemented Endpoints | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Vehicles** | REST API | `routes/vehicles.js` | GET `/`, GET `/:id`, POST `/`, PUT `/:id`, DELETE `/:id` | **Implemented** |
| **All Other Routes** | REST API | `routes/*.js` | None | **Stub files exist but are not mounted in server.js yet.** |
| **Authentication** | Middleware | `middleware/auth.js` | None | **Planned** (JWT protection) |

### Frontend Page Templates
*Note: Page layouts are structured in HTML with navigation, forms, and headers; dynamic API fetching and data binding is to be built next.*

- **index.html**: Main landing page with navigations.
- **pages/login.html & signup.html**: Account authentication forms.
- **pages/dashboard.html**: Panels designed to display system metrics.
- **pages/vehicles.html**: Tables for listing vehicles and interactive options.
- **pages/drivers.html**: Active driver list panels and status tables.
- **pages/trips.html**: Route dispatch layouts and trip logs.
- **pages/bookings.html**: Booking registration forms and invoice status grids.
- **pages/fuel.html**: Log forms for fuel purchases and vehicle consumption cards.
- **pages/billing.html**: Invoice tables and payment logs.
- **pages/notifications.html**: Notification listings (breakdown, reminders, logs).
- **pages/reports.html**: Layout containers for utilization and revenue reports.

---

## Security and Production Notice

- **Development Only:** The API does not have security filters or Authorization headers mounted on POST, PUT, and DELETE endpoints yet. For safety, the system should only be run and served on local environments (`localhost`).
- **Authorization Blockers:** Do not deploy or expose these routes to public networks until JWT validation middleware (`middleware/auth.js`) is completed and connected to all write/destructive routes.

---

## Planned Enhancements
- **Securing API Endpoints:** Add JWT role checks to enforce that only administrative accounts (`role = 'admin'`) can execute POST, PUT, and DELETE methods.
- **Dynamic Frontend JS:** Bind the placeholder JS files to the fetch helpers in `frontend/js/api.js` to hydrate page tables in real time from the database.
- **Real-Time Web Sockets:** Introduce notification streams when breakdowns or vehicle delays are registered.
