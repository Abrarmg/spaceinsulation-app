import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Navigation, 
  ShieldCheck, 
  Briefcase, 
  Timer,
  Square,
  Coffee
} from 'lucide-react';

interface Job {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  customers: {
    full_name: string;
    service_address: string;
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  certification_name: string | null;
  certification_expiry: string | null;
  consent_given_at: string | null;
}

export const WorkerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Time Clock States
  const [activeEntry, setActiveEntry] = useState<any | null>(null);
  const [shiftDuration, setShiftDuration] = useState<string>('00:00:00');
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // Break Tracking States
  const [activeBreakEntry, setActiveBreakEntry] = useState<any | null>(null);
  const [completedBreaks, setCompletedBreaks] = useState<any[]>([]);
  const [breakDuration, setBreakDuration] = useState<string>('00:00:00');
  const [isBreakLoading, setIsBreakLoading] = useState(false);

  // Clock Out Summary Modal States
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState<{ clockIn: string; clockOut: string; totalBreakTime: string; actualWorkedTime: string; flagged: boolean } | null>(null);

  // Jobs States
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [weekJobs, setWeekJobs] = useState<Job[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(true);
  const [totalAssignedJobs, setTotalAssignedJobs] = useState<number>(0);

  // Stats States
  const [weeklyHours, setWeeklyHours] = useState<number>(0);

  // Load user data and verify role
  useEffect(() => {
    let isMounted = true;

    async function initializeDashboard() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (isMounted) navigate('/login/worker');
        return;
      }

      if (isMounted) setUser(session.user);

      // Verify role
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileErr || !profileData) {
        if (isMounted) {
          setAuthError('Failed to verify profile credentials.');
          setLoading(false);
        }
        return;
      }

      if (profileData.role !== 'field_worker' && profileData.role !== 'worker' && profileData.role !== 'office_staff') {
        if (isMounted) {
          // Redirect unknown roles to Admin Dashboard
          navigate('/');
        }
        return;
      }

      if (isMounted) {
        setProfile(profileData);
        setLoading(false);
      }

      // Load time clock, jobs, and weekly stats
      loadTimeClockState(session.user.id);
      loadJobsData(session.user.id);
      loadWeeklyStats(session.user.id);
    }

    initializeDashboard();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Load active shift status
  const loadTimeClockState = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('worker_id', userId)
        .is('clock_out', null)
        .maybeSingle();

