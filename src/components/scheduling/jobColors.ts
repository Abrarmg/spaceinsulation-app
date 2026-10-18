// Custom colours a job card can be given. Class names are written out in full so Tailwind
// includes them in the build; `swatch` is used for the picker dots.
export interface JobColor {
  key: string;
  label: string;
  swatch: string;
  bg: string;
  border: string;
  borderAccent: string;
  text: string;
  title: string;
}

export const JOB_COLORS: JobColor[] = [
  { key: 'blue', label: 'Blue', swatch: '#3B82F6', bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', borderAccent: 'border-l-4 border-l-[#3B82F6]', text: 'text-[#1D4ED8]', title: 'text-[#1E3A8A]' },
  { key: 'sky', label: 'Sky', swatch: '#0EA5E9', bg: 'bg-[#F0F9FF]', border: 'border-[#BAE6FD]', borderAccent: 'border-l-4 border-l-[#0EA5E9]', text: 'text-[#0369A1]', title: 'text-[#0C4A6E]' },
  { key: 'teal', label: 'Teal', swatch: '#14B8A6', bg: 'bg-[#F0FDFA]', border: 'border-[#99F6E4]', borderAccent: 'border-l-4 border-l-[#14B8A6]', text: 'text-[#0F766E]', title: 'text-[#134E4A]' },
  { key: 'green', label: 'Green', swatch: '#22C55E', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', borderAccent: 'border-l-4 border-l-[#22C55E]', text: 'text-[#15803D]', title: 'text-[#14532D]' },
  { key: 'lime', label: 'Lime', swatch: '#84CC16', bg: 'bg-[#F7FEE7]', border: 'border-[#D9F99D]', borderAccent: 'border-l-4 border-l-[#84CC16]', text: 'text-[#4D7C0F]', title: 'text-[#365314]' },
  { key: 'yellow', label: 'Yellow', swatch: '#EAB308', bg: 'bg-[#FEFCE8]', border: 'border-[#FEF08A]', borderAccent: 'border-l-4 border-l-[#EAB308]', text: 'text-[#A16207]', title: 'text-[#713F12]' },
  { key: 'orange', label: 'Orange', swatch: '#F97316', bg: 'bg-[#FFF7ED]', border: 'border-[#FED7AA]', borderAccent: 'border-l-4 border-l-[#F97316]', text: 'text-[#C2410C]', title: 'text-[#7C2D12]' },
  { key: 'red', label: 'Red', swatch: '#EF4444', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', borderAccent: 'border-l-4 border-l-[#EF4444]', text: 'text-[#B91C1C]', title: 'text-[#7F1D1D]' },
  { key: 'pink', label: 'Pink', swatch: '#EC4899', bg: 'bg-[#FDF2F8]', border: 'border-[#FBCFE8]', borderAccent: 'border-l-4 border-l-[#EC4899]', text: 'text-[#BE185D]', title: 'text-[#831843]' },
  { key: 'purple', label: 'Purple', swatch: '#8B5CF6', bg: 'bg-[#F5F3FF]', border: 'border-[#DDD6FE]', borderAccent: 'border-l-4 border-l-[#8B5CF6]', text: 'text-[#6D28D9]', title: 'text-[#4C1D95]' },
  { key: 'brown', label: 'Brown', swatch: '#A16207', bg: 'bg-[#FAF6F1]', border: 'border-[#E7D7C1]', borderAccent: 'border-l-4 border-l-[#92400E]', text: 'text-[#92400E]', title: 'text-[#5C2D0C]' },
  { key: 'slate', label: 'Grey', swatch: '#64748B', bg: 'bg-[#F8FAFC]', border: 'border-[#CBD5E1]', borderAccent: 'border-l-4 border-l-[#64748B]', text: 'text-[#475569]', title: 'text-[#1E293B]' },
];

export const findJobColor = (key: string | null | undefined): JobColor | undefined =>
  key ? JOB_COLORS.find(c => c.key === key) : undefined;
