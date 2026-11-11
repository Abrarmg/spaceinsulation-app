import React from 'react';
import { RotateCcw } from 'lucide-react';
import { FilterSelect, SearchInput, StatusTabs } from '../../components/ui/list';
import type { JobFilterState } from './types';

interface JobsFiltersProps {
  filters: JobFilterState;
  onChange: (newFilters: Partial<JobFilterState>) => void;
  statusCounts: Record<string, number>;
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'Quoted', label: 'Quoted' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'In Progress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Invoiced', label: 'Invoiced' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export const DEFAULT_JOB_FILTERS: JobFilterState = { searchQuery: '', status: 'all', dateRange: '', crew: '', sort: 'Newest' };

/** Status tabs along the top of the jobs list. */
export const JobsStatusTabs: React.FC<JobsFiltersProps> = ({ filters, onChange, statusCounts }) => (
  <StatusTabs
    tabs={STATUS_TABS.map(t => ({ ...t, count: statusCounts[t.value] || 0 }))}
    value={filters.status}
    onChange={status => onChange({ status })}
  />
);

/** Search, sort and filter controls for the jobs list. */
export const JobsFilters: React.FC<Omit<JobsFiltersProps, 'statusCounts'>> = ({ filters, onChange }) => {
  const isFiltered = filters.searchQuery || filters.dateRange || filters.crew || filters.sort !== 'Newest';

  return (
    <>
      <SearchInput
        value={filters.searchQuery}
        onChange={searchQuery => onChange({ searchQuery })}
        placeholder="Search job #, customer, phone, email or address"
        className="sm:min-w-[260px]"
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 [&>select]:shrink-0">
        <FilterSelect value={filters.dateRange} onChange={e => onChange({ dateRange: e.target.value })} aria-label="Date">
          <option value="">Any date</option>
          <option value="upcoming">Upcoming</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </FilterSelect>
        <FilterSelect value={filters.crew} onChange={e => onChange({ crew: e.target.value })} aria-label="Crew">
          <option value="">Any crew</option>
          <option value="unassigned">Needs a crew</option>
          <option value="assigned">Crew assigned</option>
        </FilterSelect>
        <FilterSelect value={filters.sort} onChange={e => onChange({ sort: e.target.value })} aria-label="Sort">
          <option value="Newest">Newest first</option>
          <option value="Oldest">Oldest first</option>
          <option value="Highest Value">Highest value</option>
          <option value="Nearest Date">Soonest date</option>
        </FilterSelect>
      </div>
      {isFiltered && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_JOB_FILTERS, status: filters.status })}
          className="h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted hover:text-navy hover:bg-mist border-0 bg-transparent"
        >
          <RotateCcw size={14} /> Clear filters
        </button>
      )}
    </>
  );
};