      if (!error && data) {
        setActiveEntry(data);
        // Fetch breaks for this entry
        const { data: breaksData } = await supabase
          .from('time_breaks')
          .select('*')
          .eq('time_entry_id', data.id);
        
        if (breaksData) {
          const completed = breaksData.filter(b => b.break_end !== null);
          const active = breaksData.find(b => b.break_end === null);
          setCompletedBreaks(completed);
          if (active) setActiveBreakEntry(active);
        }
      }
    } catch (err) {
      console.error('Failed to load active time entry:', err);
    }
  };

  // Load jobs assigned to this worker (Today vs Rest of Week)
  const loadJobsData = async (userId: string) => {
    setIsJobsLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Calculate start and end of week (Monday to Sunday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0,0,0,0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23,59,59,999);

      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_number, status, scheduled_date, start_time, end_time, customers(full_name, service_address)')
        .eq('assigned_worker_id', userId)
        .gte('scheduled_date', startOfWeek.toISOString().split('T')[0])
        .lte('scheduled_date', endOfWeek.toISOString().split('T')[0]);

      if (error) throw error;

      // Count all incomplete assigned jobs
      const { count: activeCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_worker_id', userId)
        .not('status', 'in', '("Completed","Cancelled")');

      setTotalAssignedJobs(activeCount || 0);

      const formattedJobs = (data || []).map((j: any) => {
        const cust = Array.isArray(j.customers) 
          ? j.customers[0] 
          : j.customers;

        return {
          id: j.id,
          job_number: j.job_number,
          status: j.status,
          scheduled_date: j.scheduled_date,
          start_time: j.start_time,
          end_time: j.end_time,
          customers: cust ? {
            full_name: cust.full_name,
            service_address: cust.service_address
          } : null
        };
      });

      // Filter today's jobs vs upcoming week's jobs
      const sortJobs = (jobsArr: any[]) => {
        return jobsArr.sort((a, b) => {
          if (!a.start_time && !b.start_time) return 0;
          if (!a.start_time) return 1;
          if (!b.start_time) return -1;
          return a.start_time.localeCompare(b.start_time);
        });
      };

      setTodayJobs(sortJobs(formattedJobs.filter(j => j.scheduled_date === todayStr)));
      setWeekJobs(sortJobs(formattedJobs.filter(j => j.scheduled_date !== todayStr)));
    } catch (err) {
      console.error('Failed to load worker jobs:', err);
    } finally {
      setIsJobsLoading(false);
    }
  };

  // Load weekly hours stats
  const loadWeeklyStats = async (userId: string) => {
    try {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0,0,0,0);

      // 1. Fetch time entries
      const { data: entries, error: entriesErr } = await supabase
        .from('time_entries')
        .select('id, clock_in, clock_out')
        .eq('worker_id', userId)
        .gte('clock_in', startOfWeek.toISOString());

      if (entriesErr) throw entriesErr;

      if (!entries || entries.length === 0) {
        setWeeklyHours(0);
        return;
      }

      // 2. Fetch all breaks for these entries
      const entryIds = entries.map(e => e.id);
      const { data: breaks, error: breaksErr } = await supabase
        .from('time_breaks')
        .select('time_entry_id, break_start, break_end')
        .in('time_entry_id', entryIds);

      if (breaksErr) throw breaksErr;

      let totalWorkedMs = 0;
      entries.forEach(entry => {
        const start = new Date(entry.clock_in).getTime();
        const end = entry.clock_out ? new Date(entry.clock_out).getTime() : new Date().getTime();
        let entryMs = end - start;

        // Subtract breaks for this specific entry
        const entryBreaks = breaks?.filter(b => b.time_entry_id === entry.id) || [];
        entryBreaks.forEach(b => {
          const bStart = new Date(b.break_start).getTime();
          const bEnd = b.break_end ? new Date(b.break_end).getTime() : new Date().getTime();
          if (bEnd > bStart) {
            entryMs -= (bEnd - bStart);
          }
        });

        if (entryMs > 0) {
          totalWorkedMs += entryMs;
        }
      });

      const hours = totalWorkedMs / 3600000;
      setWeeklyHours(parseFloat(hours.toFixed(1)));
    } catch (err) {
      console.error('Failed to load weekly hours:', err);
    }
  };

  // Shift and Break timers
  useEffect(() => {
    if (!activeEntry) return;

    const interval = setInterval(() => {
      const clockInMs = new Date(activeEntry.clock_in).getTime();
      const nowMs = new Date().getTime();

      // 1. Calculate total completed breaks ms
      let completedBreaksMs = 0;
      completedBreaks.forEach(b => {
        const start = new Date(b.break_start).getTime();
        const end = new Date(b.break_end).getTime();
        completedBreaksMs += (end - start);
      });

      // 2. Calculate active break ms if currently on break
      let activeBreakMs = 0;
      if (activeBreakEntry) {
        const start = new Date(activeBreakEntry.break_start).getTime();
        activeBreakMs = nowMs - start;
      }

      const totalElapsedMs = nowMs - clockInMs;
      const netWorkedMs = totalElapsedMs - (completedBreaksMs + activeBreakMs);

      // format helpers
      const formatMs = (diffMs: number) => {
        if (diffMs <= 0) return '00:00:00';
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      };

      setShiftDuration(formatMs(netWorkedMs));
      
      if (activeBreakEntry) {
        setBreakDuration(formatMs(activeBreakMs));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeEntry, completedBreaks, activeBreakEntry]);

  // Geolocation trigger resolver
  const getCoordinates = (): Promise<{ lat: number | null; lng: number | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null });
        return;
      }

      setIsGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsGeoLoading(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setIsGeoLoading(false);
          console.warn(`Geolocation failed: ${err.message}`);
          resolve({ lat: null, lng: null });
        },
        { timeout: 8000 }
      );
    });
  };

  const handleClockInClick = () => {
    if (!profile?.consent_given_at) {
      setShowConsentModal(true);
    } else {
      executeClockIn();
    }
  };

  const handleAcceptConsent = async () => {
    if (!user) return;
    setConsentError(null);

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ consent_given_at: now })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev: any) => prev ? { ...prev, consent_given_at: now } : null);
      setShowConsentModal(false);
      await executeClockIn();
    } catch (err: any) {
      setConsentError('Consent failed: ' + err.message);
    }
  };

  const executeClockIn = async () => {
    if (!user) return;
    setIsGeoLoading(true);
    try {
      const coords = await getCoordinates();
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          worker_id: user.id,
          clock_in: new Date().toISOString(),
          clock_in_lat: coords.lat,
          clock_in_lng: coords.lng
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      setActiveEntry(data);
      loadWeeklyStats(user.id);
    } catch (err: any) {
      alert('Clock-in failed: ' + err.message);
    } finally {
      setIsGeoLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!activeEntry) return;
    setIsBreakLoading(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('time_breaks')
        .insert([{
          time_entry_id: activeEntry.id,
          break_start: now
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      setActiveBreakEntry(data);
    } catch (err: any) {
      alert('Start break failed: ' + err.message);
    } finally {
      setIsBreakLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!activeBreakEntry) return;
    setIsBreakLoading(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('time_breaks')
        .update({
          break_end: now
        })
        .eq('id', activeBreakEntry.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      
      setCompletedBreaks((prev) => [...prev, data]);
      setActiveBreakEntry(null);
      setBreakDuration('00:00:00');
    } catch (err: any) {
      alert('End break failed: ' + err.message);
    } finally {
      setIsBreakLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !activeEntry) return;
    setIsGeoLoading(true);
    try {
      const coords = await getCoordinates();
      const clockOutTime = new Date().toISOString();
      let isFlagged = false;

      // 1. If currently on break, auto-close the break
      if (activeBreakEntry) {
        const { error: breakErr } = await supabase
          .from('time_breaks')
          .update({
            break_end: clockOutTime,
            auto_closed: true
          })
          .eq('id', activeBreakEntry.id);

        if (breakErr) throw breakErr;
        isFlagged = true;
      }

      // 2. Clock out of time entry
      const { error: timecardErr } = await supabase
        .from('time_entries')
        .update({
          clock_out: clockOutTime,
          clock_out_lat: coords.lat,
          clock_out_lng: coords.lng,
          flagged_for_review: isFlagged
        })
        .eq('id', activeEntry.id);

      if (timecardErr) throw timecardErr;

      // 3. Calculate final totals for summary display
      const finalCompletedBreaks = [...completedBreaks];
      if (activeBreakEntry) {
        finalCompletedBreaks.push({
          break_start: activeBreakEntry.break_start,
          break_end: clockOutTime
        });
      }

      let totalBreakMs = 0;
      finalCompletedBreaks.forEach(b => {
        totalBreakMs += (new Date(b.break_end).getTime() - new Date(b.break_start).getTime());
      });

      const totalMs = new Date(clockOutTime).getTime() - new Date(activeEntry.clock_in).getTime();
      const workedMs = totalMs - totalBreakMs;

      const formatMs = (diffMs: number) => {
        if (diffMs <= 0) return '00:00:00';
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      };

      setSummaryData({
        clockIn: activeEntry.clock_in,
        clockOut: clockOutTime,
        totalBreakTime: formatMs(totalBreakMs),
        actualWorkedTime: formatMs(workedMs),
        flagged: isFlagged
      });
      setShowSummaryModal(true);

      // Reset shift states
      setActiveEntry(null);
      setActiveBreakEntry(null);
      setCompletedBreaks([]);
      setShiftDuration('00:00:00');
      setBreakDuration('00:00:00');
      loadWeeklyStats(user.id);
    } catch (err: any) {
      alert('Clock-out failed: ' + err.message);
    } finally {
      setIsGeoLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime12h = (time: string | null | undefined) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  if (loading || isJobsLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-3 text-brand-grey-dark">
        <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
        <span className="text-sm font-semibold">Loading crew dashboard...</span>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-screen text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-brand-charcoal">{authError}</h2>
        <button
          onClick={() => navigate('/login/worker')}
          className="mt-6 bg-brand-charcoal text-white px-5 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition-colors cursor-pointer text-sm"
        >
          Return to Login
        </button>
      </div>
    );
  }


  return (
    <div className="flex-grow p-4 md:p-8 space-y-8 overflow-y-auto max-h-screen bg-[#F8FAFC] pb-24">
      
      {/* Page Title Header */}
      <div>
        <h2 className="text-3xl font-black text-[#151A2D] tracking-tight m-0">Crew Dashboard</h2>
        <p className="text-sm text-[#A7AFBD] font-medium mt-1">
          Manage your jobs, track your time, and stay on top of today's work.
        </p>
      </div>

      {/* Hero Time Clock */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#E2E8F0] p-6 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-[#76C442]/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center justify-center w-full z-10">
          <div className="mb-6 text-center">
            {activeEntry ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Working now
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-gray-200">
                Ready to start your shift
              </span>
            )}
          </div>

          {!activeEntry ? (
            <button
              onClick={handleClockInClick}
              disabled={isGeoLoading}
              className="w-48 h-48 md:w-56 md:h-56 rounded-full bg-[#76C442] hover:bg-[#689F38] shadow-[0_0_20px_rgba(118,196,66,0.3)] hover:shadow-[0_0_40px_rgba(118,196,66,0.5)] transition-premium flex flex-col items-center justify-center text-white cursor-pointer group disabled:opacity-50 disabled:scale-95 border-4 border-white hover:scale-105 active:scale-95 clock-pulse"
            >
              {isGeoLoading ? (
                <Loader2 size={40} className="animate-spin mb-2" />
              ) : (
                <Clock size={48} className="mb-3 transition-transform duration-300 ease-out group-hover:scale-110" />
              )}
              <span className="text-2xl font-black tracking-widest uppercase">Clock In</span>
              <span className="text-xs font-bold text-white/80 mt-1 uppercase tracking-wider">Start workday</span>
            </button>
          ) : (
            <div className="flex flex-col items-center">
              <button
                onClick={() => setShowClockOutConfirm(true)}
                disabled={isGeoLoading}
                className={`w-48 h-48 md:w-56 md:h-56 rounded-full ${activeBreakEntry ? 'bg-amber-500 hover:bg-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'bg-red-500 hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.3)]'} transition-premium hover:scale-105 active:scale-95 flex flex-col items-center justify-center text-white cursor-pointer group disabled:opacity-50 border-4 border-white ring-4 ring-offset-4 ring-offset-white ${activeBreakEntry ? 'ring-amber-500/20' : 'ring-red-500/20'}`}
              >
                {isGeoLoading ? (
                  <Loader2 size={40} className="animate-spin mb-2" />
                ) : (
                  <Square size={40} fill="currentColor" className="mb-3 transition-transform duration-300 ease-out group-hover:scale-110" />
                )}
                <span className="text-2xl font-black tracking-widest uppercase">
                  {activeBreakEntry ? 'End Break' : 'Clock Out'}
                </span>
                <span className="text-xs font-bold text-white/80 mt-1 uppercase tracking-wider">
                  {activeBreakEntry ? 'Resume Work' : 'End Shift'}
                </span>
              </button>
              
              <div className="mt-8 flex flex-col items-center">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Elapsed Time</div>
                <div className="text-4xl md:text-5xl font-black text-[#151A2D] tracking-tight font-mono">
                  {activeBreakEntry ? breakDuration : shiftDuration}
                </div>
                <div className="text-xs font-semibold text-gray-500 mt-2">
                  Started at {new Date(activeEntry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {!activeBreakEntry && (
                <button
                  onClick={handleStartBreak}
                  disabled={isBreakLoading}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-full transition-colors cursor-pointer border border-blue-200"
                >
                  {isBreakLoading ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />}
                  Take a Break
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Today's Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Timer size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Hours Worked</div>
            <div className="text-lg font-black text-[#151A2D]">{activeEntry ? shiftDuration.substring(0, 5) : '0h 00m'}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Briefcase size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Jobs Assigned</div>
            <div className="text-lg font-black text-[#151A2D]">{todayJobs.length}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Jobs Completed</div>
            <div className="text-lg font-black text-[#151A2D]">{todayJobs.filter(j => j.status === 'Completed').length}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Coffee size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Break Time</div>
            <div className="text-lg font-black text-[#151A2D]">{breakDuration !== '00:00:00' ? breakDuration.substring(0, 5) : '0m'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column (Main Content) */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Today's Jobs */}
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black text-[#151A2D]">Today's Jobs</h3>
              <p className="text-xs text-gray-500 font-medium">Your assigned work for today</p>
            </div>

            {todayJobs.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-[#E2E8F0] shadow-sm text-center">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h4 className="text-xl font-bold text-[#151A2D] mb-2">You're all caught up!</h4>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                  No jobs are scheduled for you today. Take a breather or check your upcoming schedule.
                </p>
                {weekJobs.length > 0 && (
                  <button className="inline-flex items-center gap-2 text-sm font-bold text-[#76C442] hover:text-[#65b035] transition-colors">
                    View Upcoming Jobs &rarr;
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {todayJobs.map(job => (
                  <div key={job.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-[10px] font-bold uppercase tracking-widest">
                          JOB-{job.job_number}
                        </div>
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          job.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          job.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      
                      <h4 className="text-lg font-black text-[#151A2D] mb-1">
                        {job.customers?.full_name || 'Anonymous client'}
                      </h4>
                      
                      <div className="flex flex-col gap-2 mt-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin size={16} className="text-gray-400" />
                          <span>{job.customers?.service_address || 'No address provided'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar size={16} className="text-gray-400" />
                          <span>
                            {formatDate(job.scheduled_date)}
                            {job.start_time && job.end_time ? ` • ${formatTime12h(job.start_time)} – ${formatTime12h(job.end_time)}` : ' • Time not set'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-5 py-3 bg-gray-50 border-t border-[#E2E8F0] flex justify-end">
                      <Link 
                        to={`/jobs/${job.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-[#76C442] hover:text-[#76C442] text-sm font-bold text-gray-700 rounded-lg transition-colors cursor-pointer"
                      >
                        View Job &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Jobs */}
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black text-[#151A2D]">Upcoming Jobs</h3>
              <p className="text-xs text-gray-500 font-medium">Your schedule for the rest of the week</p>
            </div>

            {weekJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm text-center">
                <p className="text-sm text-gray-500 font-medium">No upcoming jobs this week.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-gray-100">
                {weekJobs.slice(0, 5).map((job, idx) => (
                  <div key={job.id} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${idx === 0 ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{formatDate(job.scheduled_date).split(' ')[0]}</span>
                        <span className="text-sm font-black text-[#151A2D]">{formatDate(job.scheduled_date).split(' ')[1]}</span>
                      </div>
                      <div>
                        <div className="text-sm font-black text-[#151A2D] mb-0.5">{job.customers?.full_name}</div>
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mb-0.5">
                          <MapPin size={12} />
                          <span className="line-clamp-1 max-w-[150px] sm:max-w-[200px]">{job.customers?.service_address}</span>
                        </div>
                        <div className="text-xs text-gray-500 font-bold">
                          {job.start_time && job.end_time ? `${formatTime12h(job.start_time)} – ${formatTime12h(job.end_time)}` : 'Time not set'}
                        </div>
                      </div>
                    </div>
                    <Link 
                      to={`/jobs/${job.id}`}
                      className="p-2 text-gray-400 hover:text-[#76C442] hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Right Column (Widgets) */}
        <div className="space-y-6">
          
          {/* Weekly Summary */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">This Week</h3>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-black text-[#151A2D] leading-none">{weeklyHours}h 00m</span>
              <span className="text-xs font-bold text-gray-400 mb-1">Worked</span>
            </div>
            
            {/* Minimalist Bar Chart Representation */}
            <div className="flex items-end justify-between h-24 gap-1 border-b border-gray-100 pb-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div 
                    className={`w-full max-w-[24px] rounded-t-sm ${i < new Date().getDay() ? 'bg-[#76C442]' : 'bg-gray-100'}`} 
                    style={{ height: `${Math.max(10, Math.random() * 80)}%` }}
                  ></div>
                  <span className="text-[10px] font-bold text-gray-400">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* My Progress */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">My Progress</h3>
            
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-[#151A2D]">Completion Rate</span>
                  <span className="text-[#76C442]">85%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#76C442] w-[85%] rounded-full"></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-2xl font-black text-[#151A2D] mb-1">
                    {todayJobs.filter(j => j.status === 'Completed').length + weekJobs.filter(j => j.status === 'Completed').length}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Done This Week</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-2xl font-black text-[#151A2D] mb-1">
                    {totalAssignedJobs}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">In Progress</div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Assignments */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Assignments</h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                {totalAssignedJobs} Active
              </span>
            </div>
            
            <div className="space-y-3 mb-4">
              {todayJobs.slice(0, 2).map(job => (
                <div key={job.id} className="flex flex-col gap-1 text-sm border-l-2 border-blue-500 pl-3">
                  <span className="font-bold text-[#151A2D]">{job.customers?.full_name}</span>
                  <span className="text-xs text-gray-500">{job.customers?.service_address}</span>
                </div>
              ))}
              {todayJobs.length === 0 && <span className="text-xs text-gray-500">No active assignments today.</span>}
            </div>

            <Link to="/jobs" className="block text-center text-xs font-bold text-[#76C442] hover:text-[#65b035] transition-colors">
              View All Jobs &rarr;
            </Link>
          </div>

        </div>
      </div>

      {/* Clock Out Confirmation Modal */}
      {showClockOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-sm"
            onClick={() => setShowClockOutConfirm(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-[#E2E8F0] shadow-2xl p-6 text-center z-10 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Square size={24} fill="currentColor" />
            </div>
            <h3 className="text-xl font-black text-[#151A2D] mb-2">End your shift?</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              You've worked {shiftDuration.substring(0, 5)} today. Are you sure you want to clock out?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowClockOutConfirm(false);
                  if (activeBreakEntry) handleEndBreak();
                  else handleClockOut();
                }}
                disabled={isGeoLoading}
                className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isGeoLoading && <Loader2 size={16} className="animate-spin" />}
                Yes, Clock Out
              </button>
              <button
                onClick={() => setShowClockOutConfirm(false)}
                className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geolocation Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/65 backdrop-blur-sm"
            onClick={() => setShowConsentModal(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-2xl border border-[#E2E8F0] shadow-2xl overflow-hidden z-10 flex flex-col">
            <div className="p-4 bg-[#151A2D] text-white flex items-center gap-2">
              <Navigation size={18} className="text-[#76C442]" />
              <h3 className="text-sm font-bold text-white m-0">Location Consent Required</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-[#151A2D] font-medium leading-relaxed m-0">
                To comply with dispatch safety and accurate payroll logging, Space Insulation records your GPS coordinates <strong>only at the exact moments of clock-in and clock-out</strong>.
              </p>
              
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-[10px] text-gray-600 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1 font-bold text-[#151A2D]">
                  <ShieldCheck size={12} className="text-[#76C442]" />
                  <span>Privacy Policy Protections:</span>
                </div>
                <div>• Geolocation coordinate points are never logged in background.</div>
                <div>• Location verification is used solely for client proximity checks.</div>
              </div>

              {consentError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[10px] rounded flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <span>{consentError}</span>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptConsent}
                className="px-4 py-2 bg-[#76C442] hover:bg-[#65b035] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Accept & Clock In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Modal */}
      {showSummaryModal && summaryData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/65 backdrop-blur-sm"
            onClick={() => setShowSummaryModal(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-[#E2E8F0] shadow-2xl overflow-hidden z-10 flex flex-col animate-in zoom-in duration-200">
            <div className="p-6 bg-[#151A2D] text-white text-center">
              <div className="w-16 h-16 bg-[#76C442]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-[#76C442]" />
              </div>
              <h3 className="text-xl font-black text-white m-0 tracking-tight">Shift Completed</h3>
              <p className="text-sm text-gray-400 mt-1 font-medium">Great job today!</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Clock In</span>
                  <span className="font-black text-[#151A2D]">
                    {new Date(summaryData.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Clock Out</span>
                  <span className="font-black text-[#151A2D]">
                    {new Date(summaryData.clockOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Total Break</span>
                  <span className="font-black text-amber-600">{summaryData.totalBreakTime}</span>
                </div>
                <div className="flex justify-between text-base pt-1">
                  <span className="text-[#151A2D] font-black">Actual Worked</span>
                  <span className="font-black text-[#76C442] text-lg">{summaryData.actualWorkedTime}</span>
                </div>
              </div>

              {summaryData.flagged && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-amber-800 leading-normal font-medium">
                    <strong>Flagged:</strong> You had an open break session on clock-out. The system auto-closed it.
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="w-full py-3.5 bg-[#151A2D] hover:bg-black text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

};
