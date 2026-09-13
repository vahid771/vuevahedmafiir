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
};

export type UpdateTaskData = Partial<CreateTaskData>;

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function getTasks(token: string, status?: 'open' | 'done'): Promise<Task[]> {
  const url = status ? `${BASE}?status=${status}` : BASE;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json() as Promise<Task[]>;
}

export async function createTask(token: string, data: CreateTaskData): Promise<Task> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json() as Promise<Task>;
}

export async function updateTask(token: string, id: number, data: UpdateTaskData): Promise<Task> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json() as Promise<Task>;
}

export async function deleteTask(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete task');
}
