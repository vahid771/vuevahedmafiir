import { apiUrl, authHeaders } from './base';

export interface AdminImageRecord {
  id: number;
  user_id: number;
  user_email: string;
  title: string;
  filename: string;
  mimetype: string;
  size: number;
  tags: string;          // JSON string
  drive_file_id: string | null;
  drive_view_link: string | null;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
}

export interface AdminUser {
  id: number;
  email: string;
  is_admin: number;
  created_at: string;
}

export async function getAdminImages(token: string): Promise<AdminImageRecord[]> {
  const res = await fetch(apiUrl('/api/admin/images'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch images');
  return res.json();
}

export async function reviewImage(
  token: string,
  id: number,
  status: 'approved' | 'rejected' | 'pending',
  note?: string,
): Promise<AdminImageRecord> {
  const res = await fetch(apiUrl(`/api/admin/images/${id}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status, note }),
  });
  if (!res.ok) throw new Error('Failed to update review');
  return res.json();
}

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  const res = await fetch(apiUrl('/api/admin/users'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function setUserAdmin(token: string, userId: number, isAdmin: boolean): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/users/${userId}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ is_admin: isAdmin ? 1 : 0 }),
  });
  if (!res.ok) throw new Error('Failed to update user');
}
