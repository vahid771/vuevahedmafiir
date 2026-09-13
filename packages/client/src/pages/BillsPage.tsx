import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getBills,
  createBill,
  updateBill,
  deleteBill,
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  type Bill,
  type Subscription,
  type CreateBillData,
  type CreateSubscriptionData,
} from '../api/bills';

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
}

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Bill form ────────────────────────────────────────────────────────────────

interface BillFormState {
  name: string;
  amount: string;
  due_date: string;
  recurrence: 'once' | 'monthly' | 'yearly';
}

const EMPTY_BILL_FORM: BillFormState = {
  name: '',
  amount: '',
  due_date: '',
  recurrence: 'once',
};

function BillForm({
  initial = EMPTY_BILL_FORM,
  onSave,
  onCancel,
  saving,
}: {
  initial?: BillFormState;
  onSave: (data: BillFormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BillFormState>(initial);
  function set<K extends keyof BillFormState>(key: K, value: BillFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Bill name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={e => set('due_date', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
          <select
            value={form.recurrence}
            onChange={e => set('recurrence', e.target.value as BillFormState['recurrence'])}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="once">Once</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
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
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Bill row ─────────────────────────────────────────────────────────────────

const RECURRENCE_BADGE: Record<Bill['recurrence'], string> = {
  once: 'bg-gray-100 text-gray-600',
  monthly: 'bg-blue-100 text-blue-700',
  yearly: 'bg-purple-100 text-purple-700',
};

function BillRow({
  bill,
  onTogglePaid,
  onDelete,
  onEdit,
  editingId,
  onSaveEdit,
  onCancelEdit,
  saving,
}: {
  bill: Bill;
  onTogglePaid: (bill: Bill) => void;
  onDelete: (id: number) => void;
  onEdit: (bill: Bill) => void;
  editingId: number | null;
  onSaveEdit: (bill: Bill, form: BillFormState) => void;
  onCancelEdit: () => void;
  saving: boolean;
}) {
  const days = daysFromToday(bill.due_date);
  const isOverdue = bill.paid === 0 && days !== null && days < 0;
  const isDueSoon = bill.paid === 0 && days !== null && days >= 0 && days <= 7;

  let rowBg = 'bg-white border-gray-200';
  if (isOverdue) rowBg = 'bg-red-50 border-red-200';
  else if (isDueSoon) rowBg = 'bg-amber-50 border-amber-200';

  return (
    <li className="space-y-2">
      <div className={`flex items-start gap-3 py-3 px-4 rounded-lg border ${rowBg} transition-colors`}>
        {/* Paid toggle */}
        <button
          type="button"
          onClick={() => onTogglePaid(bill)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            bill.paid
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-400 hover:border-green-400'
          }`}
          title={bill.paid ? 'Mark unpaid' : 'Mark paid'}
        >
          {bill.paid ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className={`text-sm font-medium ${bill.paid ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {bill.name}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RECURRENCE_BADGE[bill.recurrence]}`}>
              {bill.recurrence}
            </span>
            {isOverdue && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>
            )}
            {isDueSoon && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Due soon</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span>{formatCurrency(bill.amount)}</span>
            {bill.due_date && <span>Due {formatDate(bill.due_date)}</span>}
            <span className={bill.paid ? 'text-green-600' : 'text-gray-400'}>{bill.paid ? 'Paid' : 'Unpaid'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(bill)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(bill.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      {editingId === bill.id && (
        <BillForm
          initial={{
            name: bill.name,
            amount: bill.amount != null ? String(bill.amount) : '',
            due_date: bill.due_date ?? '',
            recurrence: bill.recurrence,
          }}
          onSave={form => onSaveEdit(bill, form)}
          onCancel={onCancelEdit}
          saving={saving}
        />
      )}
    </li>
  );
}

// ─── Subscription form ────────────────────────────────────────────────────────

interface SubFormState {
  name: string;
  amount: string;
  billing_cycle: 'weekly' | 'monthly' | 'yearly';
  next_billing_date: string;
}

const EMPTY_SUB_FORM: SubFormState = {
  name: '',
  amount: '',
  billing_cycle: 'monthly',
  next_billing_date: '',
};

function SubForm({
  initial = EMPTY_SUB_FORM,
  onSave,
  onCancel,
  saving,
}: {
  initial?: SubFormState;
  onSave: (data: SubFormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<SubFormState>(initial);
  function set<K extends keyof SubFormState>(key: K, value: SubFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Subscription name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
          <select
            value={form.billing_cycle}
            onChange={e => set('billing_cycle', e.target.value as SubFormState['billing_cycle'])}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Next Billing Date</label>
          <input
            type="date"
            value={form.next_billing_date}
            onChange={e => set('next_billing_date', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Subscription row ─────────────────────────────────────────────────────────

const CYCLE_BADGE: Record<string, string> = {
  weekly: 'bg-teal-100 text-teal-700',
  monthly: 'bg-blue-100 text-blue-700',
  yearly: 'bg-purple-100 text-purple-700',
};

function SubRow({
  sub,
  onToggleActive,
  onDelete,
  onEdit,
  editingId,
  onSaveEdit,
  onCancelEdit,
  saving,
}: {
  sub: Subscription;
  onToggleActive: (sub: Subscription) => void;
  onDelete: (id: number) => void;
  onEdit: (sub: Subscription) => void;
  editingId: number | null;
  onSaveEdit: (sub: Subscription, form: SubFormState) => void;
  onCancelEdit: () => void;
  saving: boolean;
}) {
  const days = daysFromToday(sub.next_billing_date);
  const isDueSoon = sub.active === 1 && days !== null && days >= 0 && days <= 7;

  const rowBg = isDueSoon ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200';

  return (
    <li className="space-y-2">
      <div className={`flex items-start gap-3 py-3 px-4 rounded-lg border ${rowBg} transition-colors`}>
        {/* Active toggle */}
        <button
          type="button"
          onClick={() => onToggleActive(sub)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            sub.active
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-400 hover:border-green-400'
          }`}
          title={sub.active ? 'Mark inactive' : 'Mark active'}
        >
          {sub.active ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className={`text-sm font-medium ${!sub.active ? 'text-gray-400' : 'text-gray-800'}`}>
              {sub.name}
            </span>
            {sub.billing_cycle && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CYCLE_BADGE[sub.billing_cycle] ?? 'bg-gray-100 text-gray-600'}`}>
                {sub.billing_cycle}
              </span>
            )}
            {!sub.active && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
            )}
            {isDueSoon && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Due soon</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span>{formatCurrency(sub.amount)}</span>
            {sub.next_billing_date && <span>Next {formatDate(sub.next_billing_date)}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(sub)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(sub.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      {editingId === sub.id && (
        <SubForm
          initial={{
            name: sub.name,
            amount: sub.amount != null ? String(sub.amount) : '',
            billing_cycle: (sub.billing_cycle as SubFormState['billing_cycle']) ?? 'monthly',
            next_billing_date: sub.next_billing_date ?? '',
          }}
          onSave={form => onSaveEdit(sub, form)}
          onCancel={onCancelEdit}
          saving={saving}
        />
      )}
    </li>
  );
}

// ─── Bills section ────────────────────────────────────────────────────────────

function BillsSection({ token }: { token: string }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getBills(token)
      .then(setBills)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(form: BillFormState) {
    if (!form.name.trim()) return;
    setAddSaving(true);
    try {
      const data: CreateBillData = {
        name: form.name.trim(),
        ...(form.amount && { amount: parseFloat(form.amount) }),
        ...(form.due_date && { due_date: form.due_date }),
        recurrence: form.recurrence,
      };
      const created = await createBill(token, data);
      setBills(prev => [created, ...prev]);
      setShowAddForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddSaving(false);
    }
  }

  async function handleTogglePaid(bill: Bill) {
    try {
      const updated = await updateBill(token, bill.id, { paid: bill.paid ? 0 : 1 });
      setBills(prev => prev.map(b => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveEdit(bill: Bill, form: BillFormState) {
    setEditSaving(true);
    try {
      const updated = await updateBill(token, bill.id, {
        name: form.name.trim(),
        amount: form.amount ? parseFloat(form.amount) : undefined,
        due_date: form.due_date || undefined,
        recurrence: form.recurrence,
      });
      setBills(prev => prev.map(b => (b.id === updated.id ? updated : b)));
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this bill?')) return;
    try {
      await deleteBill(token, id);
      setBills(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{bills.length} bill{bills.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Bill'}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {showAddForm && (
        <BillForm
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
          saving={addSaving}
        />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading bills…</p>
      ) : bills.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-4 py-8 text-center">No bills yet.</p>
      ) : (
        <ul className="space-y-2">
          {bills.map(bill => (
            <BillRow
              key={bill.id}
              bill={bill}
              onTogglePaid={handleTogglePaid}
              onDelete={handleDelete}
              onEdit={b => { setEditingId(b.id); setShowAddForm(false); }}
              editingId={editingId}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingId(null)}
              saving={editSaving}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Subscriptions section ────────────────────────────────────────────────────

function SubscriptionsSection({ token }: { token: string }) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSubscriptions(token)
      .then(setSubs)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(form: SubFormState) {
    if (!form.name.trim()) return;
    setAddSaving(true);
    try {
      const data: CreateSubscriptionData = {
        name: form.name.trim(),
        ...(form.amount && { amount: parseFloat(form.amount) }),
        billing_cycle: form.billing_cycle,
        ...(form.next_billing_date && { next_billing_date: form.next_billing_date }),
      };
      const created = await createSubscription(token, data);
      setSubs(prev => [created, ...prev]);
      setShowAddForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddSaving(false);
    }
  }

  async function handleToggleActive(sub: Subscription) {
    try {
      const updated = await updateSubscription(token, sub.id, { active: sub.active ? 0 : 1 });
      setSubs(prev => prev.map(s => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveEdit(sub: Subscription, form: SubFormState) {
    setEditSaving(true);
    try {
      const updated = await updateSubscription(token, sub.id, {
        name: form.name.trim(),
        amount: form.amount ? parseFloat(form.amount) : undefined,
        billing_cycle: form.billing_cycle,
        next_billing_date: form.next_billing_date || undefined,
      });
      setSubs(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this subscription?')) return;
    try {
      await deleteSubscription(token, id);
      setSubs(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{subs.length} subscription{subs.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Subscription'}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {showAddForm && (
        <SubForm
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
          saving={addSaving}
        />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading subscriptions…</p>
      ) : subs.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-4 py-8 text-center">No subscriptions yet.</p>
      ) : (
        <ul className="space-y-2">
          {subs.map(sub => (
            <SubRow
              key={sub.id}
              sub={sub}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onEdit={s => { setEditingId(s.id); setShowAddForm(false); }}
              editingId={editingId}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingId(null)}
              saving={editSaving}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'bills' | 'subscriptions';

export default function BillsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('bills');

  if (!token) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-800">Bills &amp; Subscriptions</h1>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        {(['bills', 'subscriptions'] as Tab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab === 'bills' ? 'Bills' : 'Subscriptions'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'bills' ? (
        <BillsSection token={token} />
      ) : (
        <SubscriptionsSection token={token} />
      )}
    </div>
  );
}
