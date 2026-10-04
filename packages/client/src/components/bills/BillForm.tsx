import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateInput from '../DateInput';
import { useAuth } from '../../context/AuthContext';
import AttachmentsSection from '../attachments/AttachmentsSection';
import { useFormGuard } from '../../hooks/useFormGuard';
import FormActions from '../ui/FormActions';

export interface BillFormState {
  name: string;
  amount: string;
  due_date: string;
  recurrence: 'once' | 'monthly' | 'yearly';
}

export const EMPTY_BILL_FORM: BillFormState = {
  name: '',
  amount: '',
  due_date: '',
  recurrence: 'once',
};

interface BillFormProps {
  initial?: BillFormState;
  onSave: (data: BillFormState) => void;
  onCancel: () => void;
  saving: boolean;
  editId?: number;
}

export default function BillForm({ initial = EMPTY_BILL_FORM, onSave, onCancel, saving, editId }: BillFormProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [form, setForm] = useState<BillFormState>(initial);
  const { handleCancel } = useFormGuard(form, initial, onCancel);
  function set<K extends keyof BillFormState>(key: K, value: BillFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('bills.form.name')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('bills.form.namePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('bills.form.amount')}</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('bills.form.dueDate')}</label>
          <DateInput
            value={form.due_date}
            onChange={v => set('due_date', v)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('bills.form.recurrence')}</label>
          <select
            value={form.recurrence}
            onChange={e => set('recurrence', e.target.value as BillFormState['recurrence'])}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="once">{t('bills.form.once')}</option>
            <option value="monthly">{t('bills.form.monthly')}</option>
            <option value="yearly">{t('bills.form.yearly')}</option>
          </select>
        </div>
      </div>
      {editId && <AttachmentsSection entityType="bill" entityId={editId} token={token ?? ''} />}
      <FormActions
        onCancel={handleCancel}
        onSave={() => onSave(form)}
        saving={saving}
        disabled={saving || !form.name.trim()}
        justify="end"
      />
    </div>
  );
}
