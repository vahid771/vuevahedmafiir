import { apiUrl, authHeaders } from './base';

const BASE = '/api/tasks';

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'done';
  created_at: string;
}

export type CreateTaskData = {
  title: string;
  description?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'open' | 'done';
  task_group_id?: number | null;
};

export type UpdateTaskData = Partial<CreateTaskData>;

export async function getTasks(token: string, opts?: { status?: 'open' | 'done'; group_id?: number | 'null' }): Promise<Task[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.group_id !== undefined) params.set('group_id', String(opts.group_id));
  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const res = await fetch(apiUrl(url), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json() as Promise<Task[]>;
}

export async function createTask(token: string, data: CreateTaskData): Promise<Task> {
  const res = await fetch(apiUrl(BASE), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json() as Promise<Task>;
}

export async function updateTask(token: string, id: number, data: UpdateTaskData): Promise<Task> {
  const res = await fetch(apiUrl(`${BASE}/${id}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json() as Promise<Task>;
}

export async function deleteTask(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`${BASE}/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete task');
}
