import { supabase } from '../supabaseClient';

/**
 * A worker is "on" a job in two ways: as its main assignee (jobs.assigned_worker_id)
 * or as one of its crew (a job_crew row). When a crew is added to a job only the
 * first person becomes the main assignee, so screens that checked only that left
 * everyone else without the job. These helpers check both and merge the results.
 */

// The query builder types don't survive being passed around generically.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Refine = (q: any) => any;

const MY_CREW = 'si_my_crew';

/** Jobs the worker is on, with `columns` selected. `refine` adds filters/ordering to both lookups. */
export async function fetchJobsForWorker<T extends { id: string }>(
  workerId: string,
  columns: string,
  refine: Refine = q => q
): Promise<T[]> {
  const [asAssignee, asCrew] = await Promise.all([
    refine(supabase.from('jobs').select(columns).eq('assigned_worker_id', workerId)),
    refine(supabase.from('jobs').select(`${columns}, ${MY_CREW}:job_crew!inner(worker_id)`).eq(`${MY_CREW}.worker_id`, workerId)),
  ]);
  if (asAssignee.error) throw asAssignee.error;
  if (asCrew.error) throw asCrew.error;

  const byId = new Map<string, T>();
  for (const row of [...(asAssignee.data || []), ...(asCrew.data || [])] as Array<T & Record<string, unknown>>) {
    if (byId.has(row.id)) continue;
    const { [MY_CREW]: _drop, ...rest } = row;
    void _drop;
    byId.set(row.id, rest as unknown as T);
  }
  return [...byId.values()];
}

/** How many jobs the worker is on (after `refine` filters). */
export async function countJobsForWorker(workerId: string, refine: Refine = q => q): Promise<number> {
  const rows = await fetchJobsForWorker<{ id: string }>(workerId, 'id', refine);
  return rows.length;
}
