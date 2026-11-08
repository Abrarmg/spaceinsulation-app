import React, { useMemo } from 'react';
import { Input } from '../../components/ui';
import { StatStrip } from '../../components/ui/list';
import { Calendar } from 'lucide-react';
import type { TimeEntry, Profile } from './types';

interface PayrollLogsProps {
  timeEntries: TimeEntry[];
  profiles: Profile[];
  loading: boolean;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
}

export const PayrollLogs: React.FC<PayrollLogsProps> = ({
  timeEntries,
  profiles,
  loading,
  startDate,
  endDate,
  onDateChange
}) => {

  const payrollData = useMemo(() => {
    // Group time entries by worker
    const workerStats: Record<string, {
      name: string, 
      rate: number, 
      totalHours: number, 
      regularHours: number, 
      overtimeHours: number,
      grossPay: number
    }> = {};

    timeEntries.forEach(entry => {
      if (!entry.clock_out) return; // skip active shifts
      
      const inTime = new Date(entry.clock_in).getTime();
      const outTime = new Date(entry.clock_out).getTime();
      const hours = (outTime - inTime) / (1000 * 60 * 60);

      const workerId = entry.worker_id;
      
      if (!workerStats[workerId]) {
        const profile = profiles.find(p => p.id === workerId);
        workerStats[workerId] = {
          name: entry.profiles?.full_name || profile?.full_name || 'Unknown',
          rate: profile?.profile_wages?.hourly_rate || 0,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          grossPay: 0
        };
      }

      workerStats[workerId].totalHours += hours;
    });

    let overallTotalHours = 0;
    let overallTotalPay = 0;
    let overallRegHours = 0;
    let overallOTHours = 0;

    const rows = Object.values(workerStats).map(stat => {
      // Very basic OT calc: anything over 80 hours in period is OT (assuming 2 week period). 
      // But standard is 40 per week. For simplicity in this demo, let's just do a 40 hr threshold if date range is ~1 week, or just show total if it's dynamic.
      // We will do a generic calculation: if totalHours > 40, overtime is totalHours - 40.
      
      const isTwoWeeks = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000*60*60*24) > 10;
      const otThreshold = isTwoWeeks ? 80 : 40;

      if (stat.totalHours > otThreshold) {
        stat.regularHours = otThreshold;
        stat.overtimeHours = stat.totalHours - otThreshold;
      } else {
        stat.regularHours = stat.totalHours;
        stat.overtimeHours = 0;
      }

      const regPay = stat.regularHours * stat.rate;
      const otPay = stat.overtimeHours * (stat.rate * 1.5);
      stat.grossPay = regPay + otPay;

      overallTotalHours += stat.totalHours;
      overallRegHours += stat.regularHours;
      overallOTHours += stat.overtimeHours;
      overallTotalPay += stat.grossPay;

      return stat;
    });

    return {
      rows: rows.sort((a,b) => b.totalHours - a.totalHours),
      summary: {
        totalHours: overallTotalHours.toFixed(1),
        totalPay: overallTotalPay.toFixed(2),
        regHours: overallRegHours.toFixed(1),
        otHours: overallOTHours.toFixed(1)
      }
    };
  }, [timeEntries, profiles, startDate, endDate]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-card border border-line p-10 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      
      {/* Pay period */}
      <div className="bg-white rounded-xl p-4 border border-line shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-semibold text-navy">Pay period</h3>
          <p className="m-0 text-xs text-muted">Hours and pay are worked out from clock-ins in this range.</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Input type="date" value={startDate} onChange={e => onDateChange(e.target.value, endDate)} aria-label="Start date" />
          <span className="text-muted text-sm">to</span>
          <Input type="date" value={endDate} onChange={e => onDateChange(startDate, e.target.value)} aria-label="End date" />
        </div>
      </div>

      <StatStrip
        items={[
          { label: 'Total payroll', value: `$${payrollData.summary.totalPay}`, tone: 'green' },
          { label: 'Total hours', value: payrollData.summary.totalHours },
          { label: 'Regular hours', value: payrollData.summary.regHours },
          { label: 'Overtime hours', value: payrollData.summary.otHours, tone: Number(payrollData.summary.otHours) > 0 ? 'amber' : 'default' },
        ]}
      />

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-canvas border-b border-line">
                <th className="py-4 px-6 text-2xs font-bold text-muted uppercase tracking-wide">Employee</th>
                <th className="py-4 px-6 text-2xs font-bold text-muted uppercase tracking-wide text-right">Reg. Hours</th>
                <th className="py-4 px-6 text-2xs font-bold text-muted uppercase tracking-wide text-right">OT Hours</th>
                <th className="py-4 px-6 text-2xs font-bold text-muted uppercase tracking-wide text-right">Rate</th>
                <th className="py-4 px-6 text-2xs font-bold text-muted uppercase tracking-wide text-right">Gross Pay</th>
                <th className="py-4 px-6 text-2xs font-bold text-muted uppercase tracking-wide text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payrollData.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-subtle">
                      <Calendar size={32} className="mb-2 opacity-50" />
                      <p className="text-sm font-semibold">No payroll data found for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payrollData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-canvas transition-colors">
                    <td className="py-4 px-6">
                      <div className="text-sm font-bold text-navy">{row.name}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-sm font-semibold text-navy">{row.regularHours.toFixed(1)}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className={`text-sm font-semibold ${row.overtimeHours > 0 ? 'text-[#D97706]' : 'text-subtle'}`}>
                        {row.overtimeHours.toFixed(1)}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-sm font-semibold text-muted">${row.rate.toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-sm font-bold text-navy">${row.grossPay.toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-mist text-muted border border-line">
                        Pending
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {payrollData.rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-line shadow-card py-12 text-center flex flex-col items-center justify-center text-subtle">
            <Calendar size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-semibold">No payroll data found for this period.</p>
          </div>
        ) : (
          payrollData.rows.map((row, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-line shadow-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between border-b border-mist pb-3">
                <div className="text-sm font-bold text-navy">{row.name}</div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-mist text-muted border border-line">
                  Pending
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <div className="text-2xs font-bold text-subtle uppercase tracking-wider mb-0.5">Reg. Hours</div>
                  <div className="text-sm font-semibold text-navy">{row.regularHours.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-2xs font-bold text-subtle uppercase tracking-wider mb-0.5">OT Hours</div>
                  <div className={`text-sm font-semibold ${row.overtimeHours > 0 ? 'text-[#D97706]' : 'text-subtle'}`}>
                    {row.overtimeHours.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-2xs font-bold text-subtle uppercase tracking-wider mb-0.5">Rate</div>
                  <div className="text-sm font-semibold text-muted">${row.rate.toFixed(2)}/hr</div>
                </div>
                <div>
                  <div className="text-2xs font-bold text-subtle uppercase tracking-wider mb-0.5">Gross Pay</div>
                  <div className="text-sm font-bold text-navy">${row.grossPay.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
    </div>
  );
};
