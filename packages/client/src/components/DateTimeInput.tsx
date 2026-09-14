import { useCalendar } from '../context/CalendarContext';
import JalaliDatePicker from './JalaliDatePicker';

interface DateTimeInputProps {
  /** ISO datetime string in YYYY-MM-DDTHH:MM format */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}

/**
 * Smart datetime input wrapper.
 * - When calendar is "miladi": renders a native <input type="datetime-local">
 * - When calendar is "shamsi": renders JalaliDatePicker for the date part
 *   + a native <input type="time"> for the time part, combined as YYYY-MM-DDTHH:MM
 *
 * Both receive and emit YYYY-MM-DDTHH:MM strings.
 */
export default function DateTimeInput({ value, onChange, className = '', id }: DateTimeInputProps) {
  const { calendar } = useCalendar();

  if (calendar === 'shamsi') {
    const datePart = value ? value.slice(0, 10) : '';
    const timePart = value ? value.slice(11, 16) : '';

    function handleDateChange(gregorianDate: string) {
      onChange(gregorianDate ? `${gregorianDate}T${timePart || '00:00'}` : '');
    }

    function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
      onChange(datePart ? `${datePart}T${e.target.value}` : '');
    }

    return (
      <div className={`flex gap-2 ${className}`}>
        <div className="flex-1">
          <JalaliDatePicker value={datePart} onChange={handleDateChange} />
        </div>
        <input
          type="time"
          value={timePart}
          onChange={handleTimeChange}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
        />
      </div>
    );
  }

  return (
    <input
      id={id}
      type="datetime-local"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    />
  );
}
