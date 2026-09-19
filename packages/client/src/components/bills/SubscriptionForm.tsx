import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateInput from '../DateInput';

export interface SubFormState {
  name: string;
  amount: string;
  billing_cycle: 'weekly' | 'monthly' | 'yearly';
  next_billing_date: string;
  max_repetitions: string;
}

export const EMPTY_SUB_FORM: SubFormState = {
  name: '',
  amount: '',
  billing_cycle: 'monthly',
  next_billing_date: '',
  max_repetitions: '',
};

interface SubFormProps {
  initial?: SubFormState;
  onSave: (data: SubFormState) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function SubscriptionForm({ initial = EMPTY_SUB_FORM, onSave, onCancel, saving }: SubFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<SubFormState>(initial);
  function set<K extends keyof SubFormState>(key: K, value: SubFormState[K]) {
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
            placeholder={t('bills.form.subNamePlaceholder')}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('bills.form.billingCycle')}</label>
          <select
            value={form.billing_cycle}
            onChange={e => set('billing_cycle', e.target.value as SubFormState['billing_cycle'])}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="weekly">{t('bills.form.weekly')}</option>
            <option value="monthly">{t('bills.form.monthly')}</option>
            <option value="yearly">{t('bills.form.yearly')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('bills.form.nextBillingDate')}</label>
          <DateInput
            value={form.next_billing_date}
            onChange={v => set('next_billing_date', v)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('bills.form.maxRepetitions')}</label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.max_repetitions}
            onChange={e => set('max_repetitions', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('bills.form.unlimited')}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
