'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';

type Session = {
  user: User | null;
  setUser: (user: User | null) => void;
  notify: (text: string, error?: boolean) => void;
  login: (user: User) => void;
};
const AppContext = createContext<Session | null>(null);
export function useApp() {
  const session = useContext(AppContext);
  if (!session) throw new Error('Page must be inside AppShell');
  return session;
}
const labels: Record<string, string> = { catalog: 'ค้นหาหนังสือ', dashboard: 'Dashboard / ยืมที่เคาน์เตอร์', reservations: 'รายการจอง', loans: 'หนังสือที่กำลังยืม', history: 'ประวัติการยืม', overdue: 'รายการเกินกำหนด', books: 'จัดการหนังสือ', members: 'สมาชิก', categories: 'จัดการหมวดหมู่', staff: 'บัญชีเจ้าหน้าที่', reports: 'รายงาน', profile: 'โปรไฟล์', login: 'เข้าสู่ระบบ', register: 'สมัครสมาชิก' };
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const staff = !!user && user.role !== 'MEMBER';
  const links: Record<string, string> = { catalog: '/books', dashboard: '/dashboard', books: '/manage-books', reservations: staff ? '/reservations' : '/my-reservations', loans: '/loans', history: '/history', overdue: '/overdue', members: '/members', categories: '/categories', staff: '/staff', reports: '/reports', profile: '/profile', login: '/login', register: '/register' };
  const page = Object.keys(links).find(key => links[key] === pathname) || 'catalog';
  const publicPage = pathname === '/login' || pathname === '/register';
  const staffPage = ['/dashboard', '/manage-books', '/reservations', '/overdue', '/members'].includes(pathname);
  const adminPage = ['/categories', '/staff', '/reports'].includes(pathname);
  const allowed = publicPage || (!!user && (!staffPage || staff) && (!adminPage || user.role === 'ADMIN'));
  useEffect(() => {
    if (!sessionStorage.getItem('library-token')) { setReady(true); return; }
    api<User>('/auth/me').then(setUser).catch(() => sessionStorage.removeItem('library-token')).finally(() => setReady(true));
  }, []);
  useEffect(() => { setNotice(null); }, [pathname]);
  useEffect(() => {
    if (!ready) return;
    if (!publicPage && !user) router.replace('/login');
    if (publicPage && user) router.replace(user.role === 'MEMBER' ? '/books' : '/dashboard');
  }, [pathname, ready, publicPage, user, router]);
  function notify(text: string, error = false) { setNotice({ text, error }); }
  function login(u: User) { setUser(u); router.push(u.role === 'MEMBER' ? '/books' : '/dashboard'); setNotice(null); }
  const menu = ['catalog', ...(staff ? ['dashboard', 'books'] : []), ...(user ? ['reservations', 'loans', 'history'] : []), ...(staff ? ['overdue', 'members'] : []), ...(user?.role === 'ADMIN' ? ['categories', 'staff', 'reports'] : []), ...(user ? ['profile'] : ['login'])];
  if (!ready) return <p className="p-10">กำลังเปิดห้องสมุด…</p>;
  if (!user || publicPage) return <AppContext.Provider value={{ user, setUser, notify, login }}>
    <main className="min-h-screen px-5 py-12">
      <div className="flex items-center justify-center gap-3"><img src="/book.svg" alt="" width={48} height={48} /><div><strong className="text-xl">LIBRARY</strong><p className="muted text-xs">ระบบจัดการห้องสมุด</p></div></div>
      {publicPage && !user ? children : <p className="text-center mt-10">กำลังเปลี่ยนหน้า…</p>}
    </main>
  </AppContext.Provider>;
  return <AppContext.Provider value={{ user, setUser, notify, login }}><div className="min-h-screen lg:flex">
    <aside className="lg:w-64 lg:shrink-0 bg-white border-r border-[#dfe5dc] p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto"><div className="flex items-center gap-3 mb-7"><img src="/book.svg" alt="" width={43} height={43} /><div><strong className="text-xl tracking-tight">LIBRARY</strong><p className="muted text-xs mt-1">ระบบจัดการห้องสมุด</p></div></div><p className="muted text-xs px-4 mb-3">{staff ? 'พื้นที่เจ้าหน้าที่' : 'พื้นที่การอ่านของคุณ'}</p><nav aria-label="เมนูหลัก" className="flex overflow-x-auto lg:flex-col gap-1">{menu.map(key => <Link key={key} className={`nav-item ${pathname === links[key] ? 'active' : ''}`} href={links[key]} onClick={() => setNotice(null)}>{key === 'reservations' && !staff ? 'การจองของฉัน' : labels[key]}</Link>)}</nav><div className="hidden lg:block mt-8 p-4 bg-[#f5f7f1] rounded-xl text-xs muted leading-6">จองออนไลน์ รับที่เคาน์เตอร์<br />ยืม 14 วัน • จองเก็บไว้ 3 วัน</div></aside>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-40 px-6 md:px-10 py-5 bg-white border-b border-[#dfe5dc] flex justify-between gap-4 items-center"><p className="muted">ห้องสมุด / <span className="text-library">{labels[page]}</span></p>{user ? <div className="flex gap-3 items-center"><div className="text-right"><p className="font-semibold">{user.name}</p><p className="text-xs muted">{user.role}</p></div><button className="btn secondary text-xs" onClick={() => { sessionStorage.removeItem('library-token'); setUser(null); router.replace('/login'); setNotice(null); }}>ออกจากระบบ</button></div> : <button className="btn" onClick={() => router.push('/login')}>เข้าสู่ระบบ</button>}</header>
      <main className="max-w-7xl mx-auto p-5 md:p-10">{page !== 'catalog' && page !== 'login' && page !== 'register' && <div className="mb-7"><p className="muted text-xs mb-2">LIBRARY MANAGEMENT</p><h1>{page === 'reservations' && !staff ? 'การจองของฉัน' : labels[page]}</h1></div>}
        {notice && <div role={notice.error ? 'alert' : 'status'} className={`mb-6 p-4 rounded-lg flex justify-between gap-4 ${notice.error ? 'bg-red-50 text-red-800' : 'bg-green-100 text-green-900'}`}><span>{notice.text}</span><button aria-label="ปิดข้อความ" onClick={() => setNotice(null)}>✕</button></div>}
        {allowed ? children : <p className="panel">{user ? "ไม่มีสิทธิ์เข้าถึงหน้านี้" : "กำลังไปหน้าเข้าสู่ระบบ…"}</p>}
      </main><footer className="px-10 py-6 muted text-xs">LIBRARY SYSTEM · เรียนรู้ได้ทุกวัน ผ่านหนังสือทุกเล่ม</footer>
    </div>
  </div></AppContext.Provider>;
}
