import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  type Task,
  type CreateTaskData,
} from '../api/tasks';
import { formatDate } from '../utils/format';
import TaskForm, { type TaskFormState } from '../components/tasks/TaskForm';
import { getGoogleTasksStatus, syncFromGoogleTasks } from '../api/googleTasks';

const PRIORITY_BADGE: Record<Task['priority'], string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

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
  const { calendar } = useCalendar();

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
              <span className="text-xs text-gray-500">{formatDate(task.due_date, calendar)}</span>
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
  const [gTasksConnected, setGTasksConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getTasks(token)
      .then(setTasks)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getGoogleTasksStatus(token)
      .then(s => setGTasksConnected(s.connected && !!s.taskListId))
      .catch(() => { /* non-fatal */ });
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

  async function handleSync() {
    if (!token) return;
    setSyncing(true);
    setSyncSuccess(false);
    setError(null);
    try {
      const synced = await syncFromGoogleTasks(token);
      setTasks(synced as Task[]);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
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
        <div className="flex items-center gap-2">
          {gTasksConnected && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Sync from Google Tasks"
            >
              {syncing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
              ) : syncSuccess ? (
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {syncing ? 'Syncing…' : syncSuccess ? 'Synced' : 'Sync from Google'}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAddForm ? 'Cancel' : '+ Add Task'}
          </button>
        </div>
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
