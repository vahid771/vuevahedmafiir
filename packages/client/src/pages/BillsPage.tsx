import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import { useTranslation } from 'react-i18next';
import BillForm, { type BillFormState } from '../components/bills/BillForm';
import SubscriptionForm, { type SubFormState } from '../components/bills/SubscriptionForm';
import LoanForm, { type LoanFormState } from '../components/bills/LoanForm';
import { BillsCharts, LoansCharts } from '../components/charts/PaymentsCharts';
import {
  getBills,
  createBill,
  updateBill,
  deleteBill,
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  type Bill,
  type Subscription,
  type Loan,
  type CreateBillData,
  type CreateSubscriptionData,
  type CreateLoanData,
} from '../api/bills';
import { formatDate } from '../utils/format';

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fa-IR', { style: 'currency', currency: 'IRR', maximumFractionDigits: 0 }).format(amount);
}

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
  const { t } = useTranslation();
  const { calendar } = useCalendar();

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
          title={bill.paid ? t('bills.markUnpaid') : t('bills.markPaid')}
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
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('bills.overdue')}</span>
            )}
            {isDueSoon && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('bills.dueSoon')}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span>{formatCurrency(bill.amount)}</span>
            {bill.due_date && <span>{t('bills.due')} {formatDate(bill.due_date, calendar)}</span>}
            <span className={bill.paid ? 'text-green-600' : 'text-gray-400'}>{bill.paid ? t('bills.paid') : t('bills.unpaid')}</span>
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
  const { t } = useTranslation();
  const { calendar } = useCalendar();

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
          title={sub.active ? t('bills.markInactive') : t('bills.markActive')}
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
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t('bills.inactive')}</span>
            )}
            {isDueSoon && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('bills.dueSoon')}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span>{formatCurrency(sub.amount)}</span>
            {sub.next_billing_date && <span>{t('bills.next')} {formatDate(sub.next_billing_date, calendar)}</span>}
            {sub.max_repetitions != null && (
              <span>{sub.max_repetitions} repetition{sub.max_repetitions !== 1 ? 's' : ''} left</span>
            )}
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
        <SubscriptionForm
          initial={{
            name: sub.name,
            amount: sub.amount != null ? String(sub.amount) : '',
            billing_cycle: (sub.billing_cycle as SubFormState['billing_cycle']) ?? 'monthly',
            next_billing_date: sub.next_billing_date ?? '',
            max_repetitions: sub.max_repetitions != null ? String(sub.max_repetitions) : '',
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
  const { t } = useTranslation();
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
    if (!confirm(t('bills.deleteConfirm'))) return;
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
        <p className="text-sm text-gray-500">{t('bills.billCount_one', { count: bills.length })}</p>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? t('common.cancel') : t('bills.addBill')}
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
        <p className="text-center text-gray-400 py-12">{t('bills.loadingBills')}</p>
      ) : bills.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-4 py-8 text-center">{t('bills.noBills')}</p>
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
      {!loading && bills.length > 0 && <BillsCharts bills={bills} />}
    </div>
  );
}

// ─── Subscriptions section ────────────────────────────────────────────────────

