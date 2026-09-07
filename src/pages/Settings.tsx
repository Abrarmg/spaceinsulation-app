import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { FacebookLeadAdsCard } from '../components/FacebookLeadAdsCard';

export const Settings: React.FC = () => {
  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-brand-navy tracking-tight">
              Settings
            </h1>
          </div>
          <p className="text-xs md:text-sm font-medium text-gray-500 pl-13">
            Manage your company configurations and third-party integrations.
          </p>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">
            Connected Integrations
          </h2>
        </div>

        {/* Facebook Lead Ads Card */}
        <FacebookLeadAdsCard />
      </div>
    </div>
  );
};
