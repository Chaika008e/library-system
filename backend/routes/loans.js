import { Router } from 'express';
import { pool, positiveId, httpError, availableSql } from '../db.js';
import { authenticate, allow } from './auth.js';
const router = Router();
router.use(authenticate);
router.get('/dashboard', allow('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { rows } = await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM books) AS books,
    (SELECT COUNT(*)::int FROM users WHERE role='MEMBER' AND active) AS members,
    (SELECT COUNT(*)::int FROM reservations WHERE status='PENDING' AND expires_at>NOW()) AS pending,
    (SELECT COUNT(*)::int FROM loans WHERE returned_at IS NULL) AS borrowed,
    (SELECT COUNT(*)::int FROM loans WHERE returned_at IS NULL AND due_at<NOW()) AS overdue,
    (SELECT COUNT(*)::int FROM loans WHERE returned_at IS NOT NULL) AS returned`);
  res.json(rows[0]);
});
router.get('/reports', allow('ADMIN'), async (req, res) => {
  const monthly = await pool.query(`SELECT TO_CHAR(borrowed_at,'YYYY-MM') AS month, COUNT(*)::int AS loans,
    COUNT(returned_at)::int AS returned FROM loans GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
  const popular = await pool.query(`SELECT b.title, COUNT(l.id)::int AS loans FROM books b
    JOIN loans l ON l.book_id=b.id GROUP BY b.id ORDER BY loans DESC,b.title LIMIT 10`);
  res.json({ monthly: monthly.rows, popular: popular.rows });
});
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT l.*, b.title, u.name AS member_name, u.email,
    CASE WHEN l.returned_at IS NULL THEN 'BORROWED' ELSE 'RETURNED' END AS status,
    (l.returned_at IS NULL AND l.due_at<NOW()) AS overdue
    FROM loans l JOIN books b ON b.id=l.book_id JOIN users u ON u.id=l.user_id
    WHERE ($1::int IS NULL OR l.user_id=$1)
    AND ($2::boolean = false OR (l.returned_at IS NULL AND l.due_at<NOW())) ORDER BY l.borrowed_at DESC`,
    [req.user.role === 'MEMBER' ? req.user.id : null, req.query.overdue === 'true']);
  res.json(rows);
});
// Only staff can create a real loan, either from a reservation or as a walk-in.
router.post('/', allow('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const reservationId = req.body.reservation_id ? positiveId(req.body.reservation_id) : null;
  let bookId, userId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (reservationId) {
      const { rows } = await client.query('SELECT book_id,user_id FROM reservations WHERE id=$1', [reservationId]);
      if (!rows[0]) throw httpError(404, 'ไม่พบการจอง');
      bookId = rows[0].book_id; userId = rows[0].user_id;
    } else {
      bookId = positiveId(req.body.book_id); userId = positiveId(req.body.user_id);
    }
    const book = await client.query('SELECT id FROM books WHERE id=$1 FOR UPDATE', [bookId]);
    if (!book.rows[0]) throw httpError(404, 'ไม่พบหนังสือ');
    const member = await client.query("SELECT id FROM users WHERE id=$1 AND role='MEMBER' AND active FOR SHARE", [userId]);
    if (!member.rows[0]) throw httpError(400, 'ไม่พบสมาชิกที่ใช้งานอยู่');
    if (reservationId) {
      const reserved = await client.query(`UPDATE reservations SET status='FULFILLED'
        WHERE id=$1 AND status='PENDING' AND expires_at>NOW() RETURNING id`, [reservationId]);
      if (!reserved.rowCount) throw httpError(409, 'การจองหมดอายุ ถูกยกเลิก หรือยืมแล้ว');
    } else {
      const pending = await client.query(`SELECT id FROM reservations WHERE user_id=$1 AND book_id=$2
        AND status='PENDING' AND expires_at>NOW()`, [userId, bookId]);
      if (pending.rowCount) throw httpError(409, 'สมาชิกมีการจองอยู่ กรุณายืนยันจากหน้ารายการจอง');
    }
    const duplicate = await client.query('SELECT id FROM loans WHERE user_id=$1 AND book_id=$2 AND returned_at IS NULL', [userId, bookId]);
    if (duplicate.rowCount) throw httpError(409, 'สมาชิกยืมหนังสือเล่มนี้อยู่แล้ว');
    const stock = await client.query(`SELECT (${availableSql}) AS available FROM books b WHERE b.id=$1`, [bookId]);
    if (stock.rows[0].available < 1) throw httpError(409, 'ไม่มีหนังสือว่างสำหรับยืม');
    const { rows } = await client.query(`INSERT INTO loans(user_id,book_id,reservation_id,borrowed_by,due_at)
      VALUES ($1,$2,$3,$4,NOW()+INTERVAL '14 days') RETURNING *`, [userId, bookId, reservationId, req.user.id]);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});
router.patch('/:id/return', allow('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { rows } = await pool.query(`UPDATE loans SET returned_at=NOW(),returned_by=$1
    WHERE id=$2 AND returned_at IS NULL RETURNING *`, [req.user.id, positiveId(req.params.id)]);
  if (!rows[0]) throw httpError(409, 'ไม่พบรายการยืมหรือคืนไปแล้ว');
  res.json(rows[0]);
});
export default router;
