import { createResource } from './base';

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
  column_id?: number | null;
}

export type CreateTaskData = {
  title: string;
  description?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'open' | 'done';
  task_group_id?: number | null;
  column_id?: number | null;
};

export type UpdateTaskData = Partial<CreateTaskData>;

const _tasks = createResource<Task, CreateTaskData>(BASE);

export async function getTasks(token: string, opts?: { status?: 'open' | 'done'; group_id?: number | 'null' }): Promise<Task[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.group_id !== undefined) params.set('group_id', String(opts.group_id));
  return _tasks.getAll(token, params.toString() ? params : undefined);
}

export const createTask  = (token: string, data: CreateTaskData)            => _tasks.create(token, data);
export const updateTask  = (token: string, id: number, data: UpdateTaskData) => _tasks.update(token, id, data);
export const deleteTask  = (token: string, id: number)                        => _tasks.remove(token, id);
