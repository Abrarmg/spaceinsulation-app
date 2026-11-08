import React from 'react';
import { RotateCcw } from 'lucide-react';
import { FilterSelect, SearchInput } from '../../components/ui/list';
import type { StaffFilterState } from './types';

interface EmployeesControlsProps {
  filters: StaffFilterState;
  onFilterChange: (newFilters: Partial<StaffFilterState>) => void;
}

/** Search and filters for the staff roster. */
export const EmployeesControls: React.FC<EmployeesControlsProps> = ({ filters, onFilterChange }) => {
  const hasActiveFilters = filters.searchQuery || filters.role || filters.status || filters.certification || filters.availability;

  return (
    <>
      <SearchInput value={filters.searchQuery} onChange={searchQuery => onFilterChange({ searchQuery })} placeholder="Search staff by name or phone" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 [&>select]:shrink-0">
        <FilterSelect value={filters.role} onChange={e => onFilterChange({ role: e.target.value })} aria-label="Role">
          <option value="">All roles</option>
          <option value="Field Technician">Field technician</option>
          <option value="Lead Technician">Lead technician</option>
          <option value="Installer">Installer</option>
          <option value="Office Staff">Office staff</option>
          <option value="Supervisor">Supervisor</option>
          <option value="Manager">Manager</option>
        </FilterSelect>
        <FilterSelect value={filters.status} onChange={e => onFilterChange({ status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </FilterSelect>
        <FilterSelect value={filters.certification} onChange={e => onFilterChange({ certification: e.target.value })} aria-label="Certificates">
          <option value="">Any certificates</option>
          <option value="Has Certifications">Has certificates</option>
          <option value="Expiring Soon">Expiring soon</option>
          <option value="No Certifications">No certificates</option>
        </FilterSelect>
        <FilterSelect value={filters.availability} onChange={e => onFilterChange({ availability: e.target.value })} aria-label="Availability">
          <option value="">Any availability</option>
          <option value="Available Today">Available today</option>
        </FilterSelect>
      </div>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onFilterChange({ searchQuery: '', role: '', status: '', certification: '', availability: '' })}
          className="h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted hover:text-navy hover:bg-mist border-0 bg-transparent"
        >
          <RotateCcw size={14} /> Clear filters
        </button>
      )}
    </>
  );
};
