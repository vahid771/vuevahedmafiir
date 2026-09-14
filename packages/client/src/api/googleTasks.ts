import { apiUrl, authHeaders } from './base';
import type { Task } from './tasks';

const BASE = '/api/google-tasks';

export interface GoogleTaskList {
  id: string;
  title: string;
}

export interface GoogleTasksStatus {
  connected: boolean;
  taskListId: string | null;
  taskListTitle: string | null;
}

/** Returns the URL to navigate the browser to for the Google Tasks OAuth connect flow. */
export function getGoogleTasksConnectUrl(token: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${BASE}/connect?token=${encodeURIComponent(token)}`;
}

export async function getGoogleTasksStatus(token: string): Promise<GoogleTasksStatus> {
  const res = await fetch(apiUrl(`${BASE}/status`), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch Google Tasks status');
  return res.json();
}

export async function getGoogleTaskLists(token: string): Promise<GoogleTaskList[]> {
  const res = await fetch(apiUrl(`${BASE}/task-lists`), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch Google task lists');
  return res.json();
}

export async function selectGoogleTaskList(token: string, taskListId: string): Promise<void> {
  const res = await fetch(apiUrl(`${BASE}/select-list`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ taskListId }),
  });
  if (!res.ok) throw new Error('Failed to select task list');
}

export async function disconnectGoogleTasks(token: string): Promise<void> {
  const res = await fetch(apiUrl(`${BASE}/disconnect`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to disconnect Google Tasks');
}

export async function syncFromGoogleTasks(token: string): Promise<Task[]> {
  const res = await fetch(apiUrl(`${BASE}/sync`), {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to sync from Google Tasks');
  return res.json() as Promise<Task[]>;
}
