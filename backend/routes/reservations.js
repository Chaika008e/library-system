import { Router } from 'express';
import { pool, positiveId, httpError, availableSql } from '../db.js';
import { authenticate, allow } from './auth.js';
const router = Router();
router.use(authenticate);
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT r.*, b.title, u.name AS member_name, u.email,
    CASE WHEN r.status='PENDING' AND r.expires_at <= NOW() THEN 'EXPIRED' ELSE r.status END AS status
    FROM reservations r JOIN books b ON b.id=r.book_id JOIN users u ON u.id=r.user_id
    WHERE ($1::int IS NULL OR r.user_id=$1) ORDER BY r.created_at DESC`, [req.user.role === 'MEMBER' ? req.user.id : null]);
  res.json(rows);
});
router.post('/', allow('MEMBER'), async (req, res) => {
  const bookId = positiveId(req.body.book_id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const book = await client.query('SELECT id FROM books WHERE id=$1 FOR UPDATE', [bookId]);
    if (!book.rows[0]) throw httpError(404, 'ไม่พบหนังสือ');
    const duplicate = await client.query(`SELECT id FROM reservations WHERE user_id=$1 AND book_id=$2
      AND status='PENDING' AND expires_at > NOW()
      UNION ALL SELECT id FROM loans WHERE user_id=$1 AND book_id=$2 AND returned_at IS NULL`, [req.user.id, bookId]);
    if (duplicate.rowCount) throw httpError(409, 'คุณจองหรือยืมหนังสือเล่มนี้อยู่แล้ว');
    const stock = await client.query(`SELECT (${availableSql}) AS available FROM books b WHERE b.id=$1`, [bookId]);
    if (stock.rows[0].available < 1) throw httpError(409, 'ไม่มีหนังสือว่างให้จอง');
    const { rows } = await client.query(`INSERT INTO reservations(user_id,book_id,expires_at)
      VALUES ($1,$2,NOW()+INTERVAL '3 days') RETURNING *`, [req.user.id, bookId]);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});
router.patch('/:id/cancel', async (req, res) => {
  const { rows } = await pool.query(`UPDATE reservations SET status='CANCELLED'
    WHERE id=$1 AND status='PENDING' AND expires_at>NOW() AND ($2::int IS NULL OR user_id=$2) RETURNING *`,
    [positiveId(req.params.id), req.user.role === 'MEMBER' ? req.user.id : null]);
  if (!rows[0]) throw httpError(409, 'ไม่พบการจองที่สามารถยกเลิกได้');
  res.json(rows[0]);
});
export default router;
