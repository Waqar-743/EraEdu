import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  change?: number;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}
const tones: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700', blue: 'bg-blue-50 text-blue-700', info: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700', success: 'bg-green-50 text-green-700', purple: 'bg-purple-50 text-purple-700',
  orange: 'bg-amber-50 text-amber-700', warning: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', danger: 'bg-red-50 text-red-700',
};
const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, change, color = 'primary', isLoading = false }) => {
  if (isLoading) return <div className="card p-5" role="status" aria-label={`Loading ${label}`}><div className="animate-pulse space-y-3"><div className="h-3 w-24 rounded bg-gray-200" /><div className="h-7 w-16 rounded bg-gray-200" /></div></div>;
  return <div className="card flex items-start justify-between gap-4 p-5">
    <div className="min-w-0">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {trend && change !== undefined && <p className={`mt-2 text-xs ${trend === 'up' ? 'text-green-700' : 'text-red-600'}`}>{trend === 'up' ? '↑' : '↓'} {Math.abs(change)}% from last week</p>}
    </div>
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${tones[color] || tones.primary}`}>{icon}</span>
  </div>;
};
export default StatCard;
