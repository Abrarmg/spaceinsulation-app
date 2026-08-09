import React from 'react';
import { Search, Plus, X } from 'lucide-react';
import type { StaffFilterState } from './types';

interface EmployeesControlsProps {
  activeTab: 'roster' | 'payroll';
  setActiveTab: (tab: 'roster' | 'payroll') => void;
  filters: StaffFilterState;
  onFilterChange: (newFilters: Partial<StaffFilterState>) => void;
  onAddStaff: () => void;
  filteredCount: number;
}

export const EmployeesControls: React.FC<EmployeesControlsProps> = ({
  activeTab,
  setActiveTab,
  filters,
  onFilterChange,
  onAddStaff,
  filteredCount
}) => {
  const hasActiveFilters = filters.searchQuery || filters.role || filters.status || filters.certification || filters.availability;

  const handleClearFilters = () => {
    onFilterChange({
      searchQuery: '',
      role: '',
      status: '',
      certification: '',
      availability: ''
    });
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0] space-y-6">
      {/* Top Controls: Tabs & Add Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex bg-[#F1F5F9] p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'roster'
                ? 'bg-white text-[#151A2D] shadow-sm'
                : 'text-[#64748B] hover:text-[#151A2D]'
            }`}
          >
            Roster
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'payroll'
                ? 'bg-white text-[#151A2D] shadow-sm'
                : 'text-[#64748B] hover:text-[#151A2D]'
            }`}
          >
            Payroll Logs
          </button>
        </div>

        <button
          onClick={onAddStaff}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#7CC242] hover:bg-[#6ab331] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#7CC242]/20 flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Add Staff
        </button>
      </div>

      {/* Advanced Filter Bar (Only show on Roster tab) */}
      {activeTab === 'roster' && (
        <div className="flex flex-col xl:flex-row items-center gap-3">
          <div className="relative w-full xl:w-96 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18} />
            <input
              type="text"
              placeholder="Search staff..."
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 focus:border-[#7CC242] transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full">
            <select
              value={filters.role}
              onChange={(e) => onFilterChange({ role: e.target.value })}
              className="px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer flex-1 sm:flex-none"
            >
              <option value="">All Roles</option>
              <option value="Field Technician">Field Technician</option>
              <option value="Lead Technician">Lead Technician</option>
              <option value="Installer">Installer</option>
              <option value="Office Staff">Office Staff</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Manager">Manager</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => onFilterChange({ status: e.target.value })}
              className="px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer flex-1 sm:flex-none"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              value={filters.certification}
              onChange={(e) => onFilterChange({ certification: e.target.value })}
              className="px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer flex-1 sm:flex-none"
            >
              <option value="">Certifications</option>
              <option value="Has Certifications">Has Certifications</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="No Certifications">No Certifications</option>
            </select>
            
            <select
              value={filters.availability}
              onChange={(e) => onFilterChange({ availability: e.target.value })}
              className="px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer flex-1 sm:flex-none"
            >
              <option value="">Availability</option>
              <option value="Available Today">Available Today</option>
            </select>
          </div>

          <div className="flex items-center gap-4 ml-auto whitespace-nowrap pt-2 xl:pt-0">
            <span className="text-xs font-semibold text-[#64748B]">
              {filteredCount} {filteredCount === 1 ? 'staff member' : 'staff members'} found
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-xs font-bold text-[#EF4444] hover:bg-[#FEF2F2] px-3 py-1.5 rounded-lg transition-colors"
              >
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
