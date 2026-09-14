import { useCalendar } from '../context/CalendarContext';
import JalaliDatePicker from './JalaliDatePicker';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}

/**
 * Smart date input wrapper.
 * - When calendar is "miladi": renders a native <input type="date">
 * - When calendar is "shamsi": renders the JalaliDatePicker
 *
 * Both receive and emit YYYY-MM-DD Gregorian strings.
 */
export default function DateInput({ value, onChange, className = '', id }: DateInputProps) {
  const { calendar } = useCalendar();

  if (calendar === 'shamsi') {
    return (
      <JalaliDatePicker
        value={value}
        onChange={onChange}
        className={className}
      />
    );
  }

  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    />
  );
}
