import React from 'react';
import { Plus, Download, Calendar, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface JobsHeaderProps {
  onNewJob: () => void;
  onExport: () => void;
  onImport: () => void;
}

export const JobsHeader: React.FC<JobsHeaderProps> = ({ onNewJob, onExport, onImport }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-line">
      <div>
        <h1 className="text-2xl font-bold text-navy m-0">Jobs & Scheduling</h1>
        <p className="text-sm font-semibold text-muted m-0 mt-1">
          Track every insulation project from estimate to completion.
        </p>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={onImport}
          className="px-4 py-2 bg-white border border-line hover:bg-canvas text-navy text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Upload size={16} className="text-muted" />
          <span className="hidden sm:inline">Import</span>
        </button>
        
        <button 
          onClick={() => navigate('/scheduling')}
          className="px-4 py-2 bg-white border border-line hover:bg-canvas text-navy text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Calendar size={16} className="text-muted" />
          <span className="hidden sm:inline">Calendar</span>
        </button>
        
        <button 
          onClick={onExport}
          className="px-4 py-2 bg-white border border-line hover:bg-canvas text-navy text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Download size={16} className="text-muted" />
          <span className="hidden sm:inline">Export</span>
        </button>

        <button 
          onClick={onNewJob}
          className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-brand/20 flex items-center gap-2 hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus size={16} />
          New Job
        </button>
      </div>
    </div>
  );
};
