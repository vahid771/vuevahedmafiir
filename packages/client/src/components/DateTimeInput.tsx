import { useCalendar } from '../context/CalendarContext';
import CalendarDatePicker from './CalendarDatePicker';

interface DateTimeInputProps {
  /** ISO datetime string in YYYY-MM-DDTHH:MM format */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}

/**
 * Smart datetime input wrapper.
 * - For all calendar systems: renders CalendarDatePicker for the date part
 *   + a native <input type="time"> for the time part, combined as YYYY-MM-DDTHH:MM
 */
export default function DateTimeInput({ value, onChange, className = '', id }: DateTimeInputProps) {
  const { calendar } = useCalendar();
  const isRtl = calendar === 'shamsi' || calendar === 'qamari' || calendar === 'hebrew';

  const datePart = value ? value.slice(0, 10) : '';
  const timePart = value ? value.slice(11, 16) : '';

  function handleDateChange(gregorianDate: string) {
    onChange(gregorianDate ? `${gregorianDate}T${timePart || '00:00'}` : '');
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(datePart ? `${datePart}T${e.target.value}` : '');
  }

  return (
    <div className={`flex gap-2 ${className}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex-1">
        <CalendarDatePicker value={datePart} onChange={handleDateChange} />
      </div>
      <input
        id={id}
        type="time"
        value={timePart}
        onChange={handleTimeChange}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
      />
    </div>
  );
}
