'use client';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { money } from '@/lib/utils';
const tooltip = {
  background: '#ffffff',
  border: '1px solid #deded9',
  borderRadius: 10,
  color: '#333333',
  fontSize: 12,
};
export function SpendingTrendChart({ data }: { data: any[] }) {
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 15, right: 10, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30302d" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#30302d" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b6b6af" stopOpacity={0.13} />
              <stop offset="100%" stopColor="#b6b6af" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ebebe5" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#99998f', fontSize: 11 }}
            dy={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#99998f', fontSize: 11 }}
            tickFormatter={(v) => `₹${v / 100000}L`}
          />
          <Tooltip contentStyle={tooltip} formatter={(value: any) => money(value)} />
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="#30302d"
            strokeWidth={2.5}
            fill="url(#income-fill)"
          />
          <Area
            type="monotone"
            dataKey="expenditure"
            name="Expenditure"
            stroke="#b6b6af"
            strokeWidth={2.5}
            fill="url(#expense-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function BudgetVarianceChart({ data }: { data: any[] }) {
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: -15, bottom: 10 }}>
          <CartesianGrid stroke="#ebebe5" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#a2a295', fontSize: 10 }}
            tickFormatter={(v) => (v === 'People & Culture' ? 'People' : v)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#a2a295', fontSize: 10 }}
            tickFormatter={(v) => `${v / 100000}L`}
          />
          <Tooltip contentStyle={tooltip} formatter={(v: any) => money(v)} />
          <Bar dataKey="budget" name="Allocated" fill="#e0e0d6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="Actual" fill="#30302d" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
