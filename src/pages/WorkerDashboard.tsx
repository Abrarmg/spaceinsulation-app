import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { todayLocal } from '../utils/dates';

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
import { Clock, MapPin, Loader2, CheckCircle2, AlertCircle, Navigation, ShieldCheck, Square, Coffee, Phone, ChevronRight } from 'lucide-react';
import { Button, ButtonLink, Card, EmptyState, Page, StatusBadge } from '../components/ui';
import { DetailGrid, DetailLoading } from '../components/ui/detail';

interface Job {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  start_time?: string | null;
  customers: {
    full_name: string;
    service_address: string;
    phone?: string | null;
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
      // Local calendar dates (not UTC), so evening shifts in Canada don't jump a day.
      const todayStr = todayLocal();

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
        .select('id, job_number, status, scheduled_date, start_time, customers(full_name, service_address, phone)')
        .eq('assigned_worker_id', userId)
        // Jobs are stored at midnight UTC of their calendar day.
        .gte('scheduled_date', `${localKey(startOfWeek)}T00:00:00Z`)
        .lte('scheduled_date', `${localKey(endOfWeek)}T00:00:00Z`);

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
          customers: cust ? {
            full_name: cust.full_name,
            service_address: cust.service_address,
            phone: cust.phone ?? null
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

      // scheduled_date comes back as a timestamp (e.g. 2026-11-08T00:00:00+00:00); compare the date part only.
      const dayOf = (j: Job) => (j.scheduled_date || '').slice(0, 10);
      setTodayJobs(sortJobs(formattedJobs.filter(j => dayOf(j) === todayStr)));
      setWeekJobs(sortJobs(formattedJobs.filter(j => dayOf(j) > todayStr)).sort((a, b) => dayOf(a).localeCompare(dayOf(b))));
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

  const dayParts = (dateStr: string | null) => {
    if (!dateStr) return { weekday: '', day: '' };
    const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
    return { weekday: d.toLocaleDateString(undefined, { weekday: 'short' }), day: String(d.getDate()) };
  };

  const formatTime12h = (time: string | null | undefined) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  if (loading || isJobsLoading) return <DetailLoading label="Loading your day…" />;

  if (authError) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={AlertCircle}
          title={authError}
          action={<Button variant="secondary" onClick={() => navigate('/login/worker')}>Back to sign in</Button>}
        />
      </div>
    );
  }

