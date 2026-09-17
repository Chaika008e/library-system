'use client';
import { useEffect, useState } from 'react';
import { api, Book, Category } from '@/lib/api';
import { useApp } from '@/components/AppShell';
export default function ManageBooksPage() {
  const { notify } = useApp();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Book | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { Promise.all([api<Book[]>('/books'), api<Category[]>('/categories')]).then(([b, c]) => { setBooks(b); setCategories(c); setError(''); }).catch(e => setError(e.message)); }, [revision]);
  return <div className="space-y-5"><button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>+ เพิ่มหนังสือ</button>{error && <p role="alert" className="text-red-700">{error}</p>}
    {showForm && <form key={editing?.id || 'new'} className="panel grid sm:grid-cols-2 gap-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); const data = Object.fromEntries(new FormData(e.currentTarget));
      try { await api(editing ? `/books/${editing.id}` : '/books', editing ? 'PUT' : 'POST', data); setShowForm(false); setRevision(v => v + 1); notify('บันทึกหนังสือแล้ว'); }
      catch (err) { notify((err as Error).message, true); } finally { setBusy(false); }
    }}><h2 className="sm:col-span-2">{editing ? 'แก้ไขหนังสือ' : 'เพิ่มหนังสือ'}</h2><label>ชื่อหนังสือ<input name="title" required maxLength={200} defaultValue={editing?.title} /></label><label>ผู้แต่ง<input name="author" required maxLength={150} defaultValue={editing?.author} /></label><label>ISBN<input name="isbn" maxLength={32} defaultValue={editing?.isbn || ''} /></label><label>จำนวนเล่มทั้งหมด<input type="number" name="total_copies" min={0} max={100000} required defaultValue={editing?.total_copies ?? 1} /></label><label>หมวดหมู่<select name="category_id" defaultValue={editing?.category_id || ''}><option value="">ทั่วไป</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="sm:col-span-2">รายละเอียด<textarea name="description" rows={3} maxLength={10000} defaultValue={editing?.description} /></label><div className="flex gap-2"><button className="btn" disabled={busy}>บันทึก</button><button type="button" className="btn secondary" onClick={() => setShowForm(false)}>ปิด</button></div></form>}
    <div className="panel overflow-x-auto"><table><thead><tr><th>ชื่อหนังสือ</th><th>หมวดหมู่</th><th>ทั้งหมด / ว่าง</th><th>จัดการ</th></tr></thead><tbody>{books.map(b => <tr key={b.id}><td><strong>{b.title}</strong><p className="muted text-xs">{b.author}</p></td><td>{b.category_name || 'ทั่วไป'}</td><td>{b.total_copies} / {b.available_copies}</td><td className="flex gap-2"><button className="btn secondary" onClick={() => { setEditing(b); setShowForm(true); }}>แก้ไข</button><button className="btn danger" disabled={busy} onClick={async () => {
      if (!confirm(`ลบหนังสือ “${b.title}”? หนังสือที่มีประวัติการยืมหรือจองจะลบไม่ได้`)) return;
      setBusy(true); try { await api(`/books/${b.id}`, 'DELETE'); setRevision(v => v + 1); notify('ลบหนังสือแล้ว'); } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
    }}>ลบ</button></td></tr>)}</tbody></table>{!books.length && <p className="mt-4 muted">ยังไม่มีหนังสือ</p>}</div>
  </div>;
}
