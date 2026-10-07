import { Job, JobCrewMember } from './types';

export const parseJobDateStr = (dateVal: string | null | undefined): string => {
  if (!dateVal) return '';
  return dateVal.includes('T') ? dateVal.split('T')[0] : dateVal;
};

export const formatTime12h = (time: string | null | undefined): string => {
  if (!time) return '';
  const parts = time.split(':');
  if (parts.length < 2) return time;
  let hour = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
};

export const estimateJobDuration = (job: Job): number => {
  const sqft = job.attic_sqft || 1000;
  return sqft > 1500 ? 4 : 3;
};

export const formatJobTimeRange = (job: Job): string => {
  if (!job.start_time) {
    return 'All Day';
  }
  const start = formatTime12h(job.start_time);
  if (job.end_time) {
    return `${start} - ${formatTime12h(job.end_time)}`;
  }
  // If no end time, calculate from duration
  const parts = job.start_time.split(':');
  let startH = parseInt(parts[0], 10);
  const startM = parts[1] || '00';
  const duration = estimateJobDuration(job);
  const endH = startH + duration;
  const ampm = endH >= 12 ? 'PM' : 'AM';
  const displayEndH = endH % 12 || 12;
  return `${start} - ${displayEndH}:${startM} ${ampm}`;
};

export interface JobTypeDetails {
  title: string;
  iconName: 'home' | 'wind' | 'layers' | 'shield' | 'clipboard' | 'file' | 'box';
  normalizedType: string;
}

export const getJobTypeDetails = (job: Job): JobTypeDetails => {
  const scope = (job.scope_of_work || '').toLowerCase();
  const status = (job.status || '').toLowerCase();

  if (status === 'quoted' || status === 'inspection' || scope.includes('inspect')) {
    return { title: 'Inspection', iconName: 'clipboard', normalizedType: 'Inspection' };
  }
  if (status.includes('quote') || scope.includes('quote visit')) {
    return { title: 'Quote Visit', iconName: 'file', normalizedType: 'Quote Visit' };
  }
  if (scope.includes('air seal') || scope.includes('air sealing')) {
    return { title: 'Air Sealing', iconName: 'wind', normalizedType: 'Air Sealing' };
  }
  if (scope.includes('wall')) {
    return { title: 'Wall Insulation', iconName: 'layers', normalizedType: 'Wall Insulation' };
  }
  if (scope.includes('mold') || scope.includes('remediation')) {
    return { title: 'Mold Removal', iconName: 'shield', normalizedType: 'Mold Removal' };
  }
  if (scope.includes('attic & wall') || scope.includes('attic and wall')) {
    return { title: 'Attic & Wall Insulation', iconName: 'layers', normalizedType: 'Attic & Wall Insulation' };
  }
  if (scope.includes('top up')) {
    return { title: 'Insulation Top Up', iconName: 'box', normalizedType: 'Top Up' };
  }
  if (scope.includes('removal')) {
    return { title: 'Insulation Removal', iconName: 'home', normalizedType: 'Removal' };
  }
  return { title: job.scope_of_work ? job.scope_of_work.split('\n')[0].replace(/^[-•*]\s*/, '').trim() : 'Attic Insulation', iconName: 'home', normalizedType: 'Attic Insulation' };
};

export interface JobCardTheme {
  category: 'inspection' | 'quote_pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  bg: string;
  border: string;
  borderAccent: string;
  timeColor: string;
  titleColor: string;
  iconColor: string;
  pillBg: string;
  pillText: string;
  pillLabel: string;
}

