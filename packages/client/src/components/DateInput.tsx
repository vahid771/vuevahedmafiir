import CalendarDatePicker from './CalendarDatePicker';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Smart date input wrapper — renders a CalendarDatePicker for all calendar systems.
 * Receives and emits YYYY-MM-DD Gregorian strings.
 */
export default function DateInput({ value, onChange, className = '', placeholder, disabled }: DateInputProps) {
  return (
    <CalendarDatePicker
      value={value}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
