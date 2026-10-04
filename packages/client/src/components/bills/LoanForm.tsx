import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateInput from '../DateInput';
import { useAuth } from '../../context/AuthContext';
import AttachmentsSection from '../attachments/AttachmentsSection';
import { useFormGuard } from '../../hooks/useFormGuard';
import FormActions from '../ui/FormActions';

export interface LoanFormState {
  name: string;
  lender: string;
  total_amount: string;
  remaining_amount: string;
  installment: string;
  due_day: string;
  next_payment_date: string;
  notes: string;
}

export const EMPTY_LOAN_FORM: LoanFormState = {
  name: '',
  lender: '',
  total_amount: '',
  remaining_amount: '',
  installment: '',
  due_day: '',
  next_payment_date: '',
  notes: '',
};

interface LoanFormProps {
  initial?: LoanFormState;
  onSave: (data: LoanFormState) => void;
  onCancel: () => void;
  saving: boolean;
  editId?: number;
}

export default function LoanForm({ initial = EMPTY_LOAN_FORM, onSave, onCancel, saving, editId }: LoanFormProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [form, setForm] = useState<LoanFormState>(initial);
  const { handleCancel } = useFormGuard(form, initial, onCancel);
  function set<K extends keyof LoanFormState>(key: K, value: LoanFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('loans.form.name')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('loans.form.namePlaceholder')}
          />
        </div>
        {/* Lender */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.form.lender')}</label>
          <input
            type="text"
            value={form.lender}
            onChange={e => set('lender', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('loans.form.lenderPlaceholder')}
          />
        </div>
        {/* Total amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('loans.form.totalAmount')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.total_amount}
            onChange={e => set('total_amount', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
        {/* Remaining amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('loans.form.remainingAmount')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.remaining_amount}
            onChange={e => set('remaining_amount', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
        {/* Installment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.form.installment')}</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.installment}
            onChange={e => set('installment', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
        {/* Next payment date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.form.nextPaymentDate')}</label>
          <DateInput
            value={form.next_payment_date}
            onChange={v => set('next_payment_date', v)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Notes — full width */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.form.notes')}</label>
          <input
            type="text"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('loans.form.notesPlaceholder')}
          />
        </div>
      </div>
      {editId && <AttachmentsSection entityType="loan" entityId={editId} token={token ?? ''} />}
      <FormActions
        onCancel={handleCancel}
        onSave={() => onSave(form)}
        saving={saving}
        disabled={saving || !form.name.trim() || !form.total_amount || !form.remaining_amount}
        justify="end"
      />
    </div>
  );
}
