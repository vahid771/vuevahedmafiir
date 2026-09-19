import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateInput from '../DateInput';

export interface TaskFormState {
  title: string;
  description: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
}

export const EMPTY_TASK_FORM: TaskFormState = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
};

interface TaskFormProps {
  initial?: TaskFormState;
  onSave: (data: TaskFormState) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function TaskForm({ initial = EMPTY_TASK_FORM, onSave, onCancel, saving }: TaskFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<TaskFormState>(initial);

  function set<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('tasks.form.title')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('tasks.form.titlePlaceholder')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.description')}</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder={t('tasks.form.descriptionPlaceholder')}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.dueDate')}</label>
          <DateInput
            value={form.due_date}
            onChange={v => set('due_date', v)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('tasks.form.priority')}</label>
          <select
            value={form.priority}
            onChange={e => set('priority', e.target.value as TaskFormState['priority'])}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="low">{t('tasks.form.low')}</option>
            <option value="medium">{t('tasks.form.medium')}</option>
            <option value="high">{t('tasks.form.high')}</option>
          </select>
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
          disabled={saving || !form.title.trim()}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
