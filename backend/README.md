# Backend Files Explained — Beginner's Guide

This guide walks through every backend file in plain language. No prior Node.js experience needed.

---

## The Big Picture

Your backend is a **web server** that sits between the frontend (HTML pages) and the database (PostgreSQL).

```
Browser (index.html)
       │
       ▼
   Express server (server.js)
       │
       ▼
   PostgreSQL database (db.js connects to it)
```

When the browser asks for `GET /api/vehicles`, the server asks the database for the vehicles, then sends the answer back as JSON.

---

## File 1: `package.json` — The Project ID Card

```json
{
  "name": "backend",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^18.0.5",
    "express": "^5.2.1",
    "pg": "^8.23.1"
  }
}
```

Think of this as the project's ID card and shopping list:

| Part | What it means |
|---|---|
| `name` | The project's name. |
| `scripts` | Shortcuts you run in the terminal. `npm start` runs `node server.js`. `npm run dev` runs the same thing but with `nodemon`, which auto-restarts the server when you save a file. |
| `dependencies` | Libraries your project needs. |
| `"type": "commonjs"` | Says we use `require()`/`module.exports` (not the newer `import`/`export` style). |

**The 4 libraries:**

- **express** — the web server framework. Handles URLs, requests, and responses.
- **pg** — the PostgreSQL driver. Lets Node talk to your database.
- **cors** — allows the frontend (port 3001 or the browser) to call the API from a different origin.
- **dotenv** — reads the `.env` file so secrets like passwords don't live in your code.

---

## File 2: `.env` — Secret Settings (not in git)

```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tms_db
DB_USER=postgres
DB_PASSWORD=KINGJACH
```

Environment variables = settings that change between computers (your laptop vs. production). Never commit this file to git — it holds your database password.

- `PORT` — the port the server listens on. You test at `http://localhost:3001`.
- `DB_*` — the address and login for PostgreSQL.

> ⚠️ **Security note:** your `.env` is currently an untracked file. Make sure it stays out of commits. A `.gitignore` with `.env` and `node_modules/` in it is the usual fix.

---

## File 3: `db.js` — The Database Connection

```js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
```

Line by line:

1. **`require('dotenv').config()`** — loads `.env` so `process.env.DB_HOST` etc. actually have values.
2. **`const { Pool } = require('pg')`** — grabs the `Pool` class from the `pg` library.
3. **`new Pool({...})`** — creates a **connection pool**. Instead of opening a new database connection per request (slow), the pool keeps a handful of open connections ready to reuse.
4. **`module.exports = pool`** — shares this one pool with every other file. `require('./db')` anywhere gives you the same pool.

**Why a pool matters:** if 50 people request vehicles at once, the pool handles them with a few connections instead of creating 50.

---

