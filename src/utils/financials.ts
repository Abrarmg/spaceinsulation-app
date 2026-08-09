import { supabase } from '../supabaseClient';

export interface LaborWorkerBreakdown {
  workerId: string;
  workerName: string;
  hours: number;
  wage: number;
  cost: number;
  hasIncomplete: boolean;
}

export interface MonthlyFinancials {
  revenue: number;
  expenses: number;
  laborCost: number;
  netProfit: number;
  hasIncompleteEntries: boolean;
  paidInvoices: any[];
  expensesList: any[];
  laborBreakdown: LaborWorkerBreakdown[];
}

/**
 * Calculates all financials (revenue, manual expenses, labor costs, and net profit) for a given month.
 * @param yearMonth Format: "YYYY-MM" (e.g. "2026-07")
 */
export async function calculateMonthlyFinancials(yearMonth: string): Promise<MonthlyFinancials> {
  const [year, month] = yearMonth.split('-');
  const numYear = Number(year);
  const numMonth = Number(month);
  
  // Date ranges in ISO format for timestamps
  const startDateISO = new Date(Date.UTC(numYear, numMonth - 1, 1, 0, 0, 0)).toISOString();
  const lastDay = new Date(numYear, numMonth, 0).getDate();
  const endDateISO = new Date(Date.UTC(numYear, numMonth - 1, lastDay, 23, 59, 59, 999)).toISOString();
  
  // Date ranges for DATE type (expenses table)
  const startDateStr = `${year}-${month}-01`;
  const endDateStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  try {
    // 1. Fetch Paid Invoices for this month
    const { data: paidInvoices, error: revErr } = await supabase
      .from('invoices')
      .select('*, customers(full_name)')
      .eq('status', 'Paid')
      .gte('paid_at', startDateISO)
      .lte('paid_at', endDateISO);

    if (revErr) throw revErr;
    const revenue = (paidInvoices || []).reduce((sum, inv) => sum + Number(inv.total), 0);

    // 2. Fetch Manually Logged Expenses for this month
    const { data: expensesList, error: expErr } = await supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr);

    if (expErr) throw expErr;
    const expenses = (expensesList || []).reduce((sum, exp) => sum + Number(exp.amount), 0);

    // 3. Fetch all workers, wages, and time tracking data for labor cost calculation
    const { data: workers, error: workersErr } = await supabase
      .from('profiles')
      .select('id, full_name, role');
      
    if (workersErr) throw workersErr;

    // Filter to field workers only
    const fieldWorkers = (workers || []).filter(w => w.role === 'field_worker');

    // Fetch wages
    const { data: wages, error: wagesErr } = await supabase
      .from('profile_wages')
      .select('id, hourly_rate');

    if (wagesErr) throw wagesErr;

    const wageMap = new Map<string, number>();
    wages?.forEach(w => wageMap.set(w.id, Number(w.hourly_rate)));

    // Fetch time entries in this month
    const { data: timeEntries, error: timeErr } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in', startDateISO)
      .lte('clock_in', endDateISO);

    if (timeErr) throw timeErr;

    // Fetch breaks for these time entries
    const entryIds = (timeEntries || []).map(te => te.id);
    let timeBreaks: any[] = [];
    if (entryIds.length > 0) {
      const { data: breaksData, error: breakErr } = await supabase
        .from('time_breaks')
        .select('*')
        .in('time_entry_id', entryIds)
        .is('auto_closed', false); // Only subtract standard successfully completed breaks (excluding auto_closed glitches)
      
      if (breakErr) throw breakErr;
      timeBreaks = breaksData || [];
    }

    // Organize calculations by worker
    const laborBreakdown: LaborWorkerBreakdown[] = [];
    let hasIncompleteEntries = false;
    let totalLaborCost = 0;

    fieldWorkers.forEach(worker => {
      const workerEntries = (timeEntries || []).filter(te => te.worker_id === worker.id);
      const wage = wageMap.get(worker.id) || 0;
      
      let workerTotalHours = 0;
      let hasIncomplete = false;

      workerEntries.forEach(entry => {
        if (!entry.clock_out) {
          hasIncomplete = true;
          hasIncompleteEntries = true;
          return; // Exclude incomplete entries from hours sum
        }

        const clockInTime = new Date(entry.clock_in).getTime();
        const clockOutTime = new Date(entry.clock_out).getTime();
        let durationMs = clockOutTime - clockInTime;

        // Subtract break durations
        const entryBreaks = timeBreaks.filter(tb => tb.time_entry_id === entry.id && tb.break_end);
        let breakMs = 0;
        entryBreaks.forEach(b => {
          const start = new Date(b.break_start).getTime();
          const end = new Date(b.break_end).getTime();
          breakMs += (end - start);
        });

        durationMs -= breakMs;
        if (durationMs > 0) {
          workerTotalHours += durationMs / 3600000;
        }
      });

      const cost = Number((workerTotalHours * wage).toFixed(2));
      totalLaborCost += cost;

      laborBreakdown.push({
        workerId: worker.id,
        workerName: worker.full_name,
        hours: Number(workerTotalHours.toFixed(2)),
        wage,
        cost,
        hasIncomplete
      });
    });

    const netProfit = Number((revenue - expenses - totalLaborCost).toFixed(2));

    return {
      revenue,
      expenses,
      laborCost: Number(totalLaborCost.toFixed(2)),
      netProfit,
      hasIncompleteEntries,
      paidInvoices: paidInvoices || [],
      expensesList: expensesList || [],
      laborBreakdown
    };
  } catch (err) {
    console.error('Error in calculateMonthlyFinancials:', err);
    throw err;
  }
}
