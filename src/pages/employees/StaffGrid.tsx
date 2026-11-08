import React from 'react';
import { AlertTriangle, Eye, Pencil, Plus, Power, Trash2, Users } from 'lucide-react';
import { Badge, Button, EmptyState } from '../../components/ui';
import { Avatar, ListLoading, MobileList, MobileRow, OverflowMenu, T } from '../../components/ui/list';
import { certificationCounts } from './certs';
import type { Profile } from './types';

interface StaffGridProps {
  profiles: Profile[];
  loading: boolean;
  onViewProfile: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
  onDeactivate: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onAddStaff: () => void;
}

const roleLabel = (role: string) => (role === 'field_worker' ? 'Field technician' : role === 'office_staff' ? 'Office staff' : role);
const isActive = (p: Profile) => p.is_active !== false && p.status !== 'Inactive';

const CertSummary: React.FC<{ profile: Profile }> = ({ profile }) => {
  const { active, expiring } = certificationCounts(profile);
  if (active === 0 && expiring === 0) return <span className="text-muted">None</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {active > 0 && <span className="text-brand-ink">{active} valid</span>}
      {expiring > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
          <AlertTriangle size={13} /> {expiring} expiring
        </span>
      )}
    </span>
  );
};

/** The staff roster: a table on desktop, tappable rows on phones. */
export const StaffGrid: React.FC<StaffGridProps> = ({ profiles, loading, onViewProfile, onEdit, onDeactivate, onDelete, onAddStaff }) => {
  if (loading) return <ListLoading label="Loading team…" />;

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No team members found"
        description="Add your first employee to manage availability, certificates, payroll and job assignments."
        action={<Button icon={Plus} onClick={onAddStaff}>Add team member</Button>}
      />
    );
  }

  const actions = (p: Profile) => (
    <div onClick={e => e.stopPropagation()}>
      <OverflowMenu
        label="Staff actions"
        actions={[
          { label: 'View profile', icon: Eye, onClick: () => onViewProfile(p) },
          { label: 'Edit', icon: Pencil, onClick: () => onEdit(p) },
          { label: isActive(p) ? 'Deactivate' : 'Reactivate', icon: Power, onClick: () => onDeactivate(p) },
          { label: 'Delete', icon: Trash2, onClick: () => onDelete(p), danger: true },
        ]}
      />
    </div>
  );

  return (
    <>
      <div className={T.wrap}>
        <table className={T.table}>
          <thead className={T.thead}>
            <tr>
              <th className={T.th}>Name</th>
              <th className={T.th}>Phone</th>
              <th className={T.th}>Status</th>
              <th className={`${T.th} hidden lg:table-cell`}>Pay rate</th>
              <th className={`${T.th} hidden lg:table-cell`}>Certificates</th>
              <th className={`${T.th} w-14`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} className={T.tr} onClick={() => onViewProfile(p)}>
                <td className={T.td}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.full_name} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate max-w-[220px]">{p.full_name}</div>
                      <div className="text-xs text-muted">{roleLabel(p.role)}</div>
                    </div>
                  </div>
                </td>
                <td className={T.td} onClick={e => e.stopPropagation()}>
                  {p.phone ? (
                    <a href={`tel:${p.phone}`} className="text-navy no-underline hover:underline whitespace-nowrap">
                      {p.phone}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={T.td}>
                  <Badge tone={isActive(p) ? 'green' : 'neutral'} dot>
                    {isActive(p) ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className={`${T.td} hidden lg:table-cell whitespace-nowrap`}>
                  {p.profile_wages?.hourly_rate ? `$${p.profile_wages.hourly_rate}/hr` : <span className="text-muted">—</span>}
                </td>
                <td className={`${T.td} hidden lg:table-cell text-xs`}>
                  <CertSummary profile={p} />
                </td>
                <td className={`${T.td} text-right`}>{actions(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MobileList>
        {profiles.map(p => (
          <MobileRow
            key={p.id}
            onClick={() => onViewProfile(p)}
            leading={<Avatar name={p.full_name} />}
            title={p.full_name}
            subtitle={[roleLabel(p.role), p.phone].filter(Boolean).join(' · ')}
            right={
              <Badge tone={isActive(p) ? 'green' : 'neutral'} dot>
                {isActive(p) ? 'Active' : 'Inactive'}
              </Badge>
            }
            meta={
              <>
                {p.profile_wages?.hourly_rate ? <span>${p.profile_wages.hourly_rate}/hr</span> : null}
                <span className="text-xs">
                  Certificates: <CertSummary profile={p} />
                </span>
              </>
            }
          />
        ))}
      </MobileList>
    </>
  );
};
