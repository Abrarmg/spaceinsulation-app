import React, { useMemo } from 'react';
import { Clock, DollarSign, Calculator, Calendar } from 'lucide-react';
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
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-10 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CC242]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Date Controls */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider">Pay Period</h3>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => onDateChange(e.target.value, endDate)}
            className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-semibold focus:outline-none"
          />
          <span className="text-[#94A3B8] text-sm font-bold">TO</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => onDateChange(startDate, e.target.value)}
            className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-semibold focus:outline-none"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151A2D] rounded-2xl p-5 border border-[#1E2541] shadow-md flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-white">
            <DollarSign size={20} />
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Total Payroll</h3>
            <div className="text-2xl font-black text-white leading-none">${payrollData.summary.totalPay}</div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#64748B]">
            <Clock size={20} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-[#64748B] uppercase tracking-wider mb-1">Total Hours</h3>
            <div className="text-2xl font-black text-[#151A2D] leading-none">{payrollData.summary.totalHours}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center shrink-0 text-[#15803D]">
            <Calculator size={20} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-[#64748B] uppercase tracking-wider mb-1">Regular Hours</h3>
            <div className="text-2xl font-black text-[#151A2D] leading-none">{payrollData.summary.regHours}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center shrink-0 text-[#D97706]">
            <Calculator size={20} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-[#64748B] uppercase tracking-wider mb-1">Overtime Hours</h3>
            <div className="text-2xl font-black text-[#151A2D] leading-none">{payrollData.summary.otHours}</div>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="py-4 px-6 text-[10px] font-black text-[#64748B] uppercase tracking-widest">Employee</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#64748B] uppercase tracking-widest text-right">Reg. Hours</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#64748B] uppercase tracking-widest text-right">OT Hours</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#64748B] uppercase tracking-widest text-right">Rate</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#64748B] uppercase tracking-widest text-right">Gross Pay</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#64748B] uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {payrollData.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-[#94A3B8]">
                      <Calendar size={32} className="mb-2 opacity-50" />
                      <p className="text-sm font-semibold">No payroll data found for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payrollData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 px-6">
                      <div className="text-sm font-black text-[#151A2D]">{row.name}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-sm font-semibold text-[#151A2D]">{row.regularHours.toFixed(1)}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className={`text-sm font-semibold ${row.overtimeHours > 0 ? 'text-[#D97706]' : 'text-[#94A3B8]'}`}>
                        {row.overtimeHours.toFixed(1)}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-sm font-semibold text-[#64748B]">${row.rate.toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-sm font-black text-[#151A2D]">${row.grossPay.toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
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
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm py-12 text-center flex flex-col items-center justify-center text-[#94A3B8]">
            <Calendar size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-semibold">No payroll data found for this period.</p>
          </div>
        ) : (
          payrollData.rows.map((row, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between border-b border-[#F1F5F9] pb-3">
                <div className="text-sm font-black text-[#151A2D]">{row.name}</div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                  Pending
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Reg. Hours</div>
                  <div className="text-sm font-semibold text-[#151A2D]">{row.regularHours.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">OT Hours</div>
                  <div className={`text-sm font-semibold ${row.overtimeHours > 0 ? 'text-[#D97706]' : 'text-[#94A3B8]'}`}>
                    {row.overtimeHours.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Rate</div>
                  <div className="text-sm font-semibold text-[#64748B]">${row.rate.toFixed(2)}/hr</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Gross Pay</div>
                  <div className="text-sm font-black text-[#151A2D]">${row.grossPay.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
    </div>
  );
};
