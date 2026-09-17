import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, positiveId, httpError } from '../db.js';
import { authenticate, allow, validateAccount } from './auth.js';
const router = Router();
router.use(authenticate);
router.put('/me', async (req, res) => {
  const { name, email, password, current_password } = req.body;
  validateAccount({ name, email, password: password || 'unchanged-password' });
  let hash = null;
  if (password) {
    const user = (await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id])).rows[0];
    if (typeof current_password !== 'string' || !(await bcrypt.compare(current_password, user.password_hash)))
      throw httpError(400, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    hash = await bcrypt.hash(password, 12);
  }
  const { rows } = await pool.query(`UPDATE users SET name=$1,email=$2,password_hash=COALESCE($3,password_hash)
    WHERE id=$4 RETURNING id,name,email,role,active`, [name.trim(), email.toLowerCase().trim(), hash, req.user.id]);
  res.json(rows[0]);
});
router.get('/', allow('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { rows } = await pool.query(`SELECT id,name,email,role,active,created_at FROM users
    WHERE ($1::boolean OR role='MEMBER') ORDER BY id`, [req.user.role === 'ADMIN']);
  res.json(rows);
});
router.post('/', allow('ADMIN'), async (req, res) => {
  validateAccount(req.body);
  const { name, email, password, role } = req.body;
  if (!['LIBRARIAN', 'ADMIN'].includes(role)) throw httpError(400, 'เลือกสิทธิ์เจ้าหน้าที่ให้ถูกต้อง');
  const { rows } = await pool.query(`INSERT INTO users(name,email,password_hash,role)
    VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,active`, [name.trim(), email.toLowerCase().trim(), await bcrypt.hash(password, 12), role]);
  res.status(201).json(rows[0]);
});
router.patch('/:id', allow('ADMIN'), async (req, res) => {
  const id = positiveId(req.params.id);
  if (id === req.user.id) throw httpError(400, 'ไม่สามารถเปลี่ยนสิทธิ์หรือปิดบัญชีตัวเองได้');
  const { role, active } = req.body;
  if (!['MEMBER', 'LIBRARIAN', 'ADMIN'].includes(role) || typeof active !== 'boolean') throw httpError(400, 'ข้อมูลสิทธิ์ไม่ถูกต้อง');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize account changes to preserve at least one active administrator.
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    const target = (await client.query('SELECT * FROM users WHERE id=$1', [id])).rows[0];
    if (!target) throw httpError(404, 'ไม่พบผู้ใช้');
    if (target.role === 'ADMIN' && target.active && (role !== 'ADMIN' || !active)) {
      const admins = await client.query("SELECT id FROM users WHERE role='ADMIN' AND active");
      if (admins.rowCount <= 1) throw httpError(409, 'ต้องมีผู้ดูแลระบบที่ใช้งานอย่างน้อย 1 คน');
    }
    if (target.role !== role) {
      const pending = await client.query(`SELECT id FROM loans WHERE user_id=$1 AND returned_at IS NULL
        UNION ALL SELECT id FROM reservations WHERE user_id=$1 AND status='PENDING' AND expires_at>NOW()`, [id]);
      if (pending.rowCount) throw httpError(409, 'ต้องคืนหนังสือและยกเลิกการจองก่อนเปลี่ยนสิทธิ์');
    }
    const { rows } = await client.query('UPDATE users SET role=$1,active=$2 WHERE id=$3 RETURNING id,name,email,role,active', [role, active, id]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});
export default router;
