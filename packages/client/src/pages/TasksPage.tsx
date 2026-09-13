import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  type Task,
  type CreateTaskData,
} from '../api/tasks';

const PRIORITY_BADGE: Record<Task['priority'], string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

interface TaskFormState {
  title: string;
  description: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
}

const EMPTY_FORM: TaskFormState = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface TaskFormProps {
  initial?: TaskFormState;
  onSave: (data: TaskFormState) => void;
  onCancel: () => void;
  saving: boolean;
}

function TaskForm({ initial = EMPTY_FORM, onSave, onCancel, saving }: TaskFormProps) {
  const [form, setForm] = useState<TaskFormState>(initial);

  function set<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Task title"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Optional description"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={e => set('due_date', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={e => set('priority', e.target.value as TaskFormState['priority'])}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim()}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  editingId: number | null;
  onSaveEdit: (task: Task, form: TaskFormState) => void;
  onCancelEdit: () => void;
  saving: boolean;
}

function TaskRow({ task, onToggle, onDelete, onEdit, editingId, onSaveEdit, onCancelEdit, saving }: TaskRowProps) {
  const isDone = task.status === 'done';

  return (
    <li className="space-y-2">
      <div className="flex items-start gap-3 py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => onToggle(task)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isDone
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-400 hover:border-green-400'
          }`}
          title={isDone ? 'Mark open' : 'Mark done'}
        >
          {isDone && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {task.title}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[task.priority]}`}>
              {task.priority}
            </span>
            {task.due_date && (
              <span className="text-xs text-gray-500">{formatDate(task.due_date)}</span>
            )}
          </div>
          {task.description && (
            <p className={`text-xs mt-0.5 ${isDone ? 'text-gray-400' : 'text-gray-500'}`}>{task.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Inline edit form */}
      {editingId === task.id && (
        <TaskForm
          initial={{
            title: task.title,
            description: task.description ?? '',
            due_date: task.due_date ?? '',
            priority: task.priority,
          }}
          onSave={form => onSaveEdit(task, form)}
          onCancel={onCancelEdit}
          saving={saving}
        />
      )}
    </li>
  );
}

export default function TasksPage() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getTasks(token)
      .then(setTasks)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(form: TaskFormState) {
    if (!token || !form.title.trim()) return;
    setAddSaving(true);
    try {
      const data: CreateTaskData = {
        title: form.title.trim(),
        ...(form.description && { description: form.description }),
        ...(form.due_date && { due_date: form.due_date }),
        priority: form.priority,
      };
      const created = await createTask(token, data);
      setTasks(prev => [created, ...prev]);
      setShowAddForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddSaving(false);
    }
  }

  async function handleToggle(task: Task) {
    if (!token) return;
    const newStatus = task.status === 'open' ? 'done' : 'open';
    try {
      const updated = await updateTask(token, task.id, { status: newStatus });
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveEdit(task: Task, form: TaskFormState) {
    if (!token) return;
    setEditSaving(true);
    try {
      const updated = await updateTask(token, task.id, {
        title: form.title.trim(),
        description: form.description || undefined,
        due_date: form.due_date || undefined,
        priority: form.priority,
      });
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm('Delete this task?')) return;
    try {
      await deleteTask(token, id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const openTasks = tasks.filter(t => t.status === 'open');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <TaskForm
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
          saving={addSaving}
        />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading tasks…</p>
      ) : (
        <div className="space-y-6">
          {/* Open tasks */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Open <span className="font-normal text-gray-400">({openTasks.length})</span>
            </h2>
            {openTasks.length === 0 ? (
              <p className="text-sm text-gray-400 italic px-4">No open tasks.</p>
            ) : (
              <ul className="space-y-2">
                {openTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={t => { setEditingId(t.id); setShowAddForm(false); }}
                    editingId={editingId}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    saving={editSaving}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Done tasks */}
          {doneTasks.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Done <span className="font-normal text-gray-400">({doneTasks.length})</span>
              </h2>
              <ul className="space-y-2">
                {doneTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={t => { setEditingId(t.id); setShowAddForm(false); }}
                    editingId={editingId}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    saving={editSaving}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
