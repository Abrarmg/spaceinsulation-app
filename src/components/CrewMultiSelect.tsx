import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown, Check, Users } from 'lucide-react';

export interface CrewWorker {
  id: string;
  full_name: string;
  role?: string;
}

export interface CrewMultiSelectProps {
  workers: CrewWorker[];
  selectedWorkerIds: string[];
  onChange: (workerIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const CrewMultiSelect: React.FC<CrewMultiSelectProps> = ({
  workers,
  selectedWorkerIds,
  onChange,
  disabled = false,
  placeholder = 'Select crew / workers...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers;
    const q = searchQuery.toLowerCase().trim();
    return workers.filter(w => w.full_name.toLowerCase().includes(q));
  }, [workers, searchQuery]);

  // Map selected IDs to worker objects
  const selectedWorkers = useMemo(() => {
    return selectedWorkerIds
      .map(id => workers.find(w => w.id === id))
      .filter((w): w is CrewWorker => Boolean(w));
  }, [selectedWorkerIds, workers]);

  const isUnassignedActive = selectedWorkerIds.length === 0;

  // Toggle worker selection
  const handleToggleWorker = (workerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedWorkerIds.includes(workerId)) {
      onChange(selectedWorkerIds.filter(id => id !== workerId));
    } else {
      // Adding worker automatically disables Unassigned
      onChange([...selectedWorkerIds, workerId]);
    }
  };

  // Remove worker chip
  const handleRemoveWorker = (workerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedWorkerIds.filter(id => id !== workerId));
  };

  // Select Unassigned (clears all)
  const handleSelectUnassigned = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Clear all selected workers
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div ref={containerRef} className={`relative w-full text-left font-sans ${className}`}>
      {/* Field Trigger Box */}
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full min-h-[42px] px-3 py-2 bg-white border ${
          isOpen ? 'border-[#7CC242] ring-2 ring-[#7CC242]/20' : 'border-[#E2E8F0]'
        } rounded-xl text-sm transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-slate-300'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-grow overflow-hidden">
          {selectedWorkers.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8]">
              <Users size={14} className="text-[#94A3B8] shrink-0" />
              <span>Unassigned</span>
            </div>
          ) : (
            selectedWorkers.map(w => (
              <span
                key={w.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#151A2D] shadow-3xs transition-all hover:bg-slate-200"
              >
                <span>{w.full_name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${w.full_name}`}
                  onClick={(e) => handleRemoveWorker(w.id, e)}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[#64748B] hover:text-[#DC2626] hover:bg-white transition-colors cursor-pointer"
                >
                  <X size={11} className="stroke-[2.5]" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Right Action Icons: Clear All + Chevron */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {selectedWorkers.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] font-black text-[#64748B] hover:text-[#DC2626] uppercase tracking-wider px-1 py-0.5 rounded transition-colors"
              title="Clear all selected workers"
            >
              Clear
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-[#94A3B8] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-xl overflow-hidden py-1.5 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-[#F1F5F9] flex items-center gap-2">
            <Search size={14} className="text-[#94A3B8] shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search crew / workers..."
              className="w-full text-xs font-semibold text-[#151A2D] placeholder-[#94A3B8] bg-transparent focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="text-[#94A3B8] hover:text-[#151A2D] p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Actions & Unassigned Option */}
          <div className="py-1 border-b border-[#F1F5F9]">
            {/* Unassigned row */}
            <div
              role="checkbox"
              aria-checked={isUnassignedActive}
              tabIndex={0}
              onClick={handleSelectUnassigned}
              className={`flex items-center justify-between px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                isUnassignedActive ? 'bg-[#F0FDF4] text-[#166534]' : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isUnassignedActive
                      ? 'bg-[#151A2D] border-[#151A2D] text-white'
                      : 'border-[#CBD5E1] bg-white'
                  }`}
                >
                  {isUnassignedActive && <Check size={12} className="stroke-[3]" />}
                </div>
                <span>Unassigned</span>
              </div>
              <span className="text-[10px] text-[#94A3B8] font-normal uppercase">None</span>
            </div>
          </div>

          {/* Workers List with Checkboxes */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredWorkers.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs font-semibold text-[#94A3B8]">
                No workers found matching "{searchQuery}"
              </div>
            ) : (
              filteredWorkers.map(w => {
                const isSelected = selectedWorkerIds.includes(w.id);
                return (
                  <div
                    key={w.id}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={(e) => handleToggleWorker(w.id, e)}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#F0FDF4] text-[#166534]'
                        : 'text-[#151A2D] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[#7CC242] border-[#7CC242] text-white'
                            : 'border-[#CBD5E1] bg-white'
                        }`}
                      >
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </div>
                      <span className="font-semibold text-xs text-[#151A2D]">{w.full_name}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-black text-[#7CC242] uppercase tracking-wider">
                        Assigned
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar with Selection Count & Clear All */}
          <div className="px-3 py-2 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#64748B]">
            <span className="font-semibold">
              {selectedWorkerIds.length} worker{selectedWorkerIds.length !== 1 ? 's' : ''} assigned
            </span>
            {selectedWorkerIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-black text-[#DC2626] hover:underline cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
