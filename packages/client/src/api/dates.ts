export interface ImportantDate {
  id: number;
  user_id: number;
  title: string;
  date: string;
  recurs_yearly: number;
  notes: string | null;
  created_at: string;
  next_occurrence: string;
}

import { apiUrl } from './base';

const h = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

export async function getDates(token: string): Promise<ImportantDate[]> {
  const res = await fetch(apiUrl('/api/dates'), { headers: h(token) });
  if (!res.ok) throw new Error('Failed to fetch dates');
  return res.json();
}

export async function createDate(token: string, data: Partial<ImportantDate>): Promise<ImportantDate> {
  const res = await fetch(apiUrl('/api/dates'), { method: 'POST', headers: h(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create date');
  return res.json();
}

export async function updateDate(token: string, id: number, data: Partial<ImportantDate>): Promise<ImportantDate> {
  const res = await fetch(apiUrl(`/api/dates/${id}`), { method: 'PATCH', headers: h(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update date');
  return res.json();
}

export async function deleteDate(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/dates/${id}`), { method: 'DELETE', headers: h(token) });
  if (!res.ok) throw new Error('Failed to delete date');
}
