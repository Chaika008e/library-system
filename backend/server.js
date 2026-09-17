import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import authRouter from './routes/auth.js';
import booksRouter from './routes/books.js';
import categoriesRouter from './routes/categories.js';
import reservationsRouter from './routes/reservations.js';
import loansRouter from './routes/loans.js';
import usersRouter from './routes/users.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  throw new Error('Please set JWT_SECRET to at least 24 characters in backend/.env');
}
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
});
app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/users', usersRouter);
app.use((req, res) => res.status(404).json({ message: 'ไม่พบ API ที่เรียก' }));
app.use((error, req, res, next) => {
  if (error.code === '23505') return res.status(409).json({ message: 'ข้อมูลนี้มีอยู่แล้ว' });
  if (error.code === '23503') return res.status(409).json({ message: 'ข้อมูลนี้มีรายการอ้างอิงอยู่ ไม่สามารถลบได้' });
  if (error.code === '23514') return res.status(400).json({ message: 'ข้อมูลไม่ผ่านเงื่อนไขของระบบ' });
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ message: status >= 500 ? 'เชื่อมต่อฐานข้อมูลหรือประมวลผลไม่สำเร็จ กรุณาตรวจ backend' : error.message });
});
const server = app.listen(Number(process.env.PORT) || 4000, () => {
  console.log(`Library API ready at http://localhost:${process.env.PORT || 4000}`);
});
async function shutdown() {
  server.close(async () => { await pool.end(); process.exit(0); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
