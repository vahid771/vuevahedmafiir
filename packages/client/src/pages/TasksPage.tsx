import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import {
  getTasks, createTask, updateTask, deleteTask,
  type Task, type CreateTaskData,
} from '../api/tasks';
import {
  getTaskGroups, createTaskGroup, renameTaskGroup, deleteTaskGroup, syncGoogleTaskGroups,
  type TaskGroup,
} from '../api/taskGroups';
import { formatDate } from '../utils/format';
import TaskForm, { type TaskFormState } from '../components/tasks/TaskForm';
import { getGoogleTasksStatus } from '../api/googleTasks';
import { getGoogleCalendarStatus, syncFromGoogleCalendar } from '../api/googleCalendar';
import { useSyncQueue } from '../context/SyncQueueContext';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconSync = ({ spinning }: { spinning?: boolean }) => (
  <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<Task['priority'], string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

// ─── TaskRow ──────────────────────────────────────────────────────────────────

function TaskRow({
  task, onToggle, onDelete, onEdit, editingId, onSaveEdit, onCancelEdit, saving,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  editingId: number | null;
  onSaveEdit: (task: Task, form: TaskFormState) => void;
  onCancelEdit: () => void;
  saving: boolean;
}) {
  const isDone = task.status === 'done';
  const { calendar } = useCalendar();

  return (
    <li className="space-y-2">
      <div className="flex items-start gap-3 py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
        <button
          type="button"
          onClick={() => onToggle(task)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-400 hover:border-green-400'
          }`}
          title={isDone ? 'Mark open' : 'Mark done'}
        >
          {isDone && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
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
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={() => onEdit(task)} title="Edit"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
            <IconEdit />
          </button>
          <button type="button" onClick={() => onDelete(task.id)} title="Delete"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
            <IconTrash />
          </button>
        </div>
      </div>
      {editingId === task.id && (
        <TaskForm
          initial={{ title: task.title, description: task.description ?? '', due_date: task.due_date ?? '', priority: task.priority }}
          onSave={form => onSaveEdit(task, form)}
          onCancel={onCancelEdit}
          saving={saving}
        />
      )}
    </li>
  );
}

// ─── TaskList (content of one tab) ───────────────────────────────────────────

function TaskList({
  groupId, gTasksConnected, gcalConnected,
}: {
  groupId: number | null;
  gTasksConnected: boolean;
  gcalConnected: boolean;
}) {
  const { token } = useAuth();
  const { addJob } = useSyncQueue();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const opts = groupId === null ? { group_id: 'null' as const } : { group_id: groupId };
      setTasks(await getTasks(token, opts));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token, groupId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form: TaskFormState) {
    if (!token || !form.title.trim()) return;
    setAddSaving(true);
    try {
      const data: CreateTaskData = {
        title: form.title.trim(),
        ...(form.description && { description: form.description }),
        ...(form.due_date && { due_date: form.due_date }),
        priority: form.priority,
        task_group_id: groupId,
      };
      const label = [gTasksConnected && 'Google Tasks', gcalConnected && form.due_date && 'Google Calendar'].filter(Boolean).join(' & ');
      if (label) {
        await addJob(`Add "${form.title.trim()}" to ${label}`, () =>
          createTask(token, data).then(created => { setTasks(prev => [created, ...prev]); setShowAddForm(false); }));
      } else {
        const created = await createTask(token, data);
        setTasks(prev => [created, ...prev]);
        setShowAddForm(false);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setAddSaving(false); }
  }

  async function handleToggle(task: Task) {
    if (!token) return;
    const newStatus = task.status === 'open' ? 'done' : 'open';
    try {
      if (gTasksConnected || gcalConnected) {
        await addJob(`Update "${task.title}" status`, () =>
          updateTask(token, task.id, { status: newStatus }).then(u => setTasks(prev => prev.map(t => t.id === u.id ? u : t))));
      } else {
        const u = await updateTask(token, task.id, { status: newStatus });
        setTasks(prev => prev.map(t => t.id === u.id ? u : t));
      }
    } catch (e) { setError((e as Error).message); }
  }

  async function handleSaveEdit(task: Task, form: TaskFormState) {
    if (!token) return;
    setEditSaving(true);
    try {
      const patch = { title: form.title.trim(), description: form.description || undefined, due_date: form.due_date || undefined, priority: form.priority };
      if (gTasksConnected || gcalConnected) {
        await addJob(`Update "${form.title.trim()}"`, () =>
          updateTask(token, task.id, patch).then(u => { setTasks(prev => prev.map(t => t.id === u.id ? u : t)); setEditingId(null); }));
      } else {
        const u = await updateTask(token, task.id, patch);
        setTasks(prev => prev.map(t => t.id === u.id ? u : t));
        setEditingId(null);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setEditSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm('Delete this task?')) return;
    const task = tasks.find(t => t.id === id);
    try {
      if ((gTasksConnected || gcalConnected) && task) {
        await addJob(`Delete "${task.title}"`, () =>
          deleteTask(token, id).then(() => setTasks(prev => prev.filter(t => t.id !== id))));
      } else {
        await deleteTask(token, id);
        setTasks(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) { setError((e as Error).message); }
  }

  const openTasks = tasks.filter(t => t.status === 'open');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      <div className="flex justify-end">
        <button type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          {showAddForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {showAddForm && (
        <TaskForm onSave={handleCreate} onCancel={() => setShowAddForm(false)} saving={addSaving} />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Open <span className="font-normal">({openTasks.length})</span>
            </h2>
            {openTasks.length === 0 ? (
              <p className="text-sm text-gray-400 italic px-4">No open tasks.</p>
            ) : (
              <ul className="space-y-2">
                {openTasks.map(task => (
                  <TaskRow key={task.id} task={task}
                    onToggle={handleToggle} onDelete={handleDelete}
                    onEdit={t => { setEditingId(t.id); setShowAddForm(false); }}
                    editingId={editingId} onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)} saving={editSaving} />
                ))}
              </ul>
            )}
          </section>
          {doneTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Done <span className="font-normal">({doneTasks.length})</span>
              </h2>
              <ul className="space-y-2">
                {doneTasks.map(task => (
                  <TaskRow key={task.id} task={task}
                    onToggle={handleToggle} onDelete={handleDelete}
                    onEdit={t => { setEditingId(t.id); setShowAddForm(false); }}
                    editingId={editingId} onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)} saving={editSaving} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TasksPage ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { token } = useAuth();
  const { addJob } = useSyncQueue();

  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null | 'all'>('all');
  const [gTasksConnected, setGTasksConnected] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [calSyncing, setCalSyncing] = useState(false);
  const [calSyncSuccess, setCalSyncSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New group input state
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<number | -1>(-1);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!token) return;
    getTaskGroups(token).then(setGroups).catch(() => {});
    getGoogleTasksStatus(token).then(s => setGTasksConnected(s.connected)).catch(() => {});
    getGoogleCalendarStatus(token).then(s => setGcalConnected(s.connected)).catch(() => {});
  }, [token]);

  async function handleAddGroup() {
    if (!token || !newGroupName.trim()) return;
    setGroupSaving(true);
    const name = newGroupName.trim();
    setNewGroupName('');
    setAddingGroup(false);
    try {
      // Create locally first so the tab appears immediately and the correct
      // groupId is active before the user can add tasks.
      const g = await createTaskGroup(token, name);
      setGroups(prev => [...prev, g]);
      setActiveGroupId(g.id);
    } catch (e) { setError((e as Error).message); }
    finally { setGroupSaving(false); }
  }

  async function handleRenameGroup(id: number) {
    if (!token || !renameValue.trim()) return;
    const name = renameValue.trim();
    setRenamingId(-1);
    try {
      await addJob(`Rename task group to "${name}"`, async () => {
        const g = await renameTaskGroup(token, id, name);
        setGroups(prev => prev.map(gr => gr.id === id ? g : gr));
      });
    } catch (e) { setError((e as Error).message); }
  }

  async function handleDeleteGroup(id: number) {
    if (!token || !confirm('Delete this group? Tasks will be moved to "All Tasks".')) return;
    try {
      await deleteTaskGroup(token, id);
      setGroups(prev => prev.filter(g => g.id !== id));
      if (activeGroupId === id) setActiveGroupId('all');
    } catch (e) { setError((e as Error).message); }
  }

  async function handleGoogleSync() {
    if (!token) return;
    setSyncing(true); setSyncSuccess(false); setError(null);
    try {
      await addJob('Sync all Google Task lists', async () => {
        const updated = await syncGoogleTaskGroups(token);
        setGroups(updated);
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2500);
      });
    } catch (e) { setError((e as Error).message); }
    finally { setSyncing(false); }
  }

  async function handleCalendarSync() {
    if (!token) return;
    setCalSyncing(true); setCalSyncSuccess(false); setError(null);
    try {
      await syncFromGoogleCalendar(token);
      setCalSyncSuccess(true);
      setTimeout(() => setCalSyncSuccess(false), 2500);
    } catch (e) { setError((e as Error).message); }
    finally { setCalSyncing(false); }
  }

  // Tabs: "All" + one per group + ungrouped
  const tabs = [
    { id: 'all' as const, label: 'All', isDefault: false, isGoogle: false },
    ...groups.map(g => ({ id: g.id, label: g.name, isDefault: !!g.is_default, isGoogle: !!g.google_list_id })),
    { id: null as null, label: 'Ungrouped', isDefault: false, isGoogle: false },
  ];

  const activeTab = tabs.find(t => t.id === activeGroupId) ?? tabs[0];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
        <div className="flex items-center gap-2">
          {gTasksConnected && (
            <button type="button" onClick={handleGoogleSync} disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Sync all Google Task lists">
              {syncing ? <IconSync spinning /> : syncSuccess ? <IconCheck /> : <IconSync />}
              {syncing ? 'Syncing…' : syncSuccess ? 'Synced' : 'Sync Google'}
            </button>
          )}
          {gcalConnected && (
            <button type="button" onClick={handleCalendarSync} disabled={calSyncing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Sync from Google Calendar">
              {calSyncing ? <IconSync spinning /> : calSyncSuccess ? <IconCheck /> : <IconSync />}
              {calSyncing ? 'Syncing…' : calSyncSuccess ? 'Synced' : 'Sync Calendar'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto pb-px">
        {tabs.map(tab => {
          const isActive = tab.id === activeGroupId;
          const isGroup = typeof tab.id === 'number';
          const isDefault = tab.isDefault;
          return (
            <div key={String(tab.id)} className="flex items-center group shrink-0">
              {typeof tab.id === 'number' && renamingId === tab.id ? (
                <form onSubmit={e => { e.preventDefault(); handleRenameGroup(tab.id as number); }}
                  className="flex items-center gap-1 px-2 py-1">
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    className="border border-blue-400 rounded px-1.5 py-0.5 text-sm w-28 focus:outline-none" />
                  <button type="submit" className="text-xs text-blue-600 hover:text-blue-800">✓</button>
                  <button type="button" onClick={() => setRenamingId(-1)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                </form>
              ) : (
                <button
                  onClick={() => setActiveGroupId(tab.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5
                    ${isDefault
                      ? isActive
                        ? 'border-amber-500 text-amber-600'
                        : 'border-transparent text-amber-500 hover:text-amber-600 hover:border-amber-300'
                      : isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}>
                  {isDefault && (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                  )}
                  {tab.label}
                </button>
              )}
              {/* Rename / delete buttons — only for non-default user-created groups */}
              {isGroup && !isDefault && renamingId === -1 && isActive && (
                <div className="flex items-center gap-0.5 mr-1">
                  <button onClick={() => { setRenamingId(tab.id as number); setRenameValue(tab.label); }}
                    title="Rename group"
                    className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDeleteGroup(tab.id as number)}
                    title="Delete group"
                    className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* + New group */}
        {addingGroup ? (
          <form onSubmit={e => { e.preventDefault(); handleAddGroup(); }}
            className="flex items-center gap-1 px-2 py-1 shrink-0">
            <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="border border-blue-400 rounded px-1.5 py-0.5 text-sm w-28 focus:outline-none" />
            <button type="submit" disabled={groupSaving || !newGroupName.trim()}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40">✓</button>
            <button type="button" onClick={() => { setAddingGroup(false); setNewGroupName(''); }}
              className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </form>
        ) : (
          <button onClick={() => setAddingGroup(true)}
            className="px-2 py-2 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
            title="Add new group">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab.id === 'all' ? (
        // "All" tab — show tasks across all groups (no group filter)
        <AllTasksView gTasksConnected={gTasksConnected} gcalConnected={gcalConnected} />
      ) : (
        <TaskList
          key={String(activeGroupId)}
          groupId={activeGroupId as number | null}
          gTasksConnected={gTasksConnected}
          gcalConnected={gcalConnected}
        />
      )}
    </div>
  );
}

// ─── AllTasksView — no group filter, shows everything ────────────────────────

function AllTasksView({ gTasksConnected, gcalConnected }: { gTasksConnected: boolean; gcalConnected: boolean }) {
  const { token } = useAuth();
  const { addJob } = useSyncQueue();
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
    getTasks(token).then(setTasks).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
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
      const label = [gTasksConnected && 'Google Tasks', gcalConnected && form.due_date && 'Google Calendar'].filter(Boolean).join(' & ');
      if (label) {
        await addJob(`Add "${form.title.trim()}" to ${label}`, () =>
          createTask(token, data).then(c => { setTasks(prev => [c, ...prev]); setShowAddForm(false); }));
      } else {
        const c = await createTask(token, data);
        setTasks(prev => [c, ...prev]);
        setShowAddForm(false);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setAddSaving(false); }
  }

  async function handleToggle(task: Task) {
    if (!token) return;
    const newStatus = task.status === 'open' ? 'done' : 'open';
    try {
      const u = await updateTask(token, task.id, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === u.id ? u : t));
    } catch (e) { setError((e as Error).message); }
  }

  async function handleSaveEdit(task: Task, form: TaskFormState) {
    if (!token) return;
    setEditSaving(true);
    try {
      const u = await updateTask(token, task.id, { title: form.title.trim(), description: form.description || undefined, due_date: form.due_date || undefined, priority: form.priority });
      setTasks(prev => prev.map(t => t.id === u.id ? u : t));
      setEditingId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setEditSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm('Delete this task?')) return;
    try {
      await deleteTask(token, id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) { setError((e as Error).message); }
  }

  const openTasks = tasks.filter(t => t.status === 'open');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          {showAddForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>
      {showAddForm && <TaskForm onSave={handleCreate} onCancel={() => setShowAddForm(false)} saving={addSaving} />}
      {loading ? <p className="text-center text-gray-400 py-12">Loading…</p> : (
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Open <span className="font-normal">({openTasks.length})</span></h2>
            {openTasks.length === 0 ? <p className="text-sm text-gray-400 italic px-4">No open tasks.</p> : (
              <ul className="space-y-2">
                {openTasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete}
                    onEdit={t => { setEditingId(t.id); setShowAddForm(false); }}
                    editingId={editingId} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)} saving={editSaving} />
                ))}
              </ul>
            )}
          </section>
          {doneTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Done <span className="font-normal">({doneTasks.length})</span></h2>
              <ul className="space-y-2">
                {doneTasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete}
                    onEdit={t => { setEditingId(t.id); setShowAddForm(false); }}
                    editingId={editingId} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)} saving={editSaving} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
