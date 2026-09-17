-- Run this entire file in pgAdmin Query Tool connected to library_system.
-- UTF-8 / PostgreSQL. No extensions, ORM or command-line variables are needed.
-- Create an empty database named library_system in pgAdmin first.
-- Safe to run again: existing data is preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER','LIBRARIAN','ADMIN')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
);
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(150) NOT NULL,
  isbn VARCHAR(32) UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CANCELLED','FULFILLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '3 days'),
  CHECK (expires_at > created_at)
);
CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  reservation_id INTEGER UNIQUE REFERENCES reservations(id),
  borrowed_by INTEGER NOT NULL REFERENCES users(id),
  returned_by INTEGER REFERENCES users(id),
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '14 days'),
  returned_at TIMESTAMPTZ,
  CHECK (due_at > borrowed_at),
  CHECK (returned_at IS NULL OR returned_at >= borrowed_at),
  CHECK ((returned_at IS NULL) = (returned_by IS NULL))
);
CREATE INDEX IF NOT EXISTS reservations_stock_idx ON reservations(book_id,expires_at) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS reservations_user_idx ON reservations(user_id);
CREATE INDEX IF NOT EXISTS loans_stock_idx ON loans(book_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS loans_due_idx ON loans(due_at) WHERE returned_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_member_book ON loans(user_id,book_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS books_category_idx ON books(category_id);

-- Demo password for all three accounts: Library123!
-- A bcrypt hash is inserted below; PostgreSQL does not need pgcrypto.
INSERT INTO users(name,email,password_hash,role) VALUES
 ('ผู้ดูแลระบบ','admin@library.local','$2b$12$2xKqQGRDQ/9bK2fSDKAbbObjHcouUx/fS0OxQ5cO9/DTrGvt1bvWy','ADMIN'),
 ('บรรณารักษ์','librarian@library.local','$2b$12$2xKqQGRDQ/9bK2fSDKAbbObjHcouUx/fS0OxQ5cO9/DTrGvt1bvWy','LIBRARIAN'),
 ('สมาชิกตัวอย่าง','member@library.local','$2b$12$2xKqQGRDQ/9bK2fSDKAbbObjHcouUx/fS0OxQ5cO9/DTrGvt1bvWy','MEMBER')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories(name) VALUES ('เทคโนโลยี'),('วรรณกรรม'),('พัฒนาตนเอง'),('วิทยาศาสตร์') ON CONFLICT (name) DO NOTHING;
INSERT INTO books(title,author,isbn,description,category_id,total_copies) VALUES
 ('เริ่มต้นเขียนโปรแกรม JavaScript','ทีมการเรียนรู้','DEMO-JS-001','เรียนรู้ตัวแปร เงื่อนไข ฟังก์ชัน และการพัฒนาเว็บผ่านตัวอย่างที่อ่านง่าย',(SELECT id FROM categories WHERE name='เทคโนโลยี'),5),
 ('ฐานข้อมูล PostgreSQL เบื้องต้น','ทีมการเรียนรู้','DEMO-PG-002','ฝึกออกแบบตารางและเขียน SQL ตั้งแต่ SELECT ไปจนถึง JOIN และ transaction',(SELECT id FROM categories WHERE name='เทคโนโลยี'),3),
 ('เรื่องเล่าจากห้องสมุด','นักเขียนตัวอย่าง','DEMO-LIT-003','เรื่องสั้นเกี่ยวกับผู้คน ความทรงจำ และการค้นพบสิ่งใหม่บนชั้นหนังสือ',(SELECT id FROM categories WHERE name='วรรณกรรม'),4),
 ('สร้างนิสัยการอ่าน','ทีมการเรียนรู้','DEMO-SELF-004','แนวทางจัดเวลา ตั้งเป้าหมาย และบันทึกสิ่งที่เรียนรู้จากการอ่านในแต่ละวัน',(SELECT id FROM categories WHERE name='พัฒนาตนเอง'),2),
 ('วิทยาศาสตร์รอบตัว','ทีมการเรียนรู้','DEMO-SCI-005','สำรวจคำถามในชีวิตประจำวันด้วยการสังเกตและการทดลองอย่างง่าย',(SELECT id FROM categories WHERE name='วิทยาศาสตร์'),3),
 ('พัฒนาเว็บด้วย Next.js','ทีมการเรียนรู้','DEMO-NEXT-006','หนังสือประกอบการเรียนเรื่องหน้าเว็บ คอมโพเนนต์ และการเชื่อมต่อ API',(SELECT id FROM categories WHERE name='เทคโนโลยี'),2)
ON CONFLICT (isbn) DO NOTHING;

-- One returned sample loan and one overdue sample loan, inserted only once.
INSERT INTO loans(user_id,book_id,borrowed_by,returned_by,borrowed_at,due_at,returned_at)
SELECT u.id,b.id,s.id,s.id,NOW()-INTERVAL '25 days',NOW()-INTERVAL '11 days',NOW()-INTERVAL '15 days'
FROM users u, books b, users s
WHERE u.email='member@library.local' AND b.isbn='DEMO-LIT-003' AND s.email='librarian@library.local'
AND NOT EXISTS (SELECT 1 FROM loans WHERE user_id=u.id AND book_id=b.id);
INSERT INTO loans(user_id,book_id,borrowed_by,borrowed_at,due_at)
SELECT u.id,b.id,s.id,NOW()-INTERVAL '16 days',NOW()-INTERVAL '2 days'
FROM users u, books b, users s
WHERE u.email='member@library.local' AND b.isbn='DEMO-SCI-005' AND s.email='librarian@library.local'
AND NOT EXISTS (SELECT 1 FROM loans WHERE user_id=u.id AND book_id=b.id);
COMMIT;
