'use client';
import { useState } from 'react';
import { api, User } from '@/lib/api';
import { useApp } from '@/components/AppShell';
export default function ProfilePage() {
  const { user, setUser: update, notify } = useApp();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return <form className="panel max-w-xl space-y-5" onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget; setBusy(true);
    try { update(await api<User>('/users/me', 'PUT', Object.fromEntries(new FormData(form)))); form.reset(); notify('บันทึกโปรไฟล์แล้ว'); }
    catch (err) { notify((err as Error).message, true); } finally { setBusy(false); }
  }}><h2>ข้อมูลส่วนตัว</h2><label>ชื่อ–นามสกุล<input name="name" defaultValue={user.name} required maxLength={100} /></label><label>อีเมล<input name="email" type="email" defaultValue={user.email} required /></label><p className="muted">สิทธิ์: {user.role}</p><hr className="border-gray-200" /><p>เปลี่ยนรหัสผ่าน (เว้นว่างหากไม่ต้องการเปลี่ยน)</p><label>รหัสผ่านปัจจุบัน<input name="current_password" type="password" autoComplete="current-password" /></label><label>รหัสผ่านใหม่<input name="password" type="password" minLength={8} autoComplete="new-password" /></label><button className="btn" disabled={busy}>บันทึกข้อมูล</button></form>;
}
