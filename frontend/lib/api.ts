const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('library-token') : null;
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
  return data as T;
}
export type User = { id: number; name: string; email: string; role: 'MEMBER' | 'LIBRARIAN' | 'ADMIN'; active: boolean };
export type Category = { id: number; name: string };
export type Book = { id: number; title: string; author: string; isbn: string | null; description: string; category_id: number | null; category_name: string; total_copies: number; available_copies: number };
export type Reservation = { id: number; title: string; member_name: string; email: string; status: string; created_at: string; expires_at: string };
export type Loan = { id: number; title: string; member_name: string; email: string; status: string; borrowed_at: string; due_at: string; returned_at: string | null; overdue: boolean };
export function date(value: string | null) { return value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
export const statusText: Record<string, string> = { PENDING: 'รอรับที่เคาน์เตอร์', CANCELLED: 'ยกเลิกแล้ว', EXPIRED: 'หมดอายุ', FULFILLED: 'ยืนยันยืมแล้ว', BORROWED: 'กำลังยืม', RETURNED: 'คืนแล้ว' };
