'use client';
import { useEffect, useState } from 'react';
import { api, Category, User } from '@/lib/api';
type Reports = { monthly: { month: string; loans: number; returned: number }[]; popular: { title: string; loans: number }[] };
export default function Administration({ mode, user, notify }: { mode: string; user: User; notify: (s: string, error?: boolean) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reports, setReports] = useState<Reports | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setError('');
    if (mode === 'categories') api<Category[]>('/categories').then(setCategories).catch(e => setError(e.message));
    else if (mode === 'reports') api<Reports>('/loans/reports').then(setReports).catch(e => setError(e.message));
    else api<User[]>('/users').then(setUsers).catch(e => setError(e.message));
  }, [mode, revision]);
  async function save(path: string, method: string, body?: unknown) {
    setBusy(true);
    try { await api(path, method, body); setRevision(v => v + 1); notify('บันทึกข้อมูลแล้ว'); return true; }
    catch (e) { notify((e as Error).message, true); return false; } finally { setBusy(false); }
  }
  if (error) return <p className="panel text-red-700" role="alert">{error}</p>;
  if (mode === 'reports') return <div className="grid lg:grid-cols-2 gap-5"><div className="panel overflow-x-auto"><h2 className="mb-5">การยืมรายเดือน</h2><p className="muted mb-3">12 เดือนล่าสุดที่มีการยืม • คืนแล้วนับจากรายการที่ยืมในเดือนนั้น</p><table><thead><tr><th>เดือน</th><th>ยืม</th><th>คืนแล้ว</th></tr></thead><tbody>{reports?.monthly.map(r => <tr key={r.month}><td>{r.month}</td><td>{r.loans}</td><td>{r.returned}</td></tr>)}</tbody></table>{!reports?.monthly.length && <p className="mt-4">ยังไม่มีข้อมูล</p>}</div><div className="panel"><h2 className="mb-5">หนังสือยอดนิยม 10 อันดับ</h2>{reports?.popular.map((r, i) => <div key={r.title + i} className="flex justify-between border-b border-gray-100 py-4 gap-5"><span>{i + 1}. {r.title}</span><span>{r.loans} ครั้ง</span></div>)}{!reports?.popular.length && <p>ยังไม่มีข้อมูล</p>}</div></div>;
  if (mode === 'categories') return <div className="panel max-w-2xl space-y-5"><form className="flex gap-3 items-end" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await save('/categories', 'POST', Object.fromEntries(new FormData(form)))) form.reset(); }}><label className="flex-1">ชื่อหมวดหมู่ใหม่<input name="name" required maxLength={100} /></label><button className="btn" disabled={busy}>เพิ่ม</button></form>{categories.map(c => <form key={`${c.id}-${c.name}`} className="flex items-end gap-2" onSubmit={async e => { e.preventDefault(); await save(`/categories/${c.id}`, 'PUT', Object.fromEntries(new FormData(e.currentTarget))); }}><label className="flex-1">หมวดหมู่ #{c.id}<input name="name" defaultValue={c.name} maxLength={100} required /></label><button className="btn secondary" disabled={busy}>บันทึก</button><button type="button" className="btn danger" disabled={busy} onClick={() => { if (confirm(`ลบหมวดหมู่ “${c.name}”?`)) save(`/categories/${c.id}`, 'DELETE'); }}>ลบ</button></form>)}</div>;
  const shown = users.filter(u => mode === 'staff' ? u.role !== 'MEMBER' : u.role === 'MEMBER');
  return <div className="space-y-5">{mode === 'staff' && <form className="panel grid sm:grid-cols-2 gap-4" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await save('/users', 'POST', Object.fromEntries(new FormData(form)))) form.reset(); }}><h2 className="sm:col-span-2">เพิ่มบัญชีเจ้าหน้าที่</h2><label>ชื่อ–นามสกุล<input name="name" maxLength={100} required /></label><label>อีเมล<input name="email" type="email" required /></label><label>รหัสผ่านเริ่มต้น<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label><label>สิทธิ์<select name="role"><option>LIBRARIAN</option><option>ADMIN</option></select></label><button className="btn w-fit" disabled={busy}>สร้างบัญชี</button></form>}
    <div className="panel overflow-x-auto"><table><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>สิทธิ์</th><th>สถานะ</th>{user.role === 'ADMIN' && <th>จัดการ</th>}</tr></thead><tbody>{shown.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{user.role === 'ADMIN' && u.id !== user.id ? <select aria-label={`สิทธิ์ของ ${u.name}`} value={u.role} disabled={busy} onChange={e => { if (confirm(`เปลี่ยนสิทธิ์ของ ${u.name}?`)) save(`/users/${u.id}`, 'PATCH', { role: e.target.value, active: u.active }); }}><option>MEMBER</option><option>LIBRARIAN</option><option>ADMIN</option></select> : u.role}</td><td><span className="badge">{u.active ? 'ใช้งาน' : 'ปิดบัญชี'}</span></td>{user.role === 'ADMIN' && <td>{u.id !== user.id && <button disabled={busy} className="btn secondary" onClick={() => { if (confirm(`${u.active ? 'ปิด' : 'เปิด'}บัญชี ${u.name}?`)) save(`/users/${u.id}`, 'PATCH', { role: u.role, active: !u.active }); }}>{u.active ? 'ปิดบัญชี' : 'เปิดบัญชี'}</button>}</td>}</tr>)}</tbody></table>{!shown.length && <p className="mt-4">ยังไม่มีบัญชี</p>}</div>
  </div>;
}
