import React from 'react';
import { Link } from 'react-router-dom';
import { Edit2, Eye, MapPin, Calendar, Users, AlertCircle } from 'lucide-react';
import type { Job } from './types';

interface JobsDataGridProps {
  jobs: Job[];
  loading: boolean;
  onEdit: (job: Job) => void;
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Quoted': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Scheduled': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'In Progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Invoiced': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'Paid': return 'bg-green-100 text-green-700 border-green-200';
    case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getProgress = (status: string) => {
  switch (status) {
    case 'Quoted': return 10;
    case 'Scheduled': return 30;
    case 'In Progress': return 60;
    case 'Completed': return 100;
    case 'Invoiced': return 100;
    case 'Paid': return 100;
    case 'Cancelled': return 0;
    default: return 0;
  }
};

export const JobsDataGrid: React.FC<JobsDataGridProps> = ({ jobs, loading, onEdit }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-10 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CC242]"></div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-16 text-center">
        <div className="w-16 h-16 bg-[#F1F5F9] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="text-[#94A3B8]" size={32} />
        </div>
        <h3 className="text-lg font-black text-[#151A2D] mb-1">No Jobs Found</h3>
        <p className="text-sm font-medium text-[#64748B]">Try adjusting your filters or search query.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="px-3 md:px-5 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest whitespace-nowrap">Job & Customer</th>
              <th className="hidden md:table-cell px-5 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest whitespace-nowrap">Location</th>
              <th className="hidden lg:table-cell px-5 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest whitespace-nowrap">Schedule & Crew</th>
              <th className="px-3 md:px-5 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest whitespace-nowrap">Status</th>
              <th className="hidden sm:table-cell px-5 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest whitespace-nowrap text-right">Value</th>
              <th className="px-3 md:px-5 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest whitespace-nowrap text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-[#F8FAFC] transition-colors group">
                {/* Customer / Job Info */}
                <td className="px-3 md:px-5 py-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="hidden sm:flex w-10 h-10 rounded-full bg-gradient-to-br from-[#7CC242] to-[#151A2D] text-white items-center justify-center text-xs font-bold shadow-sm shrink-0">
                      {getInitials(job.customers?.full_name || 'U K')}
                    </div>
                    <div>
                      <Link to={`/jobs/${job.id}`} className="text-sm font-bold text-[#151A2D] hover:text-[#7CC242] transition-colors line-clamp-1">
                        {job.customers?.full_name || 'Unknown Customer'}
                      </Link>
                      <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mt-0.5">
                        JOB-{job.job_number}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Location */}
                <td className="hidden md:table-cell px-5 py-4">
                  <div className="flex items-start gap-2 max-w-[200px]">
                    <MapPin size={14} className="text-[#94A3B8] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-[#151A2D] line-clamp-1">{job.customers?.service_address?.split(',')[0] || 'No Address'}</div>
                      <div className="text-[10px] font-semibold text-[#94A3B8] mt-0.5 line-clamp-1">{job.customers?.service_address?.split(',').slice(1).join(',')}</div>
                    </div>
                  </div>
                </td>

                {/* Schedule & Crew */}
                <td className="hidden lg:table-cell px-5 py-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#151A2D]">
                      <Calendar size={14} className="text-[#94A3B8]" />
                      {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'Unscheduled'}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#64748B]">
                      <Users size={14} className="text-[#94A3B8]" />
                      {job.profiles?.full_name ? (
                        <span className="truncate max-w-[120px] inline-block">{job.profiles.full_name}</span>
                      ) : (
                        <span className="italic text-[#94A3B8]">Unassigned</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Status & Progress */}
                <td className="px-3 md:px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                  <div className="hidden sm:block w-24 h-1.5 bg-[#F1F5F9] rounded-full mt-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#7CC242] to-[#65a333] transition-all duration-500 ease-out"
                      style={{ width: `${getProgress(job.status)}%` }}
                    />
                  </div>
                </td>

                {/* Value */}
                <td className="hidden sm:table-cell px-5 py-4 text-right">
                  <div className="text-sm font-black text-[#151A2D]">
                    ${(job.quoted_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(job)}
                      className="p-1.5 text-[#64748B] hover:text-[#151A2D] hover:bg-[#E2E8F0] rounded-lg transition-colors"
                      title="Quick Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <Link 
                      to={`/jobs/${job.id}`}
                      className="p-1.5 text-[#7CC242] hover:text-white hover:bg-[#7CC242] rounded-lg transition-colors shadow-sm"
                      title="Open Workspace"
                    >
                      <Eye size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
