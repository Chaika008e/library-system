'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, Book } from '@/lib/api';
import { useApp } from '@/components/AppShell';

export default function BookDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, notify } = useApp();

  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    api<Book>(`/books/${encodeURIComponent(id)}`)
      .then((value) => {
        if (active) setBook(value);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function reserve() {
    // ยังไม่ได้ล็อกอิน
    if (!user) {
      alert('กรุณาล็อกอินเข้าสู่ระบบ');
      router.push('/login');
      return;
    }

    if (!book) return;

    setBusy(true);

    try {
      await api('/reservations', 'POST', {
        book_id: book.id,
      });

      // โหลดข้อมูลหนังสือใหม่
      setBook(
        await api<Book>(`/books/${book.id}`)
      );

      notify(
        'จองสำเร็จ กรุณารับหนังสือที่เคาน์เตอร์ภายใน 3 วัน'
      );
    } catch (err) {
      notify(
        (err as Error).message,
        true
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/"
        className="btn secondary"
      >
        ← กลับหน้าหนังสือ
      </Link>

      {error ? (
        <p
          role="alert"
          className="panel text-red-700"
        >
          {error}
        </p>
      ) : !book ? (
        <p className="panel">
          กำลังโหลดรายละเอียด…
        </p>
      ) : (
        <article className="panel max-w-3xl">
          <p className="muted mb-2">
            {book.category_name || 'ทั่วไป'}
          </p>

          <h1>{book.title}</h1>

          <p className="muted mt-3">
            ผู้แต่ง: {book.author}
          </p>

          <p className="my-6 whitespace-pre-wrap">
            {book.description || 'ยังไม่มีรายละเอียด'}
          </p>

          <p className="muted">
            ISBN: {book.isbn || '—'}
          </p>

          <p className="my-4">
            ว่าง {book.available_copies} จาก{' '}
            {book.total_copies} เล่ม
          </p>

          <p className="mb-6">
            รับหนังสือภายใน 3 วันหลังจอง
            เจ้าหน้าที่จะยืนยันการยืมที่เคาน์เตอร์
            และเริ่มนับเวลายืม 14 วัน
          </p>

          {(!user || user.role === 'MEMBER') && (
            <div className="flex flex-wrap gap-3">
              <button
                className="btn"
                disabled={
                  busy ||
                  book.available_copies < 1
                }
                onClick={reserve}
              >
                {busy
                  ? 'กำลังจอง…'
                  : book.available_copies < 1
                    ? 'ไม่มีหนังสือว่าง'
                    : 'จองหนังสือเล่มนี้'}
              </button>

              {user && (
                <Link
                  className="btn secondary"
                  href="/my-reservations"
                >
                  การจองของฉัน
                </Link>
              )}
            </div>
          )}
        </article>
      )}
    </div>
  );
}