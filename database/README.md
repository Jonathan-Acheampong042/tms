# Database Files Explained — Beginner's Guide

This guide walks through all four database files in plain language. No SQL experience needed.

---

## The Big Picture

Your database is a **PostgreSQL** database. SQL (Structured Query Language) is how you talk to it. The four files build it up in layers:

```
schema.sql         ← the tables (structure)
    ↓
functions.sql      ← automatic rules and background jobs
    ↓
user_functions.sql ← the login / password-reset logic
    ↓
seed.sql           ← sample data (safe to re-run)
```

**Always run them in that order.** Each file only makes sense after the one above it.

---

## How to run these files

In **psql** (PostgreSQL's command line):

```sql
\i schema.sql
\i functions.sql
\i user_functions.sql
\i seed.sql
```

Or from the shell, one file at a time:

```powershell
psql -U postgres -d tms_db -f database/schema.sql
```

**To rebuild from scratch:** open `schema.sql` and uncomment the `DROP TABLE` block at the top (lines 7–23). It deletes the tables in the right order — nothing that depends on a table is dropped before the table it depends on.

---

## File 1: `schema.sql` — The Tables (195 lines)

This file creates **14 tables**. Tables are created in order because later tables reference earlier ones with foreign keys.

### What a table definition looks like

```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('bus', 'truck', 'van')),
  ...
);
```

Line by line:

| Piece | Meaning |
|---|---|
| `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Every row gets a unique random ID automatically. You never make one up yourself. |
| `plate_number VARCHAR(100)` | A text field, up to 100 characters. |
| `UNIQUE` | No two rows can share the value. Duplicate plate numbers are rejected with error `23505`. |
| `NOT NULL` | The field must have a value. Missing it → error `23502`. |
| `CHECK (category IN (...))` | The value must be one of the listed options. Anything else → error `23514`. |
| `DEFAULT 'available'` | If you don't send a value, this one is used. |

**The `CHECK` lists are your business rules, enforced by the database itself** — not by your Node code. Even if a bug slipped into the API, the database would still refuse a `"boat"` category.

### The three kinds of columns

- **`VARCHAR(n)`** — text with a max length.
- **`NUMERIC(10,2)`** — a decimal number (10 digits, 2 after the point). Used for money and capacity, never `FLOAT` — floats round badly and money can't afford it.
- **`TIMESTAMP` / `DATE`** — date-and-time, or date only.

### The 14 tables and what they hold

| # | Table | What it stores |
|---|---|---|
| 1 | `users` | Accounts: admin, driver, customer. `password_hash` holds a **hash**, never the real password. `is_active` = FALSE soft-deletes an account. |
| 2 | `password_resets` | One-time OTP codes for forgotten passwords. Auto-expire after 10 minutes; `attempts` counts wrong guesses. |
| 3 | `vehicles` | The fleet. `status` is `available`, `on_trip`, or `maintenance`. Tracks insurance and license expiry dates. |
| 4 | `maintenance_records` | Service history per vehicle. `next_service_date` can't be before `service_date`. |
| 5 | `drivers` | One row per driver, linked to a `users` row (`user_id` is UNIQUE — a user is either a driver or not). Optional `vehicle_id` for their assigned vehicle. |
| 6 | `routes` | Named origin → destination pairs, with distance and duration. |
| 7 | `trips` | A journey: route + vehicle + driver + times. `location` tracks where it is now. |
| 8 | `driver_incidents` | Accidents/issues logged against a driver, with severity `low`/`medium`/`high`. |
| 9 | `fuel_records` | Fuel purchases per vehicle. The `CHECK` guarantees litres > 0 and cost ≥ 0. |
| 10 | `bookings` | A customer's request: passenger or cargo, pickup and dropoff, status flowing `pending` → `allocated` → `dispatched` → `completed`. |
| 11 | `invoices` | One invoice per booking (`UNIQUE` on `booking_id`). Status `unpaid`/`paid`/`overdue`. |
| 12 | `payments` | Money received against an invoice. Method: cash, mobile_money, or card. |
| 13 | `notifications` | Messages for a user, with an `is_read` flag. |
| 14 | `audit_logs` | Who did what, when. `record_id` is a UUID even though the target table varies — it's just a label, not a foreign key. |

### Foreign keys and `ON DELETE` rules

A **foreign key** says "this column must point at a real row in another table." The `ON DELETE` part says what happens when that row is deleted:

| Rule | Behavior | Example in your schema |
|---|---|---|
| `CASCADE` | Delete the children too. | Delete a user → their notifications and password-reset rows go with them. |
| `RESTRICT` | Refuse the delete. Error `23503`. | Can't delete a vehicle that has trips, maintenance, or fuel records. |
| `SET NULL` | Keep the child, blank out the pointer. | Delete a trip → bookings keep their other data but `trip_id` becomes NULL. |

This is why the backend's `handleDbError` maps `23503` to a 409 "linked to other records" message — it's the RESTRICT rule doing its job.

---

## File 2: `functions.sql` — Automation (300 lines)

**Functions** are stored programs that live in the database. **Triggers** are functions that run *automatically* when a table changes.

Two kinds appear here:

- **Callable functions** — you run them yourself, like `SELECT mark_overdue_invoices();` (ideal for a daily cron job).
- **Trigger functions** — the database calls them for you, on every matching INSERT/UPDATE/DELETE.

**`RAISE EXCEPTION`** is how a trigger *blocks* a change. The INSERT fails and the error travels to your API, where it becomes a clear message for the user.

### The 7 functions

**1. `mark_overdue_invoices()`** → returns a count
Run daily. Sets `status = 'overdue'` on unpaid invoices whose `due_date` has passed. Returns how many rows changed.

**2. `update_invoice_after_payment()`** → trigger on `payments`
After a payment is inserted (or its status/amount changes), it adds up the **completed** payments for that invoice. If they cover the invoice amount → `paid`. If a payment is reversed so the total drops below the amount → back to `unpaid` (or `overdue` if past due).

**3. `validate_trip_assignment()`** → trigger on `trips` (BEFORE)
Runs *before* the trip is saved and blocks the insert if the assignment isn't allowed:
- Vehicle is in `maintenance`
- Vehicle insurance or license expires before the trip starts
- Driver is `off_duty`
- Driver's license isn't verified (`license_verified = FALSE`)
- Driver's license expires before the trip starts

Each check raises a specific message, so the API can tell the admin *why* the trip was rejected.

**4. `set_trip_times()`** → trigger on `trips` (BEFORE)
Fills in `actual_start` when a trip becomes `in_progress` and `actual_end` when it becomes `completed` — but only if not already set, so manual corrections aren't overwritten.

**5. `sync_trip_status()`** → trigger on `trips` (AFTER)
Keeps vehicle and driver status in step with the trip:
- Trip `in_progress` → both become `on_trip`
- Trip `completed` or `cancelled` → both return to `available`

The `WHERE status = 'on_trip'` guard means a vehicle sitting in `maintenance` is never clobbered back to `available` by a finishing trip.

**6. `create_expiry_notifications(days_ahead)`** → returns a count
Run daily (default looks 30 days ahead). Finds vehicle insurance, vehicle licenses, and driver licenses that are expired or expiring soon, and sends a `reminder` notification to every **active admin**. The `NOT EXISTS` check means an admin isn't spammed with the same unread reminder twice.

**7. `log_audit()`** → trigger on 6 tables (AFTER)
Writes a row to `audit_logs` for every INSERT/UPDATE/DELETE on `vehicles`, `drivers`, `trips`, `bookings`, `invoices`, `payments`. The acting user comes from a setting the API sets per-request:

```sql
SELECT set_config('app.current_user_id', '<user uuid>', true);
```

If the setting isn't set, `user_id` is left empty. The `DO` block at the bottom attaches the trigger to all six tables in a loop, so there's one copy of the logic, not six.

**`TG_OP`** and **`TG_TABLE_NAME`** are special variables the database provides: the operation that fired the trigger (`INSERT`/`UPDATE`/`DELETE`) and the table it fired on.

### Why `DROP TRIGGER IF EXISTS` before each `CREATE TRIGGER`

It makes the file **safe to re-run**. Without it, running the file twice would fail with "trigger already exists."

---

## File 3: `user_functions.sql` — Auth Logic (262 lines)

These are **callable functions** (no triggers) that the Node backend calls with `pool.query()`. They handle registration, login, and password resets.

**The key security idea:** these functions only ever receive and store **hashes**. Passwords and OTP codes are hashed in Node with **bcrypt** before they cross into SQL. The database never sees a real password.

**`p_` prefix** on parameters (`p_username`, `p_email`) is a naming convention that keeps parameter names from colliding with column names inside the function body.

### The 9 functions

**1. `register_user(...)`** → returns the new user ID
Inserts a user. Email is stored as `LOWER(p_email)` so login lookups aren't case-sensitive — `User@Site.com` and `user@site.com` are the same account. Duplicate username or email raises `23505`, which the API reports as 409.

**2. `register_driver(...)`** → returns the new driver ID
Does two inserts in one function: the `users` row (role `'driver'`, by reusing `register_user`) and the matching `drivers` row. Because both happen inside one function, if either fails **both roll back** — you never get a driver account with no driver profile (or the reverse).

**3. `get_user_for_login(identifier)`** → returns a row (or none)
Finds an **active** user by username or email and returns exactly what Node needs for `bcrypt.compare()`: the hash, plus `role` and `two_factor_enabled`. Returns zero rows for unknown or deactivated users, so the API can reply "invalid credentials" without revealing which one it was.

**4. `update_user_profile(...)`** → no return
Updates name/phone/address. `COALESCE` means a NULL argument keeps the current value — partial updates work, same pattern as the PUT route. Raises error `P0002` ("User not found") if the ID doesn't exist.

**5. `deactivate_user(...)`** → no return
Users with booking history can't be deleted (`ON DELETE RESTRICT`), so they're **soft-deleted** instead: `is_active = FALSE`. If they're a driver currently `available`, they're also set to `off_duty` — so `validate_trip_assignment()` will now reject any new trip for them. Login (function 3) also stops matching them.

**6. `request_password_reset(email, otp_hash)`** → returns user ID or NULL
Node generates the OTP, **hashes** it, and passes the hash. Any older unused codes for that user are marked `used` (one active code at a time), then the new one is inserted — it expires in 10 minutes by the table default. Returns NULL if no active user has that email.

**Timing/UX rule noted in the comments:** Node must give the *same* reply to the visitor whether or not the email exists. Otherwise an attacker could probe which emails are registered.

**7. `get_active_reset(email)`** → returns a row (or none)
Finds the newest **unused, unexpired** reset request for that email, but only if it has fewer than 5 failed attempts. Node compares the typed OTP against `otp_hash` with bcrypt.

**8. `record_failed_reset_attempt(reset_id)`** → returns the new attempt count
Called when the typed OTP is wrong. Adds 1 to `attempts`. At 5, function 7 stops returning the request — the code is effectively locked out.

**9. `complete_password_reset(reset_id, new_password_hash)`** → no return
Called *after* Node has verified the OTP. Marks the request `used` and saves the new password hash. The `WHERE used = FALSE AND expires_at > NOW()` guard means a replayed or expired code can't be used — if no row matched, it raises "Reset code is invalid or expired".

**The reset flow end to end:**

```
request_password_reset()   → user gets a code (hash stored)
        ↓
get_active_reset()         → Node fetches the hash to check against
        ↓
[bcrypt.compare in Node]   → right? continue. wrong? ↓
        ↓ wrong            ↓ right
record_failed_reset_       complete_password_reset()
attempt() (lock at 5)      → used = TRUE, new hash saved
```

---

## File 4: `seed.sql` — Sample Data

Filled with sample data so there's something to see in the UI while building. It is **safe to re-run**: section 0 deletes this file's own rows first (children before parents, so foreign keys stay satisfied), then the inserts run again.

### What's in it

| Data | Details |
|---|---|
| 6 users | 2 admins (`admin_jon`, `admin_ama`), 2 customers (`customer_kofi`, `customer_efua`), 2 drivers (`driver_kwame`, `driver_yaw`) |
| 2 drivers | License numbers `DRV-2021-1001` / `DRV-2021-1002`, verified, expiring 2028 |
| 4 vehicles | Bus, truck, van, plus one bus kept in `maintenance` (`GR-1004-26`) |
| 3 maintenance records | One `completed`, one `scheduled`, one `in_progress` |
| 3 routes | Accra–Kumasi Express, Tema Harbour Shuttle, Ring Road Loop |
| 4 trips | 2 `completed` (yesterday and 30 days ago), 1 `in_progress` (now), 1 `scheduled` (tomorrow) |
| 1 driver incident | Low severity, "minor delay near Nsawam" |
| 3 fuel records | Refuels for the bus and truck |
| 4 bookings | `completed`, `dispatched` (cargo), `pending`, and an older `completed` |
| 3 invoices | INV-2026-0001 (paid), INV-2026-0002 (unpaid), INV-2026-0000 (overdue) |
| 1 payment | Mobile money, covers INV-2026-0001 in full |
| 3 notifications | A read welcome note and two unread expiry reminders |
| 2 audit rows | Manual entries so the log isn't empty |

### Two things the file deliberately leaves behind

- **The in-progress truck and its driver end up `on_trip`.** That's the `sync_trip_status()` trigger doing its job as the trip row is inserted — not leftover state. The header comment says so.
- **The passwords are placeholders.** Every `password_hash` is a literal `$2b$10$PLACEHOLDER_...` string that matches no real password. Replace them with bcrypt hashes generated in Node before logging in with these accounts.

### What the triggers do during seeding (proof the automation works)

| Trigger / function | What it did when seeded |
|---|---|
| `sync_trip_status()` | Set the truck `GR-1002-26` and driver Yaw to `on_trip` |
| `update_invoice_after_payment()` | Flipped INV-2026-0001 to `paid` when the payment was inserted |
| `mark_overdue_invoices()` | Returns **1** — INV-2026-0000 became `overdue` |
| `validate_trip_assignment()` | Blocking test: inserting a trip on the maintenance vehicle fails with *"Vehicle is under maintenance and cannot be assigned to a trip"* |

### Verify after seeding

Run these in psql and compare:
*(Note: on a freshly reconstructed database, counts will be as shown below. If you run them after inserting test records from your API, results may vary.)*

```sql
SELECT status, COUNT(*) FROM trips GROUP BY status ORDER BY status;
-- completed 2, in_progress 1, scheduled 1

SELECT status, COUNT(*) FROM vehicles GROUP BY status ORDER BY status;
-- available 2, maintenance 1, on_trip 1

SELECT status, COUNT(*) FROM drivers GROUP BY status ORDER BY status;
-- available 1, on_trip 1

SELECT invoice_number, status FROM invoices ORDER BY invoice_number;
-- INV-2026-0000 unpaid, INV-2026-0001 paid, INV-2026-0002 unpaid

SELECT mark_overdue_invoices();
-- 1  (INV-2026-0000 becomes 'overdue' on the first run, and subsequent calls return 0)
```

All of the above were run against a real PostgreSQL 16 while writing this file, and every count matched.

---

## How the Layers Fit Together

```
Express route (routes/vehicles.js)
        │
        ▼
pool.query('INSERT INTO vehicles ...', values)
        │
        ▼
PostgreSQL checks the schema:
  UNIQUE / NOT NULL / CHECK / foreign keys
        │  all pass
        ▼
Triggers fire automatically:
  validate_trip_assignment (trips)
  sync_trip_status         (trips)
  log_audit                (vehicles, drivers, ...)
        │
        ▼
Row is stored
```

**The three rules that make this database trustworthy:**

1. **Constraints in the schema** — the database refuses bad data even if the API has a bug.
2. **Triggers for logic that must never be skipped** — invoice status, trip validation, audit logs can't be forgotten by a route.
3. **Functions for logic the API needs to call** — auth flows live here, hashed, with one active OTP and a 5-attempt lockout.

**Where to look when something fails:**

| Symptom | Likely cause |
|---|---|
| Error `23505` | Duplicate unique value (plate number, email, username) |
| Error `23514` | Value not in the CHECK list (`category: "boat"`) |
| Error `23502` | Required field missing |
| Error `23503` | RESTRICT — record is linked to other records |
| Error `22P02` | Bad UUID or number format |
| Trip insert fails with a custom message | `validate_trip_assignment()` trigger — read the message, it names the reason |
| Invoice never turns overdue | Run `SELECT mark_overdue_invoices();` (daily job not scheduled yet) |