## File 4: `server.js` — The Main Entry Point

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.use('/api/vehicles', require('./routes/vehicles'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

What each part does:

| Code | Meaning |
|---|---|
| `const app = express()` | Creates the Express application. |
| `app.use(cors())` | Lets any website call this API. Needed because the frontend runs on a different port. |
| `app.use(express.json())` | Reads JSON from request bodies. This is what makes `req.body` work in POST/PUT. |
| `app.get('/api/health', ...)` | A test endpoint. It runs `SELECT NOW()` to prove the database connection works. Visit `http://localhost:3001/api/health` to check. |
| `app.use('/api/vehicles', require('./routes/vehicles'))` | **Mounts** the vehicles router. Any URL starting with `/api/vehicles` gets handed to `routes/vehicles.js`. |
| `app.listen(PORT, ...)` | Starts the server. |

**The pattern:** `server.js` stays small. It wires things together; the actual logic lives in `routes/` files.

**Middleware concept:** `app.use(...)` adds a "middle layer" that runs on every request before your route code. `express.json()` is a middleware that parses bodies; `cors()` is a middleware that adds headers.

---

## File 5: `routes/vehicles.js` — The Vehicle Endpoints

```js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const handleDbError = require('../utils/dbError');
```

**`express.Router()`** creates a mini-app that only handles vehicle URLs. Because `server.js` mounts it at `/api/vehicles`, a route defined as `router.get('/')` actually answers `GET /api/vehicles`.

### GET all — `router.get('/', ...)`

```js
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    handleDbError(err, res);
  }
});
```

- `req` = the incoming request (URL, query params, body).
- `res` = the outgoing response.
- `async/await` — `pool.query` takes a moment, so we `await` it instead of blocking.
- `result.rows` — the array of rows PostgreSQL returned.
- `res.json(...)` — sends the data as JSON.

### GET one — `router.get('/:id', ...)`

```js
const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
if (result.rows.length === 0) {
  return res.status(404).json({ message: 'Vehicle not found' });
}
res.json(result.rows[0]);
```

- `:id` is a **route parameter**. For `/api/vehicles/abc-123`, `req.params.id` is `"abc-123"`.
- **`$1` with `[id]`** — this is a **parameterized query**. The value is sent separately from the SQL, so a user can never type something that changes the query. This is what prevents SQL injection.
- **Never** do this: `'SELECT * FROM vehicles WHERE id = ' + id` — that string-joins user input into SQL and is the #1 web vulnerability.
- If no row matched, return **404 Not Found** instead of an empty array.

### POST add — `router.post('/', ...)`

```js
const { plate_number, category, model, year, capacity, status, insurance_expiry, license_expiry } = req.body;
const query = `
  INSERT INTO vehicles (plate_number, category, model, year, capacity, status, insurance_expiry, license_expiry)
  VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'available'), $7, $8)
  RETURNING *;
`;
const values = [plate_number, category, model, year, capacity, status, insurance_expiry, license_expiry];
const result = await pool.query(query, values);
res.status(201).json(result.rows[0]);
```

- **`req.body`** holds the JSON the client sent. `express.json()` is what fills it in.
- **Destructuring** (`const { plate_number } = req.body`) pulls fields into variables in one line.
- **`COALESCE($6, 'available')`** — "use $6, or if it's null, use `'available'`." This gives `status` a default so the client doesn't have to send it. (The table's `DEFAULT 'available'` does the same job — either approach is fine.)
- **`RETURNING *`** — PostgreSQL sends back the newly inserted row, so the client immediately sees the created vehicle (including its generated `id`).
- **`201`** — the standard "Created" success code.

### PUT update — `router.put('/:id', ...)`

```js
UPDATE vehicles
SET plate_number = COALESCE($1, plate_number),
    category = COALESCE($2, category),
    ...
WHERE id = $9
RETURNING *;
```

- **Partial updates:** `COALESCE($1, plate_number)` means "use the new value if given, otherwise keep the old one." So a client can send just `{ capacity: 20 }` and leave everything else untouched.
- **Trade-off (known and accepted):** you can't set a field back to `null` this way, because `null` means "keep the old value." Only `year` is nullable in your schema, so this is fine for now.
- **`$9`** is the `id` — the 9th value in the array.

### DELETE — `router.delete('/:id', ...)`

```js
const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING *', [id]);
if (result.rows.length === 0) {
  return res.status(404).json({ message: 'Vehicle not found' });
}
res.json({ message: 'Vehicle deleted successfully', vehicle: result.rows[0] });
```

- `DELETE ... RETURNING *` returns the deleted row, proving it existed.
- If nothing matched → 404.
- If the vehicle has trips, maintenance, or fuel records, PostgreSQL's `ON DELETE RESTRICT` blocks the delete and throws error `23503` — which `handleDbError` turns into a 409.

### `module.exports = router;`

Makes the router available to `server.js`.

---

## File 6: `utils/dbError.js` — The Shared Error Handler

