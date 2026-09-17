'use client';
import { useEffect, useState } from 'react';
import { api, date, Loan, Reservation, statusText, User } from '@/lib/api';
export default function Records({ user, mode, notify }: { user: User; mode: string; notify: (s: string, error?: boolean) => void }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const staff = user.role !== 'MEMBER';
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api<Reservation[]>('/reservations'), api<Loan[]>('/loans')])
      .then(([r, l]) => { if (active) { setReservations(r); setLoans(l); setError(''); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, revision]);
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    try { await api(path, method, body); setRevision(v => v + 1); notify('ทำรายการสำเร็จ'); }
    catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
  }
  if (loading) return <p className="panel">กำลังโหลดรายการ…</p>;
  if (error) return <p className="panel text-red-700" role="alert">{error}</p>;
  const filtered = loans.filter(l => mode === 'history' ? l.status === 'RETURNED' : mode === 'overdue' ? l.overdue : l.status === 'BORROWED');
  return <div className="panel overflow-x-auto"><p className="muted mb-5">{mode === 'reservations' ? 'การจองเก็บไว้ 3 วัน กรุณาติดต่อเจ้าหน้าที่เพื่อรับหนังสือ' : 'ระยะเวลายืม 14 วัน • การยืมและรับคืนยืนยันโดยเจ้าหน้าที่เท่านั้น'}</p>
    {mode === 'reservations' ? reservations.length ? <table><thead><tr><th>หนังสือ / สมาชิก</th><th>จองเมื่อ</th><th>รับภายใน</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody>{reservations.map(r => <tr key={r.id}><td><strong>{r.title}</strong>{staff && <p className="muted text-xs">{r.member_name} · {r.email}</p>}<p className="muted text-xs">#{r.id}</p></td><td>{date(r.created_at)}</td><td>{date(r.expires_at)}</td><td><span className="badge">{statusText[r.status]}</span></td><td>{r.status === 'PENDING' && <div className="flex gap-2">{staff && <button className="btn" disabled={busy} onClick={() => { if (confirm('ยืนยันว่าสมาชิกมารับหนังสือที่เคาน์เตอร์แล้ว?')) action('/loans', 'POST', { reservation_id: r.id }); }}>ยืนยันการยืม</button>}<button className="btn danger" disabled={busy} onClick={() => { if (confirm('ยกเลิกการจองนี้?')) action(`/reservations/${r.id}/cancel`, 'PATCH'); }}>ยกเลิก</button></div>}</td></tr>)}</tbody></table> : <p>ยังไม่มีรายการจอง</p>
      : filtered.length ? <table><thead><tr><th>หนังสือ / สมาชิก</th><th>วันที่ยืม</th><th>กำหนดคืน</th><th>สถานะ</th><th>{mode === 'history' ? 'คืนเมื่อ' : 'ดำเนินการ'}</th></tr></thead><tbody>{filtered.map(l => <tr key={l.id}><td><strong>{l.title}</strong>{staff && <p className="muted text-xs">{l.member_name} · {l.email}</p>}</td><td>{date(l.borrowed_at)}</td><td className={l.overdue ? 'text-red-700' : ''}>{date(l.due_at)}</td><td><span className={`badge ${l.overdue ? 'text-red-700' : ''}`}>{l.overdue ? 'เกินกำหนด' : statusText[l.status]}</span></td><td>{l.returned_at ? date(l.returned_at) : staff ? <button className="btn" disabled={busy} onClick={() => { if (confirm('ได้รับหนังสือคืนที่เคาน์เตอร์แล้ว?')) action(`/loans/${l.id}/return`, 'PATCH'); }}>ยืนยันรับคืน</button> : 'คืนที่เคาน์เตอร์'}</td></tr>)}</tbody></table> : <p>ยังไม่มีรายการในหมวดนี้</p>}
  </div>;
}
