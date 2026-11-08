import React from 'react';

interface CapacityBarProps {
  booked: number;
  total: number;
  noun: string;
  className?: string;
}

/** "2/4 crews" with a small fill bar; amber when nearly full, red when fully booked. */
export const CapacityBar: React.FC<CapacityBarProps> = ({ booked, total, noun, className = '' }) => {
  if (total === 0) return null;
  const ratio = Math.min(1, booked / total);
  const color = ratio >= 1 ? 'bg-red-500' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-brand';
  return (
    <div className={className} title={`${booked} of ${total} ${noun} booked`}>
      <div className="h-1 rounded-full bg-line overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="text-2xs font-bold text-subtle mt-0.5 leading-none">
        {booked}/{total} {noun}
      </div>
    </div>
  );
};
