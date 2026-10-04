import { useTranslation } from 'react-i18next';

export function useFormGuard<T>(
  form: T,
  initial: T,
  onCancel: () => void
): { handleCancel: () => void } {
  const { t } = useTranslation();
  function handleCancel() {
    const isDirty = JSON.stringify(form) !== JSON.stringify(initial);
    if (isDirty && !window.confirm(t('common.unsavedChanges'))) return;
    onCancel();
  }
  return { handleCancel };
}
