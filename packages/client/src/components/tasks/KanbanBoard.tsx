import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../context/AuthContext';
import { useCalendar } from '../../context/CalendarContext';
import { useSyncQueue } from '../../context/SyncQueueContext';
import { getTasks, createTask, updateTask, deleteTask, type Task, type CreateTaskData } from '../../api/tasks';
import {
  getTaskColumns,
  createTaskColumn,
  updateTaskColumn,
  deleteTaskColumn,
  reorderTaskColumns,
  type TaskColumn,
} from '../../api/taskColumns';
import { getAttachments } from '../../api/attachments';
import { formatDate } from '../../utils/format';
import TaskForm, { type TaskFormState, EMPTY_TASK_FORM } from './TaskForm';
import { SkeletonList } from '../ui/Skeleton';

// ─── Priority badge colours (mirrors TasksPage) ───────────────────────────────

const PRIORITY_BADGE: Record<Task['priority'], string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconGrip = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  attachmentCount,
  onEdit,
  onDelete,
  onToggle,
  editingId,
  onSaveEdit,
  onCancelEdit,
  saving,
  isDragging,
}: {
  task: Task;
  attachmentCount: number;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onToggle: (task: Task) => void;
  editingId: number | null;
  onSaveEdit: (task: Task, form: TaskFormState) => void;
  onCancelEdit: () => void;
  saving: boolean;
  isDragging?: boolean;
}) {
  const isDone = task.status === 'done';
  const { t } = useTranslation();
  const { calendar } = useCalendar();

  return (
    <motion.div
      layout
      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' as const } } }}
      className={`space-y-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 hover:border-gray-300 transition-colors cursor-grab active:cursor-grabbing">
        {/* Status toggle + title row */}
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => onToggle(task)}
            className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-400 hover:border-green-400'
            }`}
            title={isDone ? t('tasks.open') : t('tasks.done')}
          >
            {isDone && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium block leading-tight ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {task.title}
            </span>
            {task.description && (
              <p className={`text-xs mt-0.5 line-clamp-2 ${isDone ? 'text-gray-400' : 'text-gray-500'}`}>
                {task.description}
              </p>
            )}
          </div>
          {/* Actions */}
          <div className="flex gap-0.5 flex-shrink-0">
            <button type="button" onClick={() => onEdit(task)} title={t('common.edit')}
              className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors">
              <IconEdit />
            </button>
            <button type="button" onClick={() => onDelete(task.id)} title={t('common.delete')}
              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
              <IconTrash />
            </button>
          </div>
        </div>
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pl-6">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_BADGE[task.priority]}`}>
            {task.priority}
          </span>
          {task.due_date && (
            <span className="text-xs text-gray-400">{formatDate(task.due_date, calendar)}</span>
          )}
          {attachmentCount > 0 && (
            <span className="text-xs text-blue-500 flex items-center gap-0.5">
              📎 {attachmentCount}
            </span>
          )}
        </div>
      </div>
      {/* Inline edit form */}
      {editingId === task.id && (
        <TaskForm
          initial={{ title: task.title, description: task.description ?? '', due_date: task.due_date ?? '', priority: task.priority }}
          onSave={form => onSaveEdit(task, form)}
          onCancel={onCancelEdit}
          saving={saving}
          editId={task.id}
        />
      )}
    </motion.div>
  );
}

// ─── Draggable Task Card (wraps TaskCard with useSortable) ────────────────────

function DraggableTaskCard(props: Parameters<typeof TaskCard>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task-${props.task.id}`,
    data: { type: 'task', taskId: props.task.id, columnId: props.task.column_id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners}>
        <TaskCard {...props} isDragging={isDragging} />
      </div>
    </div>
  );
}

// ─── Column Lane ──────────────────────────────────────────────────────────────

function ColumnLane({
  column,
  tasks,
  attachmentCounts,
  onEditTask,
  onDeleteTask,
  onToggleTask,
  editingId,
  onSaveEdit,
  onCancelEdit,
  editSaving,
  onAddTask,
  addSaving,
  onRenameColumn,
  onDeleteColumn,
  isOnlyColumn,
}: {
  column: TaskColumn;
  tasks: Task[];
  attachmentCounts: Record<number, number>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleTask: (task: Task) => void;
  editingId: number | null;
  onSaveEdit: (task: Task, form: TaskFormState) => void;
  onCancelEdit: () => void;
  editSaving: boolean;
  onAddTask: (columnId: number, form: TaskFormState) => void;
  addSaving: boolean;
  onRenameColumn: (id: number, name: string) => void;
  onDeleteColumn: (id: number) => void;
  isOnlyColumn: boolean;
}) {
  const { t } = useTranslation();
  const [showAddForm, setShowAddForm] = useState(false);
  const [renamingColumn, setRenamingColumn] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== column.name) {
      onRenameColumn(column.id, trimmed);
    }
    setRenamingColumn(false);
  }

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col w-72 flex-shrink-0 h-full">
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 border-gray-200 bg-gray-50"
        style={{ borderTopColor: column.color, borderTopWidth: 3 }}
      >
        {/* Drag handle for column */}
        <button
          type="button"
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <IconGrip />
        </button>

        {renamingColumn ? (
          <form onSubmit={handleRenameSubmit} className="flex items-center gap-1 flex-1 min-w-0">
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="flex-1 min-w-0 border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none"
            />
            <button type="submit" className="text-xs text-blue-600 hover:text-blue-800">✓</button>
            <button type="button" onClick={() => { setRenamingColumn(false); setRenameValue(column.name); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-700 truncate flex-1">{column.name}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">({tasks.length})</span>
            <div className="flex gap-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setRenamingColumn(true); setRenameValue(column.name); }}
                title={t('tasks.renameColumn')}
                className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors"
              >
                <IconEdit />
              </button>
              {!isOnlyColumn && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('tasks.deleteColumnConfirm'))) onDeleteColumn(column.id);
                  }}
                  title={t('tasks.deleteColumn')}
                  className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <IconTrash />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task cards */}
      <div className="flex-1 min-h-0 border border-t-0 border-gray-200 bg-white rounded-b-lg p-2 space-y-2 overflow-y-auto">
        <SortableContext items={tasks.map(t => `task-${t.id}`)} strategy={horizontalListSortingStrategy}>
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          >
            {tasks.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">{t('tasks.noTasksInColumn')}</p>
            ) : (
              tasks.map(task => (
                <DraggableTaskCard
                  key={task.id}
                  task={task}
                  attachmentCount={attachmentCounts[task.id] ?? 0}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onToggle={onToggleTask}
                  editingId={editingId}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  saving={editSaving}
                />
              ))
            )}
          </motion.div>
        </SortableContext>

        {/* Add task form / button */}
        {showAddForm ? (
          <TaskForm
            initial={EMPTY_TASK_FORM}
            onSave={form => { onAddTask(column.id, form); setShowAddForm(false); }}
            onCancel={() => setShowAddForm(false)}
            saving={addSaving}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full text-left text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded px-2 py-1.5 transition-colors"
          >
            {t('tasks.addTaskToColumn')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── KanbanBoard ──────────────────────────────────────────────────────────────

export default function KanbanBoard({
  groupId,
  gTasksConnected,
  gcalConnected,
}: {
  groupId: number;
  gTasksConnected: boolean;
  gcalConnected: boolean;
}) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { addJob } = useSyncQueue();

  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing / saving state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  // Add column state
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnSaving, setColumnSaving] = useState(false);

  // DnD active dragged task id
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [cols, tks] = await Promise.all([
        getTaskColumns(token, groupId),
        getTasks(token, { group_id: groupId }),
      ]);
      setColumns(cols);
      setTasks(tks);

      // Auto-assign null column_id tasks to the first column
      if (cols.length > 0) {
        const firstCol = cols[0];
        const nullTasks = tks.filter(t => t.column_id == null);
        if (nullTasks.length > 0) {
          setTasks(prev => prev.map(t =>
            t.column_id == null ? { ...t, column_id: firstCol.id } : t
          ));
          // Persist in background
          Promise.all(
            nullTasks.map(t => updateTask(token, t.id, { column_id: firstCol.id }))
          ).catch(() => {});
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, groupId]);

  useEffect(() => { load(); }, [load]);

  // Load attachment counts after tasks change
  useEffect(() => {
    if (!token || tasks.length === 0) return;
    Promise.all(
      tasks.map(t => getAttachments(token, 'task', t.id).then(docs => [t.id, docs.length] as [number, number]))
    ).then(pairs => setAttachmentCounts(Object.fromEntries(pairs))).catch(() => {});
  }, [tasks, token]);

  // ── Task handlers ──────────────────────────────────────────────────────────

  async function handleAddTask(columnId: number, form: TaskFormState) {
    if (!token || !form.title.trim()) return;
    setAddSaving(true);
    try {
      const data: CreateTaskData = {
        title: form.title.trim(),
        ...(form.description && { description: form.description }),
        ...(form.due_date && { due_date: form.due_date }),
        priority: form.priority,
        task_group_id: groupId,
        column_id: columnId,
      };
      const target = [gTasksConnected && 'Google Tasks', gcalConnected && form.due_date && 'Google Calendar'].filter(Boolean).join(' & ');
      if (target) {
        await addJob({ key: 'sync.addItem', vars: { name: form.title.trim(), target } }, () =>
          createTask(token, data).then(created => setTasks(prev => [created, ...prev])));
      } else {
        const created = await createTask(token, data);
        setTasks(prev => [created, ...prev]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setAddSaving(false); }
  }

  async function handleToggleTask(task: Task) {
    if (!token) return;
    const newStatus = task.status === 'open' ? 'done' : 'open';
    try {
      if (gTasksConnected || gcalConnected) {
        await addJob({ key: 'sync.updateStatus', vars: { name: task.title } }, () =>
          updateTask(token, task.id, { status: newStatus }).then(u =>
            setTasks(prev => prev.map(t => t.id === u.id ? u : t))));
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
        await addJob({ key: 'sync.updateItem', vars: { name: form.title.trim() } }, () =>
          updateTask(token, task.id, patch).then(u => { setTasks(prev => prev.map(t => t.id === u.id ? u : t)); setEditingId(null); }));
      } else {
        const u = await updateTask(token, task.id, patch);
        setTasks(prev => prev.map(t => t.id === u.id ? u : t));
        setEditingId(null);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setEditSaving(false); }
  }

  async function handleDeleteTask(id: number) {
    if (!token || !confirm(t('tasks.deleteConfirm'))) return;
    const task = tasks.find(t => t.id === id);
    try {
      if ((gTasksConnected || gcalConnected) && task) {
        await addJob({ key: 'sync.deleteItem', vars: { name: task.title } }, () =>
          deleteTask(token, id).then(() => setTasks(prev => prev.filter(t => t.id !== id))));
      } else {
        await deleteTask(token, id);
        setTasks(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) { setError((e as Error).message); }
  }

  // ── Column handlers ────────────────────────────────────────────────────────

  async function handleAddColumn() {
    if (!token || !newColumnName.trim()) return;
    setColumnSaving(true);
    try {
      const col = await createTaskColumn(token, {
        task_group_id: groupId,
        name: newColumnName.trim(),
        sort_order: columns.length,
      });
      setColumns(prev => [...prev, col]);
      setAddingColumn(false);
      setNewColumnName('');
    } catch (e) { setError((e as Error).message); }
    finally { setColumnSaving(false); }
  }

  async function handleRenameColumn(id: number, name: string) {
    if (!token) return;
    try {
      const updated = await updateTaskColumn(token, id, { name });
      setColumns(prev => prev.map(c => c.id === id ? updated : c));
    } catch (e) { setError((e as Error).message); }
  }

  async function handleDeleteColumn(id: number) {
    if (!token) return;
    try {
      await deleteTaskColumn(token, id);
      setColumns(prev => prev.filter(c => c.id !== id));
      // Tasks that were in this column will have column_id nulled by the DB FK.
      // On next board mount they'll be auto-assigned to the first column.
      // Optimistically move them to the first remaining column.
      const remaining = columns.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setTasks(prev => prev.map(t =>
          t.column_id === id ? { ...t, column_id: remaining[0].id } : t
        ));
      } else {
        setTasks(prev => prev.map(t =>
          t.column_id === id ? { ...t, column_id: null } : t
        ));
      }
    } catch (e) { setError((e as Error).message); }
  }

  // ── Drag and Drop ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const { data } = event.active;
    if (data.current?.type === 'task') {
      setActiveTaskId(data.current.taskId as number);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over || !token) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // ── Column reorder ──────────────────────────────────────────────────────
    if (activeData?.type === 'column' && overData?.type === 'column') {
      const oldIndex = columns.findIndex(c => `col-${c.id}` === active.id);
      const newIndex = columns.findIndex(c => `col-${c.id}` === over.id);
      if (oldIndex !== newIndex) {
        const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({ ...c, sort_order: i }));
        setColumns(reordered);
        try {
          await reorderTaskColumns(token, reordered.map(c => ({ id: c.id, sort_order: c.sort_order })));
        } catch (e) { setError((e as Error).message); load(); }
      }
      return;
    }

    // ── Task moved to a different column ────────────────────────────────────
    if (activeData?.type === 'task') {
      const taskId = activeData.taskId as number;

      // Determine target column id: over could be a column header or a task card
      let targetColumnId: number | null = null;
      if (overData?.type === 'column') {
        targetColumnId = overData.columnId as number;
      } else if (overData?.type === 'task') {
        const overTask = tasks.find(t => t.id === (overData.taskId as number));
        targetColumnId = overTask?.column_id ?? null;
      }

      if (targetColumnId == null) return;

      const task = tasks.find(t => t.id === taskId);
      if (!task || task.column_id === targetColumnId) return;

      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: targetColumnId } : t));
      try {
        await updateTask(token, taskId, { column_id: targetColumnId });
      } catch (e) {
        setError((e as Error).message);
        // Revert on failure
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: task.column_id } : t));
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <SkeletonList count={4} />;

  const activeTask = activeTaskId != null ? tasks.find(t => t.id === activeTaskId) : null;

  return (
    <div className="h-full flex flex-col gap-3">
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex-shrink-0">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columns.map(c => `col-${c.id}`)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 items-stretch flex-1 min-h-0">
            {columns.map(col => (
              <ColumnLane
                key={col.id}
                column={col}
                tasks={tasks.filter(t => t.column_id === col.id)}
                attachmentCounts={attachmentCounts}
                onEditTask={task => { setEditingId(task.id); }}
                onDeleteTask={handleDeleteTask}
                onToggleTask={handleToggleTask}
                editingId={editingId}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                editSaving={editSaving}
                onAddTask={handleAddTask}
                addSaving={addSaving}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumn}
                isOnlyColumn={columns.length === 1}
              />
            ))}

            {/* Add column */}
            <div className="flex-shrink-0 w-64">
              {addingColumn ? (
                <form
                  onSubmit={e => { e.preventDefault(); handleAddColumn(); }}
                  className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                >
                  <input
                    autoFocus
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                    placeholder={t('tasks.columnName')}
                    className="flex-1 border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none"
                  />
                  <button type="submit" disabled={columnSaving || !newColumnName.trim()}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40">✓</button>
                  <button type="button" onClick={() => { setAddingColumn(false); setNewColumnName(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingColumn(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-lg w-full transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('tasks.addColumn')}
                </button>
              )}
            </div>
          </div>
        </SortableContext>

        {/* Drag overlay — shows the card being dragged */}
        <DragOverlay>
          {activeTask && (
            <div className="rotate-2 shadow-lg">
              <TaskCard
                task={activeTask}
                attachmentCount={attachmentCounts[activeTask.id] ?? 0}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggle={() => {}}
                editingId={null}
                onSaveEdit={() => {}}
                onCancelEdit={() => {}}
                saving={false}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
