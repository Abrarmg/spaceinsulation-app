import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Time on each job (table job_time_entries — see
 * supabase/migrations/20261110120000_job_time_entries.sql). Separate from the
 * day's clock in / clock out. Pausing ends the current entry and resuming
 * starts a new one, so a job's time is the sum of its entries.
 *
 * Until that migration has been applied, every function reports
 * `available: false` and the screens simply hide the timer.
 */

export interface JobTimeEntry {
  id: string;
  job_id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  profiles?: { full_name: string | null } | null;
  jobs?: { id: string; job_number: number; customers?: { full_name: string | null } | null } | null;
}

const TABLE = 'job_time_entries';

const isMissingTable = (err: { code?: string; message?: string } | null) =>
  !!err &&
  (err.code === '42P01' ||
    err.code === 'PGRST205' ||
    (/job_time_entries/.test(err.message || '') && /(does not exist|could not find|schema cache)/i.test(err.message || '')));

/** Time entries for one job — everyone's (office) or one person's (crew). */
export const loadJobTime = async (jobId: string, workerId?: string) => {
  let q = supabase.from(TABLE).select('id, job_id, worker_id, started_at, ended_at, note, profiles:worker_id(full_name)').eq('job_id', jobId);
  if (workerId) q = q.eq('worker_id', workerId);
  const { data, error } = await q.order('started_at', { ascending: true });
  if (isMissingTable(error)) return { available: false, entries: [] as JobTimeEntry[] };
  if (error) throw error;
  return { available: true, entries: (data || []) as unknown as JobTimeEntry[] };
};

/** The job timer this person has running right now, if any. */
export const loadRunningTimer = async (workerId: string) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, job_id, worker_id, started_at, ended_at, note, jobs:job_id(id, job_number, customers(full_name))')
    .eq('worker_id', workerId)
    .is('ended_at', null)
    .limit(1);
  if (isMissingTable(error)) return { available: false, entry: null as JobTimeEntry | null };
  if (error) throw error;
  return { available: true, entry: ((data || [])[0] as unknown as JobTimeEntry) || null };
};

/** Starts timing a job. Any other job timer this person has running is stopped first. */
export const startJobTimer = async (jobId: string, workerId: string) => {
  const now = new Date().toISOString();
  const stop = await supabase.from(TABLE).update({ ended_at: now }).eq('worker_id', workerId).is('ended_at', null);
  if (stop.error && !isMissingTable(stop.error)) throw stop.error;
  const { data, error } = await supabase.from(TABLE).insert([{ job_id: jobId, worker_id: workerId, started_at: now }]).select().limit(1);
  if (error) throw error;
  return ((data || [])[0] as JobTimeEntry) || null;
};

/** Stops (pauses) a running entry. */
export const stopJobTimer = async (entryId: string) => {
  const { error } = await supabase.from(TABLE).update({ ended_at: new Date().toISOString() }).eq('id', entryId).is('ended_at', null);
  if (error) throw error;
};

/** Total milliseconds across entries; a running entry counts up to `now`. */
export const totalMs = (entries: Pick<JobTimeEntry, 'started_at' | 'ended_at'>[], now = Date.now()) =>
  entries.reduce((sum, e) => {
    const start = new Date(e.started_at).getTime();
    const end = e.ended_at ? new Date(e.ended_at).getTime() : now;
    return sum + Math.max(0, end - start);
  }, 0);

/** 3 725 000 ms → "01:02:05". */
export const formatClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

/** 3 725 000 ms → "1h 2m". */
export const formatHours = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
};

/** Re-renders every `ms` while `active`, returning the current time. */
export const useNow = (active: boolean, ms = 1000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
};
