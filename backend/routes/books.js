import { Router } from 'express';
import { pool, availableSql, positiveId, httpError } from '../db.js';
import { authenticate, allow } from './auth.js';

const router = Router();
router.use(authenticate);
const selectBooks = `SELECT b.*, c.name AS category_name, (${availableSql}) AS available_copies
  FROM books b LEFT JOIN categories c ON c.id = b.category_id`;
router.get('/', async (req, res) => {
  const search = String(req.query.search || '').slice(0, 200);
  const category = req.query.category ? positiveId(req.query.category) : null;
  const { rows } = await pool.query(`${selectBooks} WHERE
    (b.title ILIKE $1 OR b.author ILIKE $1 OR COALESCE(b.isbn,'') ILIKE $1)
    AND ($2::int IS NULL OR b.category_id = $2) ORDER BY b.id DESC`, [`%${search}%`, category]);
  res.json(rows);
});
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`${selectBooks} WHERE b.id = $1`, [positiveId(req.params.id)]);
  if (!rows[0]) throw httpError(404, 'ไม่พบหนังสือ');
  res.json(rows[0]);
});
function bookValues(body) {
  const { title, author, isbn, description, category_id, total_copies } = body;
  if (typeof title !== 'string' || !title.trim() || title.length > 200 ||
      typeof author !== 'string' || !author.trim() || author.length > 150)
    throw httpError(400, 'กรุณาระบุชื่อหนังสือและผู้แต่งให้ถูกต้อง');
  if (!Number.isInteger(Number(total_copies)) || Number(total_copies) < 0 || Number(total_copies) > 100000)
    throw httpError(400, 'จำนวนเล่มต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 100000');
  if (isbn != null && (typeof isbn !== 'string' || isbn.length > 32)) throw httpError(400, 'ISBN ไม่ถูกต้อง');
  if (description != null && (typeof description !== 'string' || description.length > 10000)) throw httpError(400, 'รายละเอียดไม่ถูกต้อง');
  return [title.trim(), author.trim(), isbn?.trim() || null, description || '', category_id ? positiveId(category_id) : null, Number(total_copies)];
}
router.post('/', allow('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { rows } = await pool.query(`INSERT INTO books(title,author,isbn,description,category_id,total_copies)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, bookValues(req.body));
  res.status(201).json(rows[0]);
});
router.put('/:id', allow('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const id = positiveId(req.params.id);
  const values = bookValues(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // All stock-changing routes lock the book first to prevent overbooking.
    const locked = await client.query('SELECT id FROM books WHERE id=$1 FOR UPDATE', [id]);
    if (!locked.rows[0]) throw httpError(404, 'ไม่พบหนังสือ');
    const stock = await client.query(`SELECT total_copies - (${availableSql}) AS used FROM books b WHERE b.id=$1`, [id]);
    if (values[5] < stock.rows[0].used) throw httpError(409, 'จำนวนเล่มน้อยกว่าจำนวนที่ถูกยืมและจองอยู่');
    const { rows } = await client.query(`UPDATE books SET title=$1,author=$2,isbn=$3,description=$4,
      category_id=$5,total_copies=$6 WHERE id=$7 RETURNING *`, [...values, id]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});
router.delete('/:id', allow('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const result = await pool.query('DELETE FROM books WHERE id=$1 RETURNING id', [positiveId(req.params.id)]);
  if (!result.rowCount) throw httpError(404, 'ไม่พบหนังสือ');
  res.json({ message: 'ลบหนังสือแล้ว' });
});
export default router;
