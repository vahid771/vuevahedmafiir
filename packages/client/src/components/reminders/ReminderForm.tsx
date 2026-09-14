import { useState } from 'react';
import DateTimeInput from '../DateTimeInput';

export interface ReminderFormState {
  title: string;
  remind_at: string;
  notes: string;
}

export const EMPTY_REMINDER_FORM: ReminderFormState = {
  title: '',
  remind_at: '',
  notes: '',
};

interface ReminderFormProps {
  initial?: ReminderFormState;
  onSave: (data: ReminderFormState) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function ReminderForm({ initial = EMPTY_REMINDER_FORM, onSave, onCancel, saving }: ReminderFormProps) {
  const [form, setForm] = useState<ReminderFormState>(initial);

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
      <div className="space-y-3">
        <input
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="Title *"
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        />
        <DateTimeInput
          value={form.remind_at}
          onChange={v => setForm(p => ({ ...p, remind_at: v }))}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          rows={2}
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
        />
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
