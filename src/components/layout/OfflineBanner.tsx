import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnline } from '../../utils/pwa';

/** Shown under the header while the device has no connection. */
export const OfflineBanner: React.FC = () => {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-14 md:top-16 z-10 bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="px-4 md:px-6 lg:px-8 py-2 flex items-center gap-2 text-sm">
        <WifiOff size={16} className="shrink-0 text-amber-700" />
        <span>
          <span className="font-semibold">You're offline.</span> Showing what was last saved on this phone — changes need a signal.
        </span>
      </div>
    </div>
  );
};
