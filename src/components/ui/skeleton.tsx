import React from 'react';

/**
 * Grey outline placeholders shown while a page or its data loads. They keep
 * the layout steady, so content doesn't jump when it arrives.
 */

export const Bone: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-md bg-mist animate-pulse ${className}`} aria-hidden />
);

/** Placeholder rows for a list or table. */
export const ListSkeleton: React.FC<{ rows?: number; label?: string }> = ({ rows = 6, label = 'Loading…' }) => (
  <div role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <ul className="m-0 p-0 list-none divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Bone className="w-9 h-9 !rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Bone className={`h-3.5 ${i % 3 === 0 ? 'w-2/5' : i % 3 === 1 ? 'w-1/3' : 'w-1/2'}`} />
            <Bone className="h-3 w-1/4" />
          </div>
          <Bone className="hidden sm:block h-5 w-20 !rounded-full" />
          <Bone className="h-4 w-16" />
        </li>
      ))}
    </ul>
  </div>
);

/** Placeholder for a record page: header, then a main column and a side column. */
export const DetailSkeleton: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-7 space-y-5" role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <Bone className="h-4 w-20" />
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="space-y-2.5">
        <Bone className="h-8 w-64 max-w-full" />
        <Bone className="h-4 w-44" />
      </div>
      <div className="flex gap-2">
        <Bone className="h-10 w-10" />
        <Bone className="h-10 w-24" />
        <Bone className="h-10 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white border border-line rounded-xl p-5 space-y-4">
          <Bone className="h-5 w-32" />
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <Bone className="h-4 w-24" />
              <Bone className="h-4 flex-1" />
            </div>
          ))}
        </div>
        <div className="bg-white border border-line rounded-xl p-5 space-y-3">
          <Bone className="h-5 w-40" />
          <Bone className="h-24 w-full" />
        </div>
      </div>
      <div className="bg-white border border-line rounded-xl p-5 space-y-4 h-fit">
        <Bone className="h-5 w-24" />
        <Bone className="h-10 w-36" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-3/4" />
      </div>
    </div>
  </div>
);

/** Placeholder for a whole page while its code downloads. */
export const PageSkeleton: React.FC = () => (
  <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-7 space-y-5" role="status" aria-label="Loading page">
    <span className="sr-only">Loading page</span>
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-2.5">
        <Bone className="h-8 w-48" />
        <Bone className="h-4 w-72 max-w-full" />
      </div>
      <Bone className="hidden sm:block h-10 w-32" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white border border-line rounded-xl p-4 space-y-2.5">
          <Bone className="h-3.5 w-20" />
          <Bone className="h-7 w-12" />
        </div>
      ))}
    </div>
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="p-3 border-b border-line">
        <Bone className="h-10 w-full" />
      </div>
      <ListSkeleton rows={5} label="Loading page" />
    </div>
  </div>
);
