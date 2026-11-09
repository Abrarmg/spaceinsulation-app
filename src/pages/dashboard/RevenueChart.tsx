import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { money } from './format';

/** Home's revenue bars. Kept in its own file so the chart library loads after the page. */

const RevenueChart: React.FC<{ data: { label: string; revenue: number }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
      <CartesianGrid vertical={false} stroke="#F1F5F9" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={52}
        tick={{ fontSize: 12, fill: '#64748B' }}
        tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
      />
      <Tooltip
        cursor={{ fill: '#F7F8FA' }}
        formatter={v => [money(Number(v)), 'Revenue']}
        contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13 }}
      />
      <Bar dataKey="revenue" fill="#76C442" radius={[6, 6, 0, 0]} maxBarSize={40} />
    </BarChart>
  </ResponsiveContainer>
);

export default RevenueChart;
