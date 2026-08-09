import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Loader2, 
  AlertTriangle, 
  DollarSign, 
  Receipt, 
  HardHat, 
  ExternalLink 
} from 'lucide-react';
import { calculateMonthlyFinancials } from '../utils/financials';
import type { MonthlyFinancials } from '../utils/financials';

export const NetProfitBreakdown: React.FC = () => {
  const [financials, setFinancials] = useState<MonthlyFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  // Generate Month Options (Last 24 months)
  const getMonthOptions = () => {
    const options = [];
    const d = new Date();
    for (let i = 0; i < 24; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      options.push({ value: `${year}-${month}`, label });
      d.setMonth(d.getMonth() - 1);
    }
    return options;
  };
  const monthOptions = getMonthOptions();

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await calculateMonthlyFinancials(selectedMonth);
      setFinancials(data);
    } catch (err: any) {
      console.error('Failed to load monthly financials breakdown:', err);
      setError(err.message || 'An error occurred while building the net profit breakdown.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  // Formats date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getMonthLabel = () => {
    const opt = monthOptions.find(o => o.value === selectedMonth);
    return opt ? opt.label : selectedMonth;
  };

  return (
    <div className="flex-grow p-6 md:p-8 space-y-6 overflow-y-auto max-h-screen bg-brand-grey pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-grey-dark hover:text-brand-charcoal transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </Link>
          <h2 className="text-2xl font-black text-brand-charcoal tracking-tight m-0">Net Profit Statement</h2>
          <p className="text-sm text-brand-grey-dark">
            Detailed operating statement breakdown for <span className="font-extrabold text-brand-charcoal">{getMonthLabel()}</span>.
          </p>
        </div>
        
        {/* Month Selector */}
        <div className="space-y-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-brand-grey-dark uppercase block">Select Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-brand-grey-medium rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 cursor-pointer shadow-sm"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-brand-grey-dark">
          <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
          <span className="text-xs font-semibold">Consolidating general ledger statements...</span>
        </div>
      ) : error ? (
        <div className="p-5 bg-white rounded-2xl border border-brand-grey-medium shadow-sm text-center text-red-600 space-y-2">
          <AlertTriangle size={32} className="mx-auto" />
          <h3 className="font-black text-base m-0">Consolidation Failed</h3>
          <p className="text-xs text-brand-grey-dark">{error}</p>
        </div>
      ) : financials ? (
        <div className="space-y-6">
          
          {/* Main Net Profit Formula Card */}
          <div className="bg-brand-charcoal text-white p-6 md:p-8 rounded-2xl shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-green">Operating Net Income</span>
                <h1 className="text-4xl md:text-5xl font-black mt-2 m-0 flex items-center gap-2">
                  <span>${financials.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {financials.hasIncompleteEntries && (
                    <span 
                      title="Warning: Missing worker clock-out entries present for this month. Income calculation might be incomplete." 
                      className="inline-flex p-1 bg-amber-500 text-brand-charcoal rounded-lg cursor-help animate-bounce"
                    >
                      <AlertTriangle size={20} className="stroke-[2.5]" />
                    </span>
                  )}
                </h1>
                <p className="text-xs text-brand-grey-medium mt-2 max-w-xl leading-relaxed">
                  Net Profit represents paid customer invoice revenues minus operating expenses and technician payroll wages.
                </p>
              </div>

              {/* Component breakdown summary */}
              <div className="grid grid-cols-3 gap-4 md:gap-8 bg-white/5 p-4 rounded-xl border border-white/10 shrink-0">
                <div className="text-center">
                  <div className="text-[9px] font-bold text-brand-green uppercase tracking-wider">Revenue</div>
                  <div className="text-sm font-black mt-1 text-white">${financials.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-center border-l border-white/10 pl-4">
                  <div className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Expenses</div>
                  <div className="text-sm font-black mt-1 text-white">${financials.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-center border-l border-white/10 pl-4">
                  <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Labor Cost</div>
                  <div className="text-sm font-black mt-1 text-white">${financials.laborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            </div>

            {/* Incomplete entries warning alert */}
            {financials.hasIncompleteEntries && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-xl text-xs font-semibold flex items-start gap-3">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="m-0 font-bold">Unresolved Worker Time Sheets Detected</p>
                  <p className="m-0 mt-1 font-normal text-amber-300/80">
                    One or more technician time sheets are missing a clock-out timestamp. 
                    These clocked hours are excluded from the labor cost sum, meaning the calculated Net Profit may be higher than actual performance.
                  </p>
                </div>
              </div>
            )}

            {/* Formula visualization */}
            <div className="pt-6 border-t border-white/10 flex flex-wrap items-center gap-3 text-xs md:text-sm font-black tracking-tight select-none">
              <span className="text-brand-green">${financials.revenue.toLocaleString()} (Revenue)</span>
              <span className="text-brand-grey-medium">−</span>
              <span className="text-red-400">${financials.expenses.toLocaleString()} (Expenses)</span>
              <span className="text-brand-grey-medium">−</span>
              <span className="text-amber-400">${financials.laborCost.toLocaleString()} (Labor Cost)</span>
              <span className="text-brand-grey-medium">=</span>
              <span className="text-white bg-white/10 px-2 py-0.5 rounded border border-white/15">
                ${financials.netProfit.toLocaleString()} Net Profit
              </span>
            </div>
          </div>

          {/* Detailed Breakdown Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 1. Paid Revenues Component */}
            <div className="bg-white rounded-2xl border border-brand-grey-medium shadow-sm overflow-hidden flex flex-col justify-between lg:col-span-1">
              <div>
                <div className="p-4 bg-brand-charcoal text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-brand-green" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white m-0">Revenue Details</h3>
                  </div>
                  <span className="text-xs font-black text-brand-green">${financials.revenue.toFixed(2)}</span>
                </div>

                <div className="p-4 space-y-3">
                  {financials.paidInvoices.length === 0 ? (
                    <div className="py-8 text-center text-xs italic text-brand-grey-dark">
                      No invoices marked as PAID this month.
                    </div>
                  ) : (
                    <div className="divide-y divide-brand-grey-light space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {financials.paidInvoices.map((inv) => {
                        const cust = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
                        return (
                          <div key={inv.id} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                            <div>
                              <Link to={`/invoices/${inv.id}`} className="font-extrabold text-brand-charcoal hover:text-brand-green flex items-center gap-1">
                                <span>{inv.invoice_number}</span>
                                <ExternalLink size={10} />
                              </Link>
                              <span className="text-brand-grey-dark block mt-0.5 font-medium">{cust?.full_name || 'Client'}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-brand-charcoal block">${Number(inv.total).toFixed(2)}</span>
                              <span className="text-[9px] text-brand-grey-dark block mt-0.5">
                                Paid {new Date(inv.paid_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Manual Expenses Component */}
            <div className="bg-white rounded-2xl border border-brand-grey-medium shadow-sm overflow-hidden flex flex-col justify-between lg:col-span-1">
              <div>
                <div className="p-4 bg-brand-charcoal text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-brand-green" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white m-0">Operating Expenses</h3>
                  </div>
                  <span className="text-xs font-black text-red-400">${financials.expenses.toFixed(2)}</span>
                </div>

                <div className="p-4 space-y-3">
                  {financials.expensesList.length === 0 ? (
                    <div className="py-8 text-center text-xs italic text-brand-grey-dark">
                      No operating expenses manually logged for this month.
                    </div>
                  ) : (
                    <div className="divide-y divide-brand-grey-light space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {financials.expensesList.map((exp) => (
                        <div key={exp.id} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-brand-charcoal block">{exp.description}</span>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-grey text-brand-charcoal mt-1 border border-brand-grey-medium">
                              {exp.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-brand-charcoal block">${Number(exp.amount).toFixed(2)}</span>
                            <span className="text-[9px] text-brand-grey-dark block mt-0.5">
                              {formatDate(exp.expense_date)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-brand-grey-medium bg-brand-grey/30">
                <Link
                  to="/expenses"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 border border-brand-grey-dark/40 hover:bg-white text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  <Receipt size={13} />
                  <span>Log or Manage Expenses</span>
                </Link>
              </div>
            </div>

            {/* 3. Labor Cost Component */}
            <div className="bg-white rounded-2xl border border-brand-grey-medium shadow-sm overflow-hidden flex flex-col justify-between lg:col-span-1">
              <div>
                <div className="p-4 bg-brand-charcoal text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardHat size={16} className="text-brand-green" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white m-0">Technician Labor Costs</h3>
                  </div>
                  <span className="text-xs font-black text-amber-400">${financials.laborCost.toFixed(2)}</span>
                </div>

                <div className="p-4 space-y-3">
                  {financials.laborBreakdown.length === 0 ? (
                    <div className="py-8 text-center text-xs italic text-brand-grey-dark">
                      No worker hours recorded for this month.
                    </div>
                  ) : (
                    <div className="divide-y divide-brand-grey-light space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {financials.laborBreakdown.map((lab) => (
                        <div key={lab.workerId} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-brand-charcoal block flex items-center gap-1">
                              <span>{lab.workerName}</span>
                              {lab.hasIncomplete && (
                                <span title="Missing clock-out in sheets">
                                  <AlertTriangle size={12} className="text-amber-500" />
                                </span>
                              )}
                            </span>
                            <span className="text-brand-grey-dark block mt-0.5 font-medium">
                              {lab.hours} hours logged @ ${lab.wage.toFixed(2)}/hr
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-brand-charcoal block">${lab.cost.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-brand-grey-medium bg-brand-grey/30">
                <Link
                  to="/employees"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 border border-brand-grey-dark/40 hover:bg-white text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  <HardHat size={13} />
                  <span>Review Employee Payroll</span>
                </Link>
              </div>
            </div>

          </div>

        </div>
      ) : null}

    </div>
  );
};
