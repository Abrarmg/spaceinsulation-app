import React from 'react';
import { FacebookLeadAdsCard } from '../components/FacebookLeadAdsCard';
import { Page, PageHeader } from '../components/ui';

export const Settings: React.FC = () => {
  return (
    <Page>
      <PageHeader title="Settings" subtitle="Company settings and connected apps." />

      <section className="space-y-3">
        <h2 className="m-0 text-base font-semibold text-navy">Integrations</h2>
        <FacebookLeadAdsCard />
      </section>
    </Page>
  );
};
