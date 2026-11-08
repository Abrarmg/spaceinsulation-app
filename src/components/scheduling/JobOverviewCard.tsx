import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  FileText, 
  ClipboardList, 
  HardHat, 
  Package, 
  Ban, 
  ChevronDown 
} from 'lucide-react';
import { Job } from './types';
import { parseJobDateStr } from './schedulingUtils';

interface JobOverviewCardProps {
  jobs: Job[];
  currentDate: Date;
  onFilterStatus?: (status: string) => void;
  activeStatusFilter?: string;
}

export const JobOverviewCard: React.FC<JobOverviewCardProps> = ({
  jobs,
  currentDate,
  onFilterStatus,
  activeStatusFilter
}) => {
  const [timeframe, setTimeframe] = useState<'month' | 'all'>('month');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Filter jobs based on selected timeframe
  const filteredJobs = jobs.filter(j => {
    if (timeframe === 'all') return true;
    const dateStr = parseJobDateStr(j.scheduled_date);
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === currentYear && m === (currentMonth + 1);
  });

  // Calculate real counts from real jobs
  const counts = {
    scheduled: 0,
    quotePending: 0,
    inspection: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0
  };

  filteredJobs.forEach(j => {
    const s = (j.status || '').toLowerCase();
    const scope = (j.scope_of_work || '').toLowerCase();

    if (s === 'cancelled') {
      counts.cancelled++;
    } else if (s === 'completed' || s === 'paid') {
      counts.completed++;
    } else if (s === 'in_progress' || s === 'in progress') {
      counts.inProgress++;
    } else if (s === 'quoted' || s === 'inspection' || scope.includes('inspection')) {
      counts.inspection++;
    } else if (s.includes('quote') || s === 'pending' || s === 'invoiced') {
      counts.quotePending++;
    } else {
      // Scheduled / confirmed / default
      counts.scheduled++;
    }
  });

  const items = [
    {
      id: 'scheduled',
      label: 'Scheduled',
      count: counts.scheduled,
      icon: CalendarIcon,
      boxBg: 'bg-[#DCFCE7]',
      iconColor: 'text-[#16A34A]',
      countColor: 'text-[#15803D]',
      filterKey: 'scheduled'
    },
    {
      id: 'quote_pending',
      label: 'Quote Pending',
      count: counts.quotePending,
      icon: FileText,
      boxBg: 'bg-[#FEF9C3]',
      iconColor: 'text-[#CA8A04]',
      countColor: 'text-[#A16207]',
      filterKey: 'quote pending'
    },
    {
      id: 'inspection',
      label: 'Inspection / Quoted',
      count: counts.inspection,
      icon: ClipboardList,
      boxBg: 'bg-[#DBEAFE]',
      iconColor: 'text-[#2563EB]',
      countColor: 'text-[#1D4ED8]',
      filterKey: 'inspection'
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      count: counts.inProgress,
      icon: HardHat,
      boxBg: 'bg-[#FFEDD5]',
      iconColor: 'text-[#EA580C]',
      countColor: 'text-[#C2410C]',
      filterKey: 'in_progress'
    },
    {
      id: 'completed',
      label: 'Completed',
      count: counts.completed,
      icon: Package,
      boxBg: 'bg-line',
      iconColor: 'text-muted',
      countColor: 'text-ink-soft',
      filterKey: 'completed'
    },
    {
      id: 'cancelled',
      label: 'Cancelled',
      count: counts.cancelled,
      icon: Ban,
      boxBg: 'bg-[#FEE2E2]',
      iconColor: 'text-[#DC2626]',
      countColor: 'text-[#B91C1C]',
      filterKey: 'cancelled'
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-line/80 p-4 shadow-3xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-navy tracking-tight m-0">
          Job Overview
        </h3>

        {/* Timeframe Dropdown */}
        <div className="relative">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as 'month' | 'all')}
            className="text-2xs font-bold text-muted bg-transparent border-none cursor-pointer pr-4 focus:outline-hidden"
          >
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <ChevronDown size={11} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-subtle" />
        </div>
      </div>

      {/* Metrics Rows */}
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isSelected = activeStatusFilter === item.filterKey;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterStatus?.(isSelected ? 'all' : item.filterKey)}
              className={`w-full flex items-center justify-between p-1.5 rounded-xl transition-all cursor-pointer border-none text-left ${
                isSelected 
                  ? 'bg-mist ring-1 ring-line-strong' 
                  : 'hover:bg-canvas'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded-lg ${item.boxBg} flex items-center justify-center shrink-0`}>
                  <Icon size={13} className={item.iconColor} />
                </div>
                <span className={`text-2xs font-bold ${item.countColor}`}>
                  {item.count}
                </span>
                <span className="text-2xs font-semibold text-muted">
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
