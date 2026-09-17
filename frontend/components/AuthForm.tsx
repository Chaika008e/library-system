'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, User } from '@/lib/api';
export default function AuthForm({ onLogin, register = false }: { onLogin: (user: User) => void; register?: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="max-w-md mx-auto panel mt-10">
    <p className="muted mb-2">LIBRARY ACCOUNT</p><h1>{register ? 'สมัครสมาชิก' : 'ยินดีต้อนรับกลับ'}</h1>
    <p className="muted mt-2 mb-6">เข้าสู่ระบบเพื่อจองหนังสือและดูรายการของคุณ</p>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      const data = Object.fromEntries(new FormData(e.currentTarget));
      try { const result = await api<{ user: User; token: string }>(`/auth/${register ? 'register' : 'login'}`, 'POST', data);
        sessionStorage.setItem('library-token', result.token); onLogin(result.user);
      } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      {register && <label>ชื่อ–นามสกุล<input name="name" required maxLength={100} autoComplete="name" /></label>}
      <label>อีเมล<input name="email" type="email" required autoComplete="email" /></label>
      <label>รหัสผ่าน<input name="password" type="password" minLength={8} required autoComplete={register ? 'new-password' : 'current-password'} /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : register ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button>
    </form>
    <Link className="inline-block mt-5 text-library underline" href={register ? "/login" : "/register"}>{register ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}</Link>
  </div>;
}
