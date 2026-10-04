import { useTranslation } from 'react-i18next';

interface FormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  disabled?: boolean;
  justify?: 'end' | 'start';
}

export default function FormActions({ onCancel, onSave, saving, disabled, justify = 'start' }: FormActionsProps) {
  const { t } = useTranslation();

  if (justify === 'end') {
    return (
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
          onClick={onSave}
          disabled={disabled}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={onSave}
        disabled={disabled}
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? t('common.saving') : t('common.save')}
      </button>
      <button
        onClick={onCancel}
        className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
      >
        {t('common.cancel')}
      </button>
    </div>
  );
}
