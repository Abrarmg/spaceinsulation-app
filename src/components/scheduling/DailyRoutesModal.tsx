import React, { useState } from 'react';
import { Check, Copy, Mail, MapPin, MessageSquare, Navigation, Route, User, X } from 'lucide-react';
import { COMPANY_DETAILS } from '../../config/constants';
import { Job, Profile } from './types';
import { formatJobTimeRange, getJobCrewMembers, parseJobDateStr, toDateKey, toMinutes } from './schedulingUtils';

interface DailyRoutesModalProps {
  date: Date;
  jobs: Job[];
  workers: Profile[];
  onClose: () => void;
}

interface WorkerRoute {
  key: string;
  name: string;
  worker?: Profile;
  stops: Job[];
}

// Google Maps directions URL: starts at the office, visits stops in order. Supports up to 9 waypoints.
const mapsLink = (stops: Job[]) => {
  const addresses = stops.map(s => s.customers?.service_address).filter((a): a is string => !!a);
  if (addresses.length === 0) return null;
  const params = new URLSearchParams({
    api: '1',
    origin: COMPANY_DETAILS.address,
    destination: addresses[addresses.length - 1],
    travelmode: 'driving',
  });
  if (addresses.length > 1) params.set('waypoints', addresses.slice(0, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const routeMessage = (route: WorkerRoute, dateLabel: string, link: string | null) => {
  const lines = route.stops.map((job, i) => {
    const time = job.start_time ? formatJobTimeRange(job) : 'Time TBD';
    return `${i + 1}. ${time} · ${job.customers?.full_name || `JOB-${job.job_number}`} · ${job.customers?.service_address || 'No address'}`;
  });
  return [`Hi ${route.name.split(' ')[0]}, your stops for ${dateLabel}:`, ...lines, link ? `Route: ${link}` : ''].filter(Boolean).join('\n');
};

export const DailyRoutesModal: React.FC<DailyRoutesModalProps> = ({ date, jobs, workers, onClose }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const dateKey = toDateKey(date);
  const dateLabel = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // Timed stops first in time order, then untimed ones.
  const dayJobs = jobs
    .filter(j => parseJobDateStr(j.scheduled_date) === dateKey)
    .sort((a, b) => (toMinutes(a.start_time) ?? 24 * 60) - (toMinutes(b.start_time) ?? 24 * 60));

  const routes = new Map<string, WorkerRoute>();
  for (const job of dayJobs) {
    const crew = getJobCrewMembers(job);
    const members: { id: string; name: string }[] = crew.length ? crew : [{ id: 'unassigned', name: 'Unassigned' }];
    for (const m of members) {
      const key = m.id || m.name;
      if (!routes.has(key)) routes.set(key, { key, name: m.name, worker: workers.find(w => w.id === m.id), stops: [] });
      const route = routes.get(key)!;
      if (!route.stops.some(s => s.id === job.id)) route.stops.push(job);
    }
  }

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 2000);
    } catch {
      // Clipboard can be blocked; the Text/Email buttons still work.
    }
  };

  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10.5px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-[#151A2D]/60" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 py-4 bg-[#151A2D] text-white">
          <div className="flex items-center gap-2">
            <Route className="text-[#76C442] w-5 h-5" />
            <div>
              <div className="text-[9px] uppercase tracking-wider font-extrabold text-[#94A3B8]">Routes</div>
              <h3 className="text-base font-black m-0">{dateLabel}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#94A3B8] hover:text-white cursor-pointer" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {dayJobs.length === 0 ? (
            <p className="text-center py-10 text-slate-400 font-bold m-0">No jobs scheduled on this day.</p>
          ) : (
            [...routes.values()].map(route => {
              const link = mapsLink(route.stops);
              const message = routeMessage(route, dateLabel, link);
              const phone = route.worker?.phone;
              const email = route.worker?.email;
              return (
                <div key={route.key} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-black text-[#151A2D]">
                      <User size={13} className="text-[#76C442]" />
                      {route.name}
                      <span className="text-slate-400 font-semibold">· {route.stops.length} stop{route.stops.length === 1 ? '' : 's'}</span>
                    </div>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-[#16A34A] font-extrabold hover:underline">
                        <Navigation size={11} /> Open route
                      </a>
                    )}
                  </div>

                  <ol className="space-y-2 m-0 pl-0 list-none">
                    {route.stops.map((job, i) => (
                      <li key={job.id} className="flex gap-2.5">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-[#76C442]/15 text-[#151A2D] text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="font-extrabold text-[11px]">
                            {job.start_time ? formatJobTimeRange(job) : 'Time TBD'} · {job.customers?.full_name || `JOB-${job.job_number}`}
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customers?.service_address || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-slate-500 hover:text-[#16A34A] flex items-center gap-1"
                          >
                            <MapPin size={10} /> {job.customers?.service_address || 'No service address'}
                          </a>
                        </div>
                      </li>
                    ))}
                  </ol>

                  {route.key !== 'unassigned' && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                      {phone && (
                        <a className={btn} href={`sms:${phone}?&body=${encodeURIComponent(message)}`}>
                          <MessageSquare size={12} /> Text route
                        </a>
                      )}
                      {email && (
                        <a className={btn} href={`mailto:${email}?subject=${encodeURIComponent(`Your stops for ${dateLabel}`)}&body=${encodeURIComponent(message)}`}>
                          <Mail size={12} /> Email route
                        </a>
                      )}
                      <button type="button" className={btn} onClick={() => copy(route.key, message)}>
                        {copied === route.key ? <Check size={12} className="text-[#16A34A]" /> : <Copy size={12} />}
                        {copied === route.key ? 'Copied' : 'Copy route'}
                      </button>
                      {!phone && !email && <span className="text-[10px] text-slate-400 self-center">Add a phone or email to this worker's profile to send it directly.</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {dayJobs.length > 0 && (
            <p className="text-[10px] text-slate-400 m-0">
              Stops are ordered by start time and routed from the office. Google Maps keeps this order; it doesn't reorder stops for the shortest drive.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
