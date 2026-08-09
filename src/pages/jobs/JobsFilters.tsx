import React from 'react';
import { Search, Filter, RefreshCcw, Save } from 'lucide-react';
import type { JobFilterState } from './types';

interface JobsFiltersProps {
  filters: JobFilterState;
  onChange: (newFilters: Partial<JobFilterState>) => void;
  statusCounts: Record<string, number>;
}

const STATUS_TABS = [
  { id: 'all', label: 'All Jobs' },
  { id: 'Quoted', label: 'Quoted' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Invoiced', label: 'Invoiced' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Cancelled', label: 'Cancelled' }
];

export const JobsFilters: React.FC<JobsFiltersProps> = ({ filters, onChange, statusCounts }) => {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0] space-y-6">
      
      {/* Top Search & Filter Actions */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18} />
          <input 
            type="text" 
            placeholder="Search by Job #, Customer, Phone, Email, or Address..."
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 focus:border-[#7CC242] transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button className="px-4 py-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2">
            <Filter size={16} />
            More Filters
          </button>
          <button className="px-4 py-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2">
            <Save size={16} />
            Save Filter
          </button>
          <button 
            onClick={() => onChange({ searchQuery: '', status: 'all', dateRange: '', crew: '', sort: 'Newest' })}
            className="px-4 py-2.5 bg-white border border-[#E2E8F0] hover:bg-[#FEF2F2] hover:text-[#DC2626] hover:border-[#FECACA] text-[#64748B] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2"
          >
            <RefreshCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Advanced Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer"
        >
          <option value="Newest">Sort: Newest</option>
          <option value="Oldest">Sort: Oldest</option>
          <option value="Highest Value">Sort: Highest Value</option>
          <option value="Nearest Date">Sort: Nearest Date</option>
        </select>
        
        <select
          value={filters.dateRange}
          onChange={(e) => onChange({ dateRange: e.target.value })}
          className="px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer"
        >
          <option value="">Date Range: All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        
        <select
          value={filters.crew}
          onChange={(e) => onChange({ crew: e.target.value })}
          className="px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer"
        >
          <option value="">Crew: All</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
        </select>
      </div>

      {/* Modern Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map(tab => {
          const isActive = filters.status === tab.id;
          const count = statusCounts[tab.id] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => onChange({ status: tab.id })}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-[#151A2D] text-white shadow-md' 
                  : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#151A2D]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                isActive ? 'bg-white/20 text-white' : 'bg-white text-[#64748B] shadow-sm'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
