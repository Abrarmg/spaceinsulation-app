export type Tone = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'amber' | 'slate';

export const TONES: Record<Tone, { solid: string; text: string; soft: string; border: string }> = {
  blue: { solid: 'bg-[#0EA5E9]', text: 'text-[#0EA5E9]', soft: 'bg-[#F0F7FF]', border: 'border-[#E0F2FE]' },
  green: { solid: 'bg-[#22C55E]', text: 'text-[#16A34A]', soft: 'bg-[#F0FDF4]', border: 'border-[#DCFCE7]' },
  purple: { solid: 'bg-[#8B5CF6]', text: 'text-[#8B5CF6]', soft: 'bg-[#F5F3FF]', border: 'border-[#EDE9FE]' },
  orange: { solid: 'bg-[#F97316]', text: 'text-[#F97316]', soft: 'bg-[#FFF7ED]', border: 'border-[#FFEDD5]' },
  red: { solid: 'bg-[#EF4444]', text: 'text-[#EF4444]', soft: 'bg-[#FEF2F2]', border: 'border-[#FEE2E2]' },
  amber: { solid: 'bg-[#F59E0B]', text: 'text-[#D97706]', soft: 'bg-[#FFFBEB]', border: 'border-[#FEF3C7]' },
  slate: { solid: 'bg-[#64748B]', text: 'text-[#64748B]', soft: 'bg-[#F8FAFC]', border: 'border-[#E2E8F0]' },
};

export const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const timeAgo = (date: Date) => {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return date.toLocaleDateString();
};
