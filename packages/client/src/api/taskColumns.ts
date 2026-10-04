import { apiUrl, authHeaders } from './base';

const BASE = '/api/task-columns';

export interface TaskColumn {
  id: number;
  user_id: number;
  task_group_id: number;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export type CreateTaskColumnData = {
  task_group_id: number;
  name: string;
  color?: string;
  sort_order?: number;
};

export type UpdateTaskColumnData = {
  name?: string;
  color?: string;
  sort_order?: number;
};

export async function getTaskColumns(token: string, groupId: number): Promise<TaskColumn[]> {
  const res = await fetch(apiUrl(`${BASE}?group_id=${groupId}`), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch task columns');
  return res.json();
}

export async function createTaskColumn(token: string, data: CreateTaskColumnData): Promise<TaskColumn> {
  const res = await fetch(apiUrl(BASE), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task column');
  return res.json();
}

export async function updateTaskColumn(token: string, id: number, data: UpdateTaskColumnData): Promise<TaskColumn> {
  const res = await fetch(apiUrl(`${BASE}/${id}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update task column');
  return res.json();
}

export async function deleteTaskColumn(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`${BASE}/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete task column');
}

export async function reorderTaskColumns(token: string, columns: { id: number; sort_order: number }[]): Promise<void> {
  const res = await fetch(apiUrl(`${BASE}/reorder`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ columns }),
  });
  if (!res.ok) throw new Error('Failed to reorder task columns');
}
