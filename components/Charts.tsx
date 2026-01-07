import React, { useState, useEffect } from 'react';
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
  LabelList
} from 'recharts';
import { MonthlyStats } from '../types';
import { formatCurrency, toPersianDigits } from '../utils/helpers';

interface ChartProps {
  data: MonthlyStats[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-right z-50" dir="rtl">
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
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-right z-50" dir="rtl">
        <p className="text-slate-300 mb-1 text-sm">{`تاریخ: ${label}`}</p>
        <p className="text-blue-400 font-bold text-lg">
          {`تعداد چک: ${toPersianDigits(payload[0].value)} عدد`}
        </p>
      </div>
    );
  }
  return null;
};

const formatYAxis = (val: number) => {
    if (val >= 1000000) return `${toPersianDigits((val / 1000000).toFixed(0))} M`;
    if (val >= 1000) return `${toPersianDigits((val / 1000).toFixed(0))} K`;
    return toPersianDigits(val);
  };

export const LiquidityChart: React.FC<ChartProps> = ({ data }) => {
  const [isReady, setIsReady] = useState(false);

  // Find the highest value
  const maxAmount = data.length > 0 ? Math.max(...data.map(d => d.totalAmount)) : 0;

  useEffect(() => {
    // Delay rendering to ensure parent container has calculated dimensions.
    // This fixes the "width(-1)" error in Safari/Recharts when mounting.
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100); 
    return () => clearTimeout(timer);
  }, []);

  const formatLabel = (val: number) => {
    // Only show label if the value is the max value
    if (val !== maxAmount || val === 0) return '';
    
    // Return full formatted currency (e.g. 123,456,789)
    return formatCurrency(val);
  };

  return (
    <div className="h-[350px] w-full bg-slate-800/50 p-4 rounded-2xl border border-slate-700 shadow-xl flex flex-col">
      <h3 className="text-lg font-bold text-slate-100 mb-6 border-r-4 border-emerald-500 pr-3 shrink-0">
        پیش‌بینی نقدینگی ماهانه (آینده)
      </h3>
      <div className="flex-1 w-full relative min-h-0" dir="ltr">
        {isReady ? (
          <div className="absolute inset-0 animate-in fade-in duration-500">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.6}/>
                  </linearGradient>
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
                  tickFormatter={(val) => toPersianDigits(val.split('/')[1])} 
                />
                <YAxis 
                  orientation="right"
                  stroke="#94a3b8" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  tickFormatter={formatYAxis}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar 
                  dataKey="totalAmount" 
                  fill="url(#colorAmount)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                  filter="url(#shadow)"
                >
                  <LabelList 
                      dataKey="totalAmount" 
                      position="top" 
                      fill="#cbd5e1" 
                      fontSize={14} 
                      fontWeight="bold"
                      formatter={formatLabel}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CountChart: React.FC<ChartProps> = ({ data }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Delay rendering to ensure parent container has calculated dimensions.
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-[350px] w-full bg-slate-800/50 p-4 rounded-2xl border border-slate-700 shadow-xl flex flex-col">
       <h3 className="text-lg font-bold text-slate-100 mb-6 border-r-4 border-blue-500 pr-3 shrink-0">
        روند تعداد چک‌های آتی
      </h3>
      <div className="flex-1 w-full relative min-h-0" dir="ltr">
        {isReady ? (
          <div className="absolute inset-0 animate-in fade-in duration-500">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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
                  tickFormatter={(val) => toPersianDigits(val.split('/')[1])}
                />
                <YAxis 
                  orientation="right"
                  stroke="#94a3b8" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => toPersianDigits(val)}
                  width={30}
                />
                <Tooltip content={<CustomTooltipCount />} />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#60a5fa" 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  strokeWidth={3}
                >
                  <LabelList 
                      dataKey="count" 
                      position="top" 
                      fill="#cbd5e1" 
                      fontSize={14} 
                      fontWeight="bold"
                      offset={10}
                      formatter={(val: number) => val === 0 ? '' : toPersianDigits(val)}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};