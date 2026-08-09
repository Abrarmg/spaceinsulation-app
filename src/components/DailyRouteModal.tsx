import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, MapPin, ExternalLink, AlertTriangle, Calendar, Navigation, Info, Loader2 } from 'lucide-react';

interface Job {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string;
  customers: {
    full_name: string;
    service_address: string | null;
  } | null;
}

interface DailyRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

export const DailyRouteModal: React.FC<DailyRouteModalProps> = ({
  isOpen,
  onClose,
  initialDate = new Date().toISOString().split('T')[0]
}) => {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(initialDate);
    }
  }, [isOpen, initialDate]);

  // Load jobs scheduled on the selected date
  useEffect(() => {
    if (!isOpen) return;

    const fetchDayJobs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, job_number, status, scheduled_date, customers(full_name, service_address)')
          .eq('scheduled_date', selectedDate)
          .order('job_number', { ascending: true }); // Default sequential ordering

        if (error) throw error;
        setJobs(data as any[] || []);
      } catch (err) {
        console.error('Failed to load daily route jobs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDayJobs();
  }, [selectedDate, isOpen]);

  if (!isOpen) return null;

  // Filter jobs into route destinations and missing addresses
  const validJobs = jobs.filter(j => j.customers?.service_address?.trim());
  const invalidJobs = jobs.filter(j => !j.customers?.service_address?.trim());

  // Generate directions URL
  const generateDirectionsUrl = () => {
    if (validJobs.length === 0) return '#';
    const destinations = validJobs.map(j => encodeURIComponent(j.customers!.service_address!.trim()));
    return `https://www.google.com/maps/dir/${destinations.join('/')}`;
  };

  // Robust date formatting for UI header
  const formatDateHeader = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-brand-charcoal/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-2xl overflow-hidden border border-brand-grey-medium flex flex-col z-10 max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-grey-medium bg-brand-charcoal text-white">
          <div>
            <h2 className="text-base font-bold tracking-tight m-0 text-white">
              Dispatch Route Planner
            </h2>
            <p className="text-[10px] text-brand-grey-dark m-0 mt-0.5">
              Review and build multi-stop direction links for crew trucks.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-brand-grey-dark hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Date Filter & Info Row */}
        <div className="p-4 bg-brand-grey border-b border-brand-grey-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-brand-green" />
            <span className="text-xs font-bold text-brand-charcoal uppercase tracking-wider">
              Route Date:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-brand-grey-dark/60 rounded-md bg-white focus:outline-none focus:border-brand-green"
            />
          </div>

          <div className="text-[10px] text-brand-grey-dark font-semibold">
            {formatDateHeader(selectedDate)}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-brand-grey-dark">
              <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
              <span className="text-xs font-semibold">Generating route stops...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Navigation className="w-12 h-12 text-brand-grey-medium mb-3 stroke-[1.2]" />
              <h4 className="text-sm font-bold text-brand-charcoal m-0">No Jobs Scheduled</h4>
              <p className="text-xs text-brand-grey-dark max-w-xs mt-1">
                There are no insulation projects scheduled for this date.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Stops List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider m-0">
                  Route Stops ({validJobs.length})
                </h3>
                
                <div className="space-y-2 border-l-2 border-brand-green ml-3.5 pl-4">
                  {validJobs.map((job, idx) => (
                    <div 
                      key={job.id} 
                      className="relative bg-brand-grey-light p-3 rounded-lg border border-brand-grey-medium flex items-start justify-between gap-3 group"
                    >
                      {/* Node circle */}
                      <span className="absolute -left-[23px] top-4 w-3.5 h-3.5 bg-brand-green border-2 border-white rounded-full flex items-center justify-center shadow-sm" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-brand-charcoal">
                            Stop {idx + 1}: JOB-{job.job_number}
                          </span>
                          <span className="capitalize px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white border border-brand-grey-dark/20 text-brand-charcoal">
                            {job.status}
                          </span>
                        </div>
                        <div className="text-xs text-brand-charcoal font-medium">
                          Client: <span className="font-bold">{job.customers?.full_name}</span>
                        </div>
                        <div className="text-[10px] text-brand-grey-dark font-semibold flex items-center gap-1">
                          <MapPin size={10} className="text-brand-grey-dark" />
                          <span>{job.customers?.service_address}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exclusion warnings */}
              {invalidJobs.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span>Route Warnings ({invalidJobs.length})</span>
                  </div>
                  <ul className="list-disc list-inside m-0 p-0 text-[10px] leading-relaxed space-y-0.5 pl-1">
                    {invalidJobs.map(job => (
                      <li key={job.id}>
                        <span className="font-bold">JOB-{job.job_number}</span> ({job.customers?.full_name}) is missing a service address.
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Route Optimization Note */}
              <div className="p-3.5 bg-sky-50 border border-sky-200 text-sky-800 rounded-lg flex items-start gap-2.5">
                <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold">Directions Linking (Sequential)</div>
                  <p className="text-[10px] m-0 leading-relaxed text-sky-700">
                    This link loads stops in chronological/sequential order. True route path optimization requires Google Directions API coordinates (waypoint optimization) which can be enabled as a future enhancement.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Link Trigger */}
        <div className="px-6 py-4 border-t border-brand-grey-medium bg-brand-grey flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-brand-grey-dark/60 hover:bg-brand-grey-medium hover:border-brand-grey-dark text-brand-charcoal text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
          
          <a
            href={generateDirectionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (validJobs.length === 0) {
                e.preventDefault();
                alert('No valid stops with service addresses to display on map.');
              }
            }}
            className={`inline-flex items-center gap-1.5 px-5 py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-full shadow-sm hover:shadow transition-all cursor-pointer ${
              validJobs.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <Navigation size={13} className="stroke-[2.5]" />
            <span>Open in Google Maps</span>
            <ExternalLink size={11} />
          </a>
        </div>

      </div>
    </div>
  );
};
