import React, { useMemo } from 'react';
import { StatStrip } from '../../components/ui/list';
import { certificationCounts } from './certs';
import type { Profile } from './types';

interface EmployeesHeaderProps {
  profiles: Profile[];
  loading?: boolean;
}

/** Key team numbers shown above the roster. */
export const EmployeesHeader: React.FC<EmployeesHeaderProps> = ({ profiles, loading }) => {
  const stats = useMemo(
    () => ({
      total: profiles.length,
      active: profiles.filter(p => p.is_active !== false && p.status !== 'Inactive').length,
      fieldTechs: profiles.filter(p => p.role === 'field_worker' || p.role === 'Field Technician').length,
      expiring: profiles.filter(p => certificationCounts(p).expiring > 0).length,
    }),
    [profiles],
  );

  return (
    <StatStrip
      loading={loading}
      items={[
        { label: 'Team members', value: stats.total, hint: 'Everyone on staff' },
        { label: 'Active', value: stats.active, hint: 'Currently working', tone: 'green' },
        { label: 'Field technicians', value: stats.fieldTechs, hint: 'Available for jobs' },
        { label: 'Certificates expiring', value: stats.expiring, hint: 'Within 30 days', tone: stats.expiring > 0 ? 'amber' : 'default' },
      ]}
    />
  );
};
