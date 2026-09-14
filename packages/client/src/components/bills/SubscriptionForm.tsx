import { useState } from 'react';
import DateInput from '../DateInput';

export interface SubFormState {
  name: string;
  amount: string;
  billing_cycle: 'weekly' | 'monthly' | 'yearly';
  next_billing_date: string;
}

export const EMPTY_SUB_FORM: SubFormState = {
  name: '',
  amount: '',
  billing_cycle: 'monthly',
  next_billing_date: '',
};

interface SubFormProps {
  initial?: SubFormState;
  onSave: (data: SubFormState) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function SubscriptionForm({ initial = EMPTY_SUB_FORM, onSave, onCancel, saving }: SubFormProps) {
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
          <DateInput
            value={form.next_billing_date}
            onChange={v => set('next_billing_date', v)}
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
