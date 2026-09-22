# Kibuks Money Investments — Backend

This folder contains the server-side API. It is intentionally separate from the GitHub Pages frontend.

## Stack
- Node.js + Express
- PostgreSQL
- JWT authentication
- bcrypt password hashing

## Local setup

1. Install Node.js 20+.
2. Create a PostgreSQL database.
3. Copy `.env.example` to `.env` and fill in the database URL and a strong JWT secret.
4. Run `backend/sql/schema.sql` against the database.
5. From the `backend` directory run:

```bash
npm install
npm start
```

The health endpoint is `GET /api/health`.

## Important

Do not put DATABASE_URL or JWT_SECRET in the GitHub Pages frontend or commit real secrets to GitHub.

Deposit and withdrawal records are created as **pending**. A real Mobile Money provider must be connected before funds are actually moved. Balance changes should be performed server-side after verified provider callbacks, not by browser code.