  const firstName = (profile?.full_name || user?.user_metadata?.full_name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const doneToday = todayJobs.filter(j => j.status === 'Completed').length;
  const doneThisWeek = doneToday + weekJobs.filter(j => j.status === 'Completed').length;
  const mapsUrl = (address?: string | null) => (address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null);

  return (
    <Page>
      <div>
        <h1 className="m-0 text-2xl md:text-[1.75rem] font-bold text-navy tracking-tight leading-tight">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="m-0 mt-1 text-sm text-muted">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
          {todayJobs.length === 0 ? 'no jobs today' : `${todayJobs.length} ${todayJobs.length === 1 ? 'job' : 'jobs'} today`}
        </p>
      </div>

      {/* Time clock */}
      <section
        className={`rounded-2xl border shadow-card p-5 md:p-6 ${
          activeBreakEntry ? 'bg-amber-50 border-amber-200' : activeEntry ? 'bg-brand-soft border-brand/30' : 'bg-white border-line'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span
                className={`w-2.5 h-2.5 rounded-full ${activeBreakEntry ? 'bg-amber-500' : activeEntry ? 'bg-brand animate-pulse' : 'bg-line-strong'}`}
              />
              <span className={activeBreakEntry ? 'text-amber-800' : activeEntry ? 'text-brand-ink' : 'text-muted'}>
                {activeBreakEntry ? 'On a break' : activeEntry ? 'Clocked in' : 'Not clocked in'}
              </span>
            </div>
            <div className="mt-1 text-4xl md:text-5xl font-bold text-navy tracking-tight tabular-nums">
              {activeEntry ? (activeBreakEntry ? breakDuration : shiftDuration) : '00:00:00'}
            </div>
            <div className="mt-1 text-sm text-muted">
              {activeEntry
                ? `Started at ${new Date(activeEntry.clock_in).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${
                    activeBreakEntry ? ' · break running' : ''
                  }`
                : 'Clock in when you arrive at your first job.'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 md:min-w-[280px]">
            {!activeEntry ? (
              <button
                type="button"
                onClick={handleClockInClick}
                disabled={isGeoLoading}
                className="w-full sm:flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-navy text-lg font-semibold border-0 shadow-card disabled:opacity-60"
              >
                {isGeoLoading ? <Loader2 size={22} className="animate-spin" /> : <Clock size={22} />}
                Clock in
              </button>
            ) : (
              <>
                {activeBreakEntry ? (
                  <button
                    type="button"
                    onClick={handleEndBreak}
                    disabled={isBreakLoading}
                    className="w-full sm:flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-lg font-semibold border-0 disabled:opacity-60"
                  >
                    {isBreakLoading ? <Loader2 size={20} className="animate-spin" /> : <Coffee size={20} />}
                    End break
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartBreak}
                    disabled={isBreakLoading}
                    className="w-full sm:flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-mist text-navy text-base font-semibold border border-line disabled:opacity-60"
                  >
                    {isBreakLoading ? <Loader2 size={20} className="animate-spin" /> : <Coffee size={20} />}
                    Take a break
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowClockOutConfirm(true)}
                  disabled={isGeoLoading}
                  className="w-full sm:flex-1 h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-base font-semibold border-0 disabled:opacity-60"
                >
                  {isGeoLoading ? <Loader2 size={20} className="animate-spin" /> : <Square size={18} fill="currentColor" />}
                  Clock out
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <DetailGrid
        main={
          <>
            <section className="space-y-3">
              <h2 className="m-0 text-base font-semibold text-navy">Today's jobs</h2>
              {todayJobs.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={CheckCircle2}
                    title="No jobs today"
                    description={weekJobs.length ? 'Your next jobs are listed below.' : 'Nothing is booked for you this week yet.'}
                    className="py-6"
                  />
                </Card>
              ) : (
                <ul className="m-0 p-0 list-none space-y-3">
                  {todayJobs.map(job => {
                    const directions = mapsUrl(job.customers?.service_address);
                    return (
                      <li key={job.id} className="bg-white border border-line rounded-xl shadow-card overflow-hidden">
                        <Link to={`/jobs/${job.id}`} className="block p-4 no-underline">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-ink-soft">
                              {job.start_time ? formatTime12h(job.start_time) : 'Time not set'}
                            </span>
                            <StatusBadge status={job.status} />
                          </div>
                          <div className="mt-1 text-lg font-semibold text-navy">{job.customers?.full_name || `Job #${job.job_number}`}</div>
                          <div className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
                            <MapPin size={15} className="shrink-0 mt-0.5" />
                            <span>{job.customers?.service_address || 'No address on file'}</span>
                          </div>
                        </Link>
                        <div className="grid grid-cols-3 border-t border-line divide-x divide-line">
                          {directions ? (
                            <a href={directions} target="_blank" rel="noopener noreferrer" className="h-12 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-navy no-underline hover:bg-mist">
                              <Navigation size={16} className="text-brand-ink" /> Directions
                            </a>
                          ) : (
                            <span className="h-12 inline-flex items-center justify-center text-sm text-subtle">No address</span>
                          )}
                          {job.customers?.phone ? (
                            <a href={`tel:${job.customers.phone}`} className="h-12 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-navy no-underline hover:bg-mist">
                              <Phone size={16} className="text-brand-ink" /> Call
                            </a>
                          ) : (
                            <span className="h-12 inline-flex items-center justify-center text-sm text-subtle">No phone</span>
                          )}
                          <Link to={`/jobs/${job.id}`} className="h-12 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-ink no-underline hover:bg-mist">
                            Open <ChevronRight size={16} />
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <Card title="Coming up" description="The rest of this week" padded={false}>
              {weekJobs.length === 0 ? (
                <p className="m-0 px-4 py-5 text-sm text-muted">No other jobs this week.</p>
              ) : (
                <ul className="m-0 p-0 list-none divide-y divide-line">
                  {weekJobs.slice(0, 6).map(job => (
                    <li key={job.id}>
                      <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-canvas">
                        <div className="w-12 shrink-0 text-center rounded-lg border border-line py-1">
                          <div className="text-2xs text-muted leading-none">{dayParts(job.scheduled_date).weekday}</div>
                          <div className="text-base font-bold text-navy leading-tight">{dayParts(job.scheduled_date).day}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-navy truncate">{job.customers?.full_name || `Job #${job.job_number}`}</div>
                          <div className="text-xs text-muted truncate">
                            {job.start_time ? formatTime12h(job.start_time) : 'Time not set'}
                            {job.customers?.service_address ? ` · ${job.customers.service_address}` : ''}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-subtle shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        }
        side={
          <Card title="This week">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-canvas border border-line p-3">
                <div className="text-2xs text-muted">Hours worked</div>
                <div className="text-2xl font-bold text-navy">{weeklyHours}h</div>
              </div>
              <div className="rounded-lg bg-canvas border border-line p-3">
                <div className="text-2xs text-muted">Jobs done</div>
                <div className="text-2xl font-bold text-navy">{doneThisWeek}</div>
              </div>
              <div className="rounded-lg bg-canvas border border-line p-3">
                <div className="text-2xs text-muted">Done today</div>
                <div className="text-2xl font-bold text-navy">
                  {doneToday}
                  <span className="text-sm font-medium text-muted"> / {todayJobs.length}</span>
                </div>
              </div>
              <div className="rounded-lg bg-canvas border border-line p-3">
                <div className="text-2xs text-muted">Open jobs</div>
                <div className="text-2xl font-bold text-navy">{totalAssignedJobs}</div>
              </div>
            </div>
            <ButtonLink to="/jobs" variant="secondary" className="w-full mt-4">
              See all my jobs
            </ButtonLink>
          </Card>
        }
      />

      {/* Clock Out Confirmation Modal */}
      {showClockOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
            onClick={() => setShowClockOutConfirm(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-line shadow-2xl p-6 text-center z-10 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Square size={24} fill="currentColor" />
            </div>
            <h3 className="text-xl font-bold text-navy mb-2">End your shift?</h3>
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
            className="absolute inset-0 bg-navy/65 backdrop-blur-sm"
            onClick={() => setShowConsentModal(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-2xl border border-line shadow-2xl overflow-hidden z-10 flex flex-col">
            <div className="px-5 py-4 bg-white text-navy border-b border-line flex items-center gap-2">
              <Navigation size={18} className="text-brand-ink" />
              <h3 className="text-sm font-bold text-navy m-0">Location Consent Required</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-navy font-medium leading-relaxed m-0">
                To comply with dispatch safety and accurate payroll logging, Space Insulation records your GPS coordinates <strong>only at the exact moments of clock-in and clock-out</strong>.
              </p>
              
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-2xs text-gray-600 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1 font-bold text-navy">
                  <ShieldCheck size={12} className="text-brand-ink" />
                  <span>Privacy Policy Protections:</span>
                </div>
                <div>• Geolocation coordinate points are never logged in background.</div>
                <div>• Location verification is used solely for client proximity checks.</div>
              </div>

              {consentError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-2xs rounded flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <span>{consentError}</span>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptConsent}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-navy text-sm font-semibold rounded-lg transition-all shadow-sm cursor-pointer"
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
            className="absolute inset-0 bg-navy/65 backdrop-blur-sm"
            onClick={() => setShowSummaryModal(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-line shadow-2xl overflow-hidden z-10 flex flex-col animate-in zoom-in duration-200">
            <div className="p-6 bg-navy text-white text-center">
              <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-brand" />
              </div>
              <h3 className="text-xl font-bold text-white m-0 tracking-tight">Shift Completed</h3>
              <p className="text-sm text-gray-400 mt-1 font-medium">Great job today!</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Clock In</span>
                  <span className="font-bold text-navy">
                    {new Date(summaryData.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Clock Out</span>
                  <span className="font-bold text-navy">
                    {new Date(summaryData.clockOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Total Break</span>
                  <span className="font-bold text-amber-600">{summaryData.totalBreakTime}</span>
                </div>
                <div className="flex justify-between text-base pt-1">
                  <span className="text-navy font-bold">Actual Worked</span>
                  <span className="font-bold text-brand text-lg">{summaryData.actualWorkedTime}</span>
                </div>
              </div>

              {summaryData.flagged && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-2xs text-amber-800 leading-normal font-medium">
                    <strong>Flagged:</strong> You had an open break session on clock-out. The system auto-closed it.
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="w-full py-3.5 bg-navy hover:bg-black text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </Page>
  );
};
