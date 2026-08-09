import React, { useMemo } from 'react';
import { Briefcase, CalendarClock, Play, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { Job } from './types';

interface JobsSummaryCardsProps {
  jobs: Job[];
}

export const JobsSummaryCards: React.FC<JobsSummaryCardsProps> = ({ jobs }) => {
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const total = jobs.length;
    const inProgress = jobs.filter(j => j.status === 'In Progress').length;
    const completed = jobs.filter(j => j.status === 'Completed').length;
    const todaysJobs = jobs.filter(j => j.scheduled_date?.startsWith(todayStr)).length;
    
    // Mock sparkline data
    const generateSparkline = (base: number) => Array.from({ length: 7 }).map(() => ({ value: base + Math.random() * 10 }));

    return [
      {
        title: 'Total Jobs',
        value: total,
        subtitle: 'All time projects',
        trend: '+12%',
        icon: Briefcase,
        color: '#3B82F6',
        bgColor: '#EFF6FF',
        data: generateSparkline(50)
      },
      {
        title: 'Today\'s Jobs',
        value: todaysJobs,
        subtitle: 'Scheduled for today',
        trend: '+2%',
        icon: CalendarClock,
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
        data: generateSparkline(10)
      },
      {
        title: 'In Progress',
        value: inProgress,
        subtitle: 'Currently active',
        trend: '+5%',
        icon: Play,
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        data: generateSparkline(20)
      },
      {
        title: 'Completed',
        value: completed,
        subtitle: 'Successfully finished',
        trend: '+18%',
        icon: CheckCircle2,
        color: '#10B981',
        bgColor: '#ECFDF5',
        data: generateSparkline(40)
      }
    ];
  }, [jobs]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div 
            key={idx} 
            className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: stat.bgColor, color: stat.color }}
              >
                <Icon size={20} />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded-md">
                <span>{stat.trend}</span>
              </div>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-[11px] font-black text-[#64748B] uppercase tracking-wider mb-1">
                {stat.title}
              </h3>
              <div className="text-3xl font-black text-[#151A2D] mb-1">
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-[#94A3B8]">
                {stat.subtitle}
              </div>
            </div>

            {/* Background Sparkline */}
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 group-hover:opacity-40 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stat.data}>
                  <defs>
                    <linearGradient id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stat.color} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={stat.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={stat.color} 
                    fill={`url(#gradient-${idx})`} 
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
};
