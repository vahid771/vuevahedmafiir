import { apiUrl, authHeaders } from './base';

const BASE = '/api/task-groups';

export interface TaskGroup {
  id: number;
  user_id: number;
  name: string;
  google_list_id: string | null;
  sort_order: number;
  is_default: number;
  created_at: string;
}

export async function getTaskGroups(token: string): Promise<TaskGroup[]> {
  const res = await fetch(apiUrl(BASE), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch task groups');
  return res.json();
}

export async function createTaskGroup(token: string, name: string): Promise<TaskGroup> {
  const res = await fetch(apiUrl(BASE), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create task group');
  return res.json();
}

export async function renameTaskGroup(token: string, id: number, name: string): Promise<TaskGroup> {
  const res = await fetch(apiUrl(`${BASE}/${id}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename task group');
  return res.json();
}

export async function deleteTaskGroup(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`${BASE}/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete task group');
}

export async function syncGoogleTaskGroups(token: string): Promise<TaskGroup[]> {
  const res = await fetch(apiUrl(`${BASE}/sync-google`), {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to sync Google Task groups');
  return res.json();
}
