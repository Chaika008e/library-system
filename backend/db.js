import 'dotenv/config';
import pg from 'pg';

// All SQL is written directly in routes. This file only creates the shared pool.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
pool.on('error', (error) => console.error('PostgreSQL connection:', error.message));

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw httpError(400, 'รหัสข้อมูลไม่ถูกต้อง');
  return id;
}

// The same expression is used for the catalog and checkout stock checks.
// Expired reservations automatically stop holding stock after exactly 3 days.
export const availableSql = `b.total_copies
  - (SELECT COUNT(*)::int FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL)
  - (SELECT COUNT(*)::int FROM reservations r WHERE r.book_id = b.id
     AND r.status = 'PENDING' AND r.expires_at > NOW())`;
