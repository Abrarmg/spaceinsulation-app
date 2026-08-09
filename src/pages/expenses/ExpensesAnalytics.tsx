import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import type { Expense } from './types';
import { CATEGORY_COLORS } from './types';

interface ExpensesAnalyticsProps {
  expenses: Expense[];
}

export const ExpensesAnalytics: React.FC<ExpensesAnalyticsProps> = ({ expenses }) => {
  if (expenses.length === 0) return null;

  // 1. Process Data for Monthly Trend (Last 6 Months)
  const monthlyDataMap: Record<string, number> = {};
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const tempDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
    monthlyDataMap[key] = 0;
  }

  expenses.forEach(exp => {
    const monthKey = exp.expense_date.substring(0, 7);
    if (monthlyDataMap[monthKey] !== undefined) {
      monthlyDataMap[monthKey] += Number(exp.amount) || 0;
    }
  });

  const trendData = Object.keys(monthlyDataMap).map(key => {
    const [year, month] = key.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 1);
    return {
      name: dateObj.toLocaleDateString('en-US', { month: 'short' }),
      amount: monthlyDataMap[key]
    };
  });

  // 2. Process Data for Category Breakdown (Donut Chart)
  const categoryMap: Record<string, number> = {};
  expenses.forEach(exp => {
    categoryMap[exp.category] = (categoryMap[exp.category] || 0) + (Number(exp.amount) || 0);
  });
  
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // Top 5 categories

  const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      
      {/* Monthly Trend Chart */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm col-span-1 lg:col-span-2">
        <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wide mb-6">6-Month Expense Trend</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }} dx={-10} />
              <Tooltip 
                formatter={(value: any) => [formatCurrency(value), 'Spend']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                itemStyle={{ color: '#151A2D', fontWeight: 800 }}
              />
              <Line type="monotone" dataKey="amount" stroke="#7CC242" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#7CC242' }} activeDot={{ r: 6, fill: '#7CC242', stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown Donut */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
        <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wide mb-2">Spend By Category</h3>
        <p className="text-xs text-[#64748B] mb-4 font-medium">Top 5 categories across all time.</p>
        
        {categoryData.length > 0 ? (
          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => {
                    const colorObj = CATEGORY_COLORS[entry.name] || CATEGORY_COLORS['Other'];
                    return <Cell key={`cell-${index}`} fill={colorObj.text} />;
                  })}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(value), 'Spend']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 800 }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Custom Legend */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total</span>
              <span className="block text-lg font-black text-[#151A2D]">
                {formatCurrency(categoryData.reduce((sum, item) => sum + item.value, 0))}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-xs font-semibold text-[#94A3B8]">
            Not enough data
          </div>
        )}
      </div>

    </div>
  );
};