function SubscriptionsSection({ token }: { token: string }) {
  const { t } = useTranslation();
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
        ...(form.max_repetitions && { max_repetitions: parseInt(form.max_repetitions, 10) }),
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
        max_repetitions: form.max_repetitions ? parseInt(form.max_repetitions, 10) : null,
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
    if (!confirm(t('bills.deleteSubConfirm'))) return;
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
        <p className="text-sm text-gray-500">{t('bills.subCount_one', { count: subs.length })}</p>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? t('common.cancel') : t('bills.addSubscription')}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {showAddForm && (
        <SubscriptionForm
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
          saving={addSaving}
        />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">{t('bills.loadingSubs')}</p>
      ) : subs.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-4 py-8 text-center">{t('bills.noSubs')}</p>
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

// ─── Loans section ────────────────────────────────────────────────────────────

function LoansSection({ token }: { token: string }) {
  const { t } = useTranslation();
  const { calendar } = useCalendar();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLoans(token)
      .then(setLoans)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(form: LoanFormState) {
    if (!form.name.trim() || !form.total_amount || !form.remaining_amount) return;
    setAddSaving(true);
    try {
      const data: CreateLoanData = {
        name: form.name.trim(),
        ...(form.lender && { lender: form.lender.trim() }),
        total_amount: parseFloat(form.total_amount),
        remaining_amount: parseFloat(form.remaining_amount),
        ...(form.installment && { installment: parseFloat(form.installment) }),
        ...(form.next_payment_date && { next_payment_date: form.next_payment_date }),
        ...(form.notes && { notes: form.notes.trim() }),
      };
      const created = await createLoan(token, data);
      setLoans(prev => [created, ...prev]);
      setShowAddForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddSaving(false);
    }
  }

  async function handleToggleActive(loan: Loan) {
    try {
      const updated = await updateLoan(token, loan.id, { active: loan.active ? 0 : 1 });
      setLoans(prev => prev.map(l => (l.id === updated.id ? updated : l)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveEdit(loan: Loan, form: LoanFormState) {
    setEditSaving(true);
    try {
      const updated = await updateLoan(token, loan.id, {
        name: form.name.trim(),
        lender: form.lender.trim() || undefined,
        total_amount: parseFloat(form.total_amount),
        remaining_amount: parseFloat(form.remaining_amount),
        installment: form.installment ? parseFloat(form.installment) : undefined,
        next_payment_date: form.next_payment_date || undefined,
        notes: form.notes.trim() || undefined,
      });
      setLoans(prev => prev.map(l => (l.id === updated.id ? updated : l)));
      setEditingId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('bills.deleteLoanConfirm'))) return;
    try {
      await deleteLoan(token, id);
      setLoans(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const progressPct = (loan: Loan) => {
    if (!loan.total_amount) return 0;
    const paid = loan.total_amount - loan.remaining_amount;
    return Math.min(100, Math.max(0, Math.round((paid / loan.total_amount) * 100)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{t('bills.loanCount_one', { count: loans.length })}</p>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? t('common.cancel') : t('bills.addLoan')}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ms-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {showAddForm && (
        <LoanForm onSave={handleCreate} onCancel={() => setShowAddForm(false)} saving={addSaving} />
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">{t('bills.loadingLoans')}</p>
      ) : loans.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-4 py-8 text-center">{t('bills.noLoans')}</p>
      ) : (
        <ul className="space-y-2">
          {loans.map(loan => {
            const pct = progressPct(loan);
            const daysUntil = daysFromToday(loan.next_payment_date);
            const isDueSoon = loan.active === 1 && daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
            const isOverdue = loan.active === 1 && daysUntil !== null && daysUntil < 0;
            const isPaidOff = loan.remaining_amount <= 0;
            const rowBg = isPaidOff
              ? 'bg-green-50 border-green-200'
              : isOverdue
              ? 'bg-red-50 border-red-200'
              : isDueSoon
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-gray-200';

            return (
              <li key={loan.id} className="space-y-2">
                <div className={`flex items-start gap-3 py-3 px-4 rounded-lg border ${rowBg} transition-colors`}>
                  {/* Active / paid-off toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(loan)}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isPaidOff || !loan.active
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-400 hover:border-green-400'
                    }`}
                    title={loan.active ? t('loans.markPaidOff') : t('loans.markActive')}
                  >
                    {(isPaidOff || !loan.active) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span dir="auto" className={`text-sm font-medium ${!loan.active ? 'text-gray-400' : 'text-gray-800'}`}>
                        {loan.name}
                      </span>
                      {loan.lender && (
                        <span dir="auto" className="text-xs text-gray-500">{loan.lender}</span>
                      )}
                      {isPaidOff && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('loans.paidOff')}</span>
                      )}
                      {!loan.active && !isPaidOff && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t('loans.inactive')}</span>
                      )}
                      {isOverdue && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('bills.overdue')}</span>
                      )}
                      {isDueSoon && !isOverdue && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('bills.dueSoon')}</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{pct}%</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>{t('loans.remainingAmount')}: {formatCurrency(loan.remaining_amount)}</span>
                      {loan.installment != null && (
                        <span>{t('loans.installment')}: {formatCurrency(loan.installment)}</span>
                      )}
                      {loan.next_payment_date && (
                        <span>{t('loans.nextPayment')}: {formatDate(loan.next_payment_date, calendar)}</span>
                      )}
                    </div>
                    {loan.notes && <p dir="auto" className="mt-0.5 text-xs text-gray-400 italic">{loan.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { setEditingId(loan.id); setShowAddForm(false); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(loan.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                {editingId === loan.id && (
                  <LoanForm
                    initial={{
                      name: loan.name,
                      lender: loan.lender ?? '',
                      total_amount: String(loan.total_amount),
                      remaining_amount: String(loan.remaining_amount),
                      installment: loan.installment != null ? String(loan.installment) : '',
                      due_day: '',
                      next_payment_date: loan.next_payment_date ?? '',
                      notes: loan.notes ?? '',
                    }}
                    onSave={form => handleSaveEdit(loan, form)}
                    onCancel={() => setEditingId(null)}
                    saving={editSaving}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && loans.length > 0 && <LoansCharts loans={loans} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'bills' | 'subscriptions' | 'loans';

export default function BillsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('bills');

  if (!token) return null;

  const TAB_LABELS: Record<Tab, string> = {
    bills: t('bills.billsTab'),
    subscriptions: t('bills.subscriptionsTab'),
    loans: t('bills.loansTab'),
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-4">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-800">{t('bills.title')}</h1>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        {(['bills', 'subscriptions', 'loans'] as Tab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'bills' && <BillsSection token={token} />}
      {activeTab === 'subscriptions' && <SubscriptionsSection token={token} />}
      {activeTab === 'loans' && <LoansSection token={token} />}
    </div>
  );
}
