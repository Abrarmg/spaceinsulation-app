import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseJobDateStr, toDateKey } from './schedulingUtils';
import { Job } from './types';
import { todayDate } from '../../utils/dates';

interface MiniCalendarProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (newDate: Date) => void;
  jobs: Job[];
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  currentDate,
  selectedDate,
  onSelectDate,
  onMonthChange,
  jobs
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Month title e.g. "July 2026"
  const monthTitle = currentDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });

  const handlePrevMonth = () => {
    onMonthChange(new Date(year, month - 1, 1, 12));
  };

  const handleNextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1, 12));
  };

  // Build grid of days
  const firstDayOfMonth = new Date(year, month, 1, 12).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const daysInPrevMonth = new Date(year, month, 0, 12).getDate();

  const days: Array<{
    dayNumber: number;
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    hasJobs: boolean;
  }> = [];

  const todayStr = toDateKey(todayDate());
  const selectedStr = toDateKey(selectedDate);

  // Set of dates with jobs
  const jobDateSet = new Set(
    jobs.map(j => parseJobDateStr(j.scheduled_date)).filter(Boolean)
  );

  // 1. Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNumber = daysInPrevMonth - i;
    const date = new Date(year, month - 1, dayNumber, 12);
    const dateStr = toDateKey(date);
    days.push({
      dayNumber,
      date,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      hasJobs: jobDateSet.has(dateStr)
    });
  }

  // 2. Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i, 12);
    const dateStr = toDateKey(date);
    days.push({
      dayNumber: i,
      date,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      hasJobs: jobDateSet.has(dateStr)
    });
  }

  // 3. Next month leading days to complete row grid (up to 35 or 42 cells)
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const date = new Date(year, month + 1, i, 12);
    const dateStr = toDateKey(date);
    days.push({
      dayNumber: i,
      date,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      hasJobs: jobDateSet.has(dateStr)
    });
  }

  const weekDayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="bg-white rounded-2xl border border-line/80 p-4 shadow-3xs select-none">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-navy tracking-tight m-0">
          {monthTitle}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-subtle hover:text-ink-soft hover:bg-mist transition-colors border-none bg-transparent cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-subtle hover:text-ink-soft hover:bg-mist transition-colors border-none bg-transparent cursor-pointer"
            title="Next Month"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekDayHeaders.map((day) => (
          <div key={day} className="text-[10.5px] font-bold text-subtle py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days matrix */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((item, idx) => {
          const isSelected = item.isSelected;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(item.date)}
              className={`relative h-7 w-7 mx-auto rounded-full flex flex-col items-center justify-center text-2xs font-bold transition-all cursor-pointer border-none bg-transparent ${
                isSelected
                  ? 'bg-brand text-navy shadow-xs font-bold scale-105'
                  : item.isCurrentMonth
                  ? 'text-ink-soft hover:bg-mist'
                  : 'text-line-strong hover:bg-canvas'
              }`}
            >
              <span>{item.dayNumber}</span>
              {/* Job indicator dot */}
              {item.hasJobs && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
