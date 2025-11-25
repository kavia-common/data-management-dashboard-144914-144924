import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

/**
 * PUBLIC_INTERFACE
 * ScrollableDateRangePicker
 * A reusable accessible date-range picker with scrollable month navigation and year dropdown.
 * Maintains keyboard navigation support and ARIA labels.
 *
 * Props:
 * - from: Date | null - start date of range
 * - to: Date | null - end date of range
 * - onChange: function({ from: Date|null, to: Date|null }) - change handler
 * - numberOfMonths: number - how many months to render at once (default 2)
 * - minYear: number - minimum year in dropdown (default currentYear - 10)
 * - maxYear: number - maximum year in dropdown (default currentYear)
 * - ariaLabel: string - aria label for the picker region
 * - className: string - optional class
 */
export default function ScrollableDateRangePicker({
  from,
  to,
  onChange,
  numberOfMonths = 2,
  minYear,
  maxYear,
  ariaLabel = 'Date range picker',
  className = '',
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const safeMinYear = typeof minYear === 'number' ? minYear : currentYear - 10;
  const safeMaxYear = typeof maxYear === 'number' ? maxYear : currentYear + 1;

  const [month, setMonth] = useState(from || new Date());

  useEffect(() => {
    if (from instanceof Date) {
      setMonth(from);
    }
  }, [from?.getFullYear?.(), from?.getMonth?.()]);

  const years = useMemo(() => {
    const arr = [];
    for (let y = safeMaxYear; y >= safeMinYear; y--) arr.push(y);
    return arr;
  }, [safeMinYear, safeMaxYear]);

  const handleSelect = useCallback(
    (range) => {
      // react-day-picker v8 gives { from, to }
      if (!range) {
        onChange?.({ from: null, to: null });
        return;
      }
      const { from: nFrom = null, to: nTo = null } = range;
      onChange?.({ from: nFrom, to: nTo });
    },
    [onChange]
  );

  const onWheelMonthNavigate = useCallback(
    (e) => {
      // Allow mouse wheel to navigate months for quick scrolling
      e.preventDefault();
      const delta = e.deltaY;
      const base = month || new Date();
      const next = new Date(base);
      if (delta > 0) {
        next.setMonth(base.getMonth() + 1);
      } else if (delta < 0) {
        next.setMonth(base.getMonth() - 1);
      }
      setMonth(next);
    },
    [month]
  );

  const handleYearChange = useCallback(
    (e) => {
      const y = parseInt(e.target.value, 10);
      if (!Number.isNaN(y)) {
        const m = month || new Date();
        const next = new Date(m);
        next.setFullYear(y);
        setMonth(next);
      }
    },
    [month]
  );

  const Caption = useCallback(
    ({ displayMonth }) => {
      const displayYear = displayMonth.getFullYear();
      const displayMonthIndex = displayMonth.getMonth();
      const monthName = displayMonth.toLocaleString(undefined, { month: 'long' });

      return (
        <div
          className="sdrp-caption"
          role="group"
          aria-label={`Calendar caption ${monthName} ${displayYear}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '0.5rem',
          }}
        >
          <div aria-hidden="true" style={{ fontWeight: 600 }}>
            {monthName}
          </div>
          <label className="sr-only" htmlFor="sdrp-year-select">
            Select year
          </label>
          <select
            id="sdrp-year-select"
            aria-label="Select year"
            value={displayYear}
            onChange={handleYearChange}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '4px 8px',
              background: '#fff',
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      );
    },
    [handleYearChange, years]
  );

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`sdrp ${className}`}
      onWheel={onWheelMonthNavigate}
      style={{ maxWidth: 600 }}
    >
      <DayPicker
        mode="range"
        selected={{ from: from || undefined, to: to || undefined }}
        onSelect={handleSelect}
        numberOfMonths={numberOfMonths}
        month={month}
        onMonthChange={setMonth}
        captionLayout="buttons"
        components={{ Caption }}
        // Accessibility labels
        labels={{
          labelMonthDropdown: () => 'Month',
          labelYearDropdown: () => 'Year',
          labelNext: () => 'Next month',
          labelPrevious: () => 'Previous month',
        }}
        showOutsideDays
        ISOWeek
      />
    </div>
  );
}
