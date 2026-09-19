import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface HabitFormState {
  name: string;
  frequency: 'daily' | 'weekly';
}

export const EMPTY_HABIT_FORM: HabitFormState = {
  name: '',
  frequency: 'daily',
};

interface HabitFormProps {
  initial?: HabitFormState;
  onSave: (data: HabitFormState) => void;
  onCancel: () => void;
  saving: boolean;
  editId: number | null;
}

export default function HabitForm({ initial = EMPTY_HABIT_FORM, onSave, onCancel, saving, editId }: HabitFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<HabitFormState>(initial);

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="font-semibold text-gray-800 mb-3">{editId ? t('habits.form.editHabit') : t('habits.form.newHabit')}</h2>
      <div className="flex gap-3">
        <input
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder={t('habits.form.namePlaceholder')}
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        />
        <select
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          value={form.frequency}
          onChange={e => setForm(p => ({ ...p, frequency: e.target.value as HabitFormState['frequency'] }))}
        >
          <option value="daily">{t('habits.form.daily')}</option>
          <option value="weekly">{t('habits.form.weekly')}</option>
        </select>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {t('common.save')}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