```js
const handleDbError = (err, res) => {
  console.error(err);

  switch (err.code) {
    case '23505':
      return res.status(409).json({ message: 'That value already exists (e.g. duplicate plate number).' });
    case '23514':
      return res.status(400).json({ message: 'A value is not allowed for this field.', constraint: err.constraint });
    case '23502':
      return res.status(400).json({ message: `Missing required field: ${err.column}` });
    case '23503':
      return res.status(409).json({ message: 'This record is linked to other records and cannot be changed or deleted.' });
    case '22P02':
    case '22007':
      return res.status(400).json({ message: 'Invalid value or id format.' });
    default:
      return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = handleDbError;
```

**Why this exists:** PostgreSQL is strict. It rejects bad data with error codes. Those are the *client's* mistakes, not server crashes, so they should return 400/409 with a readable message — not a bare 500.

**The codes, and when your schema produces them:**

| Code | PostgreSQL name | When it happens | Returns |
|---|---|---|---|
| `23505` | unique_violation | Duplicate `plate_number`, duplicate email, etc. | **409 Conflict** |
| `23514` | check_violation | `category: "boat"` (not in the allowed list) | **400 Bad Request** |
| `23502` | not_null_violation | POST with no `capacity` | **400 Bad Request** (names the column) |
| `23503` | foreign_key_violation | Deleting a vehicle that has trips/maintenance/fuel records (`ON DELETE RESTRICT`) | **409 Conflict** |
| `22P02` | invalid_text_representation | `/api/vehicles/abc` (not a UUID), or `capacity: "abc"` | **400 Bad Request** |
| `22007` | invalid_datetime_format | `insurance_expiry: "tomorrow"` | **400 Bad Request** |

**Status code meanings:**

- **400 Bad Request** — "your input is wrong, fix it and try again."
- **404 Not Found** — "that ID doesn't exist."
- **409 Conflict** — "the request conflicts with existing data" (duplicate or linked records).
- **500 Internal Server Error** — "something broke on our side."

**Two fallthrough cases:** `case '22P02': case '22007':` share one response because both mean "a value had the wrong format." JavaScript `switch` falls through when a case has no body.

**`console.error(err)`** logs the full error to your terminal so you can debug, while the client only gets the friendly message.

**Why it's in `utils/`:** you'll have ~a dozen route files (trips, drivers, bookings...). Each one does `const handleDbError = require('../utils/dbError')` instead of copy-pasting the switch. One file, one source of truth.

---

## How It All Fits Together

```
POST /api/vehicles  (browser sends JSON)
        │
        ▼
server.js: app.use('/api/vehicles', router)
        │
        ▼
routes/vehicles.js: router.post('/')
        │  reads req.body, builds parameterized query
        ▼
db.js (pool): pool.query('INSERT ... VALUES ($1,...)', values)
        │
        ▼
PostgreSQL: validates constraints, inserts row, returns it
        │
        ▼
routes/vehicles.js: res.status(201).json(row)   — or —   handleDbError(err, res)
        │
        ▼
Browser receives JSON
```

**The three rules that apply to every route you'll write:**

1. **Always use parameters** (`$1`, `$2`) — never string-concatenate user input into SQL.
2. **Always check for 404** — if `result.rows.length === 0`, the record doesn't exist.
3. **Always route errors through `handleDbError`** — so constraint failures become 400/409 instead of 500.

---

## Try It

Start the server:

```powershell
cd backend
npm run dev
```

Add a vehicle:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/vehicles -Method Post -ContentType 'application/json' -Body '{"plate_number":"GR-1234-26","category":"van","model":"Toyota Hiace","capacity":14,"insurance_expiry":"2027-01-01","license_expiry":"2027-01-01"}'
```

Then test the error cases:

| Test | Expected result |
|---|---|
| Same POST again | 409 — duplicate plate number |
| `"category":"boat"` | 400 — value not allowed |
| POST with no `capacity` | 400 — missing required field |
| `GET /api/vehicles/abc` | 400 — invalid id format (not 500) |
| Delete a vehicle with a trip | 409 — linked to other records |
