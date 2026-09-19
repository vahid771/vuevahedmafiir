import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateInput from '../DateInput';

export interface DateFormState {
  title: string;
  date: string;
  recurs_yearly: boolean;
  notes: string;
}

export const EMPTY_DATE_FORM: DateFormState = {
  title: '',
  date: '',
  recurs_yearly: false,
  notes: '',
};

interface DateFormProps {
  initial?: DateFormState;
  onSave: (data: DateFormState) => void;
  onCancel: () => void;
  saving: boolean;
  editId: number | null;
}

export default function DateForm({ initial = EMPTY_DATE_FORM, onSave, onCancel, saving, editId }: DateFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<DateFormState>(initial);

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="font-semibold text-gray-800 mb-3">{editId ? t('dates.form.editDate') : t('dates.form.newDate')}</h2>
      <div className="space-y-3">
        <input
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder={t('dates.form.titlePlaceholder')}
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        />
        <DateInput
          value={form.date}
          onChange={v => setForm(p => ({ ...p, date: v }))}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.recurs_yearly}
            onChange={e => setForm(p => ({ ...p, recurs_yearly: e.target.checked }))}
          />
          {t('dates.form.recursYearly')}
        </label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          rows={2}
          placeholder={t('dates.form.notesPlaceholder')}
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
