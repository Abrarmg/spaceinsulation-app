import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, DollarSign, HardHat, Receipt } from 'lucide-react';
import { ButtonLink, Card, EmptyState, Page, PageHeader, Select } from '../components/ui';
import { BackLink, DetailLoading } from '../components/ui/detail';
import { calculateMonthlyFinancials } from '../utils/financials';
import type { MonthlyFinancials } from '../utils/financials';
import { todayDate } from '../utils/dates';

export const NetProfitBreakdown: React.FC = () => {
  const [financials, setFinancials] = useState<MonthlyFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = todayDate();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  // Generate Month Options (Last 24 months)
  const getMonthOptions = () => {
    const options = [];
    const d = todayDate();
    d.setDate(1);
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
    return new Date(dateStr.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getMonthLabel = () => {
    const opt = monthOptions.find(o => o.value === selectedMonth);
    return opt ? opt.label : selectedMonth;
  };

  const money = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const paidDate = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Page>
      <BackLink to="/" label="Dashboard" />
      <PageHeader
        title="Net profit"
        subtitle={`Paid invoices minus expenses and crew wages for ${getMonthLabel()}.`}
        actions={
          <Select
            aria-label="Month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="sm:w-52"
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        }
      />

      {loading ? (
        <DetailLoading label="Adding up the month…" />
      ) : error ? (
        <Card>
          <EmptyState icon={AlertTriangle} title="Couldn't load the numbers" description={error} />
        </Card>
      ) : financials ? (
        <>
          {/* Summary */}
          <section className="bg-white border border-line rounded-2xl shadow-card p-5 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <div className="text-sm font-medium text-muted">Net profit</div>
                <div className={`mt-1 text-4xl md:text-5xl font-bold tracking-tight tabular-nums ${financials.netProfit < 0 ? 'text-red-600' : 'text-navy'}`}>
                  {money(financials.netProfit)}
                </div>
                <p className="m-0 mt-2 text-sm text-muted tabular-nums">
                  {money(financials.revenue)} revenue − {money(financials.expenses)} expenses − {money(financials.laborCost)} labour
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 lg:min-w-[440px]">
                {[
                  { label: 'Revenue', value: financials.revenue, dot: 'bg-brand' },
                  { label: 'Expenses', value: financials.expenses, dot: 'bg-red-500' },
                  { label: 'Labour', value: financials.laborCost, dot: 'bg-amber-500' },
                ].map(t => (
                  <div key={t.label} className="rounded-xl bg-canvas border border-line p-3">
                    <div className="flex items-center gap-1.5 text-2xs font-medium text-muted">
                      <span className={`w-2 h-2 rounded-full ${t.dot}`} /> {t.label}
                    </div>
                    <div className="mt-1 text-base md:text-lg font-bold text-navy tabular-nums truncate">
                      ${Math.round(t.value).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {financials.hasIncompleteEntries && (
              <div className="mt-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <div className="font-semibold">Some timesheets are missing a clock-out</div>
                  <div className="mt-0.5 text-amber-800">
                    Those hours aren't counted in labour yet, so the real profit may be lower than shown.
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
            {/* Revenue */}
            <Card
              title={<span className="flex items-center gap-2"><DollarSign size={16} className="text-brand-ink" /> Revenue</span>}
              actions={<span className="text-sm font-semibold text-navy tabular-nums">{money(financials.revenue)}</span>}
              padded={false}
            >
              {financials.paidInvoices.length === 0 ? (
                <p className="m-0 px-4 py-6 text-sm text-muted text-center">No invoices were paid this month.</p>
              ) : (
                <ul className="m-0 p-0 list-none divide-y divide-line max-h-[360px] overflow-y-auto">
                  {financials.paidInvoices.map(inv => {
                    const cust = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
                    const paid = paidDate(inv.paid_at);
                    return (
                      <li key={inv.id}>
                        <Link to={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-3 no-underline hover:bg-canvas">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-navy truncate">{cust?.full_name || 'Customer'}</div>
                            <div className="text-xs text-muted">
                              {inv.invoice_number}
                              {paid ? ` · Paid ${paid}` : ''}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-navy tabular-nums shrink-0">{money(Number(inv.total))}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Expenses */}
            <Card
              title={<span className="flex items-center gap-2"><Receipt size={16} className="text-red-500" /> Expenses</span>}
              actions={<span className="text-sm font-semibold text-navy tabular-nums">{money(financials.expenses)}</span>}
              padded={false}
            >
              {financials.expensesList.length === 0 ? (
                <p className="m-0 px-4 py-6 text-sm text-muted text-center">No expenses logged this month.</p>
              ) : (
                <ul className="m-0 p-0 list-none divide-y divide-line max-h-[360px] overflow-y-auto">
                  {financials.expensesList.map(exp => (
                    <li key={exp.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-navy truncate">{exp.description}</div>
                        <div className="text-xs text-muted">
                          {exp.category} · {formatDate(exp.expense_date)}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-navy tabular-nums shrink-0">{money(Number(exp.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-3 border-t border-line">
                <ButtonLink to="/expenses" variant="secondary" icon={Receipt} className="w-full">
                  Manage expenses
                </ButtonLink>
              </div>
            </Card>

            {/* Labour */}
            <Card
              title={<span className="flex items-center gap-2"><HardHat size={16} className="text-amber-600" /> Crew labour</span>}
              actions={<span className="text-sm font-semibold text-navy tabular-nums">{money(financials.laborCost)}</span>}
              padded={false}
            >
              {financials.laborBreakdown.length === 0 ? (
                <p className="m-0 px-4 py-6 text-sm text-muted text-center">No crew hours recorded this month.</p>
              ) : (
                <ul className="m-0 p-0 list-none divide-y divide-line max-h-[360px] overflow-y-auto">
                  {financials.laborBreakdown.map(lab => (
                    <li key={lab.workerId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-navy truncate flex items-center gap-1.5">
                          {lab.workerName}
                          {lab.hasIncomplete && (
                            <span title="Missing a clock-out">
                              <AlertTriangle size={13} className="text-amber-500" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {lab.hours} h × {money(lab.wage)}/h
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-navy tabular-nums shrink-0">{money(lab.cost)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-3 border-t border-line">
                <ButtonLink to="/employees" variant="secondary" icon={HardHat} className="w-full">
                  Review payroll
                </ButtonLink>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </Page>
  );
};