export const getJobCardTheme = (job: Job): JobCardTheme => {
  const status = (job.status || '').toLowerCase();
  const scope = (job.scope_of_work || '').toLowerCase();

  // 1. Cancelled
  if (status === 'cancelled') {
    return {
      category: 'cancelled',
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      borderAccent: 'border-l-4 border-l-[#EF4444]',
      timeColor: 'text-[#DC2626]',
      titleColor: 'text-[#991B1B]',
      iconColor: 'text-[#DC2626]',
      pillBg: 'bg-[#FEE2E2]',
      pillText: 'text-[#B91C1C]',
      pillLabel: 'Cancelled'
    };
  }

  // 2. Completed / Paid
  if (status === 'completed' || status === 'paid') {
    return {
      category: 'completed',
      bg: 'bg-[#F8FAFC]',
      border: 'border-[#E2E8F0]',
      borderAccent: 'border-l-4 border-l-[#94A3B8]',
      timeColor: 'text-[#64748B]',
      titleColor: 'text-[#334155]',
      iconColor: 'text-[#64748B]',
      pillBg: 'bg-[#E2E8F0]',
      pillText: 'text-[#475569]',
      pillLabel: 'Completed'
    };
  }

  // 3. Inspection / Quoted
  if (status === 'quoted' || status === 'inspection' || scope.includes('inspection')) {
    return {
      category: 'inspection',
      bg: 'bg-[#EFF6FF]',
      border: 'border-[#BFDBFE]',
      borderAccent: 'border-l-4 border-l-[#3B82F6]',
      timeColor: 'text-[#2563EB]',
      titleColor: 'text-[#1E40AF]',
      iconColor: 'text-[#2563EB]',
      pillBg: 'bg-[#DBEAFE]',
      pillText: 'text-[#1D4ED8]',
      pillLabel: 'Quoted'
    };
  }

  // 4. Quote Pending / Pending / Invoiced
  if (status.includes('quote') || status === 'pending' || status === 'invoiced') {
    return {
      category: 'quote_pending',
      bg: 'bg-[#FEFCE8]',
      border: 'border-[#FEF08A]',
      borderAccent: 'border-l-4 border-l-[#EAB308]',
      timeColor: 'text-[#CA8A04]',
      titleColor: 'text-[#854D0E]',
      iconColor: 'text-[#CA8A04]',
      pillBg: 'bg-[#FEF9C3]',
      pillText: 'text-[#A16207]',
      pillLabel: 'Pending'
    };
  }

  // 5. In Progress
  if (status.includes('progress') || status === 'in_progress') {
    return {
      category: 'in_progress',
      bg: 'bg-[#FFF7ED]',
      border: 'border-[#FED7AA]',
      borderAccent: 'border-l-4 border-l-[#F97316]',
      timeColor: 'text-[#EA580C]',
      titleColor: 'text-[#9A3412]',
      iconColor: 'text-[#EA580C]',
      pillBg: 'bg-[#FFEDD5]',
      pillText: 'text-[#C2410C]',
      pillLabel: 'In Progress'
    };
  }

  // 6. Scheduled / Confirmed (Default active job)
  return {
    category: 'scheduled',
    bg: 'bg-[#F0FDF4]',
    border: 'border-[#BBF7D0]',
    borderAccent: 'border-l-4 border-l-[#22C55E]',
    timeColor: 'text-[#16A34A]',
    titleColor: 'text-[#166534]',
    iconColor: 'text-[#16A34A]',
    pillBg: 'bg-[#DCFCE7]',
    pillText: 'text-[#15803D]',
    pillLabel: 'Scheduled'
  };
};

export interface CrewMemberAvatarInfo {
  id: string;
  name: string;
  initials: string;
  bgColor: string;
  textColor: string;
}

const AVATAR_PALETTES = [
  { bg: 'bg-[#E0F2FE]', text: 'text-[#0369A1]' },
  { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]' },
  { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]' },
  { bg: 'bg-[#F3E8FF]', text: 'text-[#7E22CE]' },
  { bg: 'bg-[#FFE4E6]', text: 'text-[#BE123C]' },
  { bg: 'bg-[#FFEDD5]', text: 'text-[#C2410C]' },
];

export const getJobCrewMembers = (job: Job): CrewMemberAvatarInfo[] => {
  const result: CrewMemberAvatarInfo[] = [];
  const addedIds = new Set<string>();

  if (job.job_crew && job.job_crew.length > 0) {
    job.job_crew.forEach((c, idx) => {
      const name = c.profiles?.full_name;
      const id = c.worker_id;
      if (name && !addedIds.has(id)) {
        addedIds.add(id);
        const initials = name
          .split(' ')
          .filter(Boolean)
          .map(p => p[0].toUpperCase())
          .slice(0, 2)
          .join('');
        const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
        result.push({
          id,
          name,
          initials: initials || 'W',
          bgColor: palette.bg,
          textColor: palette.text
        });
      }
    });
  }

  if (result.length === 0 && job.profiles?.full_name) {
    const name = job.profiles.full_name;
    const id = job.assigned_worker_id || 'primary';
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map(p => p[0].toUpperCase())
      .slice(0, 2)
      .join('');
    result.push({
      id,
      name,
      initials: initials || 'W',
      bgColor: 'bg-[#E0F2FE]',
      textColor: 'text-[#0369A1]'
    });
  }

  return result;
};
