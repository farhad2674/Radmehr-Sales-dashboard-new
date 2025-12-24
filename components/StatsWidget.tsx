import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsWidgetProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color: 'blue' | 'emerald' | 'violet' | 'rose' | 'amber';
}

const StatsWidget: React.FC<StatsWidgetProps> = ({ title, value, subValue, icon: Icon, color }) => {
  const colorStyles = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-sm ${colorStyles[color]} transition-all duration-300 hover:scale-[1.02] shadow-lg`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
          <h3 className="text-2xl font-bold font-mono tracking-tight">{value}</h3>
          {subValue && <p className="text-xs mt-2 opacity-70">{subValue}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-white/5`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};

export default StatsWidget;