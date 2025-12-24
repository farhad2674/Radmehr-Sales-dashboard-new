import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  defs,
  linearGradient,
  stop
} from 'recharts';
import { MonthlyStats } from '../types';
import { formatCurrency } from '../utils/helpers';

interface ChartProps {
  data: MonthlyStats[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-right">
        <p className="text-slate-300 mb-1 text-sm">{`تاریخ: ${label}`}</p>
        <p className="text-emerald-400 font-bold text-lg">
          {`مبلغ: ${formatCurrency(payload[0].value)}`}
        </p>
      </div>
    );
  }
  return null;
};

const CustomTooltipCount = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-right">
        <p className="text-slate-300 mb-1 text-sm">{`تاریخ: ${label}`}</p>
        <p className="text-blue-400 font-bold text-lg">
          {`تعداد چک: ${payload[0].value} عدد`}
        </p>
      </div>
    );
  }
  return null;
};

export const LiquidityChart: React.FC<ChartProps> = ({ data }) => {
  return (
    <div className="h-[350px] w-full bg-slate-800/50 p-4 rounded-2xl border border-slate-700 shadow-xl">
      <h3 className="text-lg font-bold text-slate-100 mb-6 border-r-4 border-emerald-500 pr-3">
        پیش‌بینی نقدینگی ماهانه (آینده)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
              <stop offset="95%" stopColor="#059669" stopOpacity={0.6}/>
            </linearGradient>
            {/* Simple shadow filter for pseudo-3D effect */}
            <filter id="shadow" height="200%">
              <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.3"/>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="month" 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
            tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar 
            dataKey="totalAmount" 
            fill="url(#colorAmount)" 
            radius={[6, 6, 0, 0]} 
            barSize={40}
            filter="url(#shadow)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CountChart: React.FC<ChartProps> = ({ data }) => {
  return (
    <div className="h-[350px] w-full bg-slate-800/50 p-4 rounded-2xl border border-slate-700 shadow-xl">
       <h3 className="text-lg font-bold text-slate-100 mb-6 border-r-4 border-blue-500 pr-3">
        روند تعداد چک‌های آتی
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="month" 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltipCount />} />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#60a5fa" 
            fillOpacity={1} 
            fill="url(#colorCount)" 
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};