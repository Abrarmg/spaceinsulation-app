import React, { useMemo } from 'react';
import { Users, UserCheck, Wrench, AlertTriangle } from 'lucide-react';
import type { Profile } from './types';

interface EmployeesHeaderProps {
  profiles: Profile[];
}

export const EmployeesHeader: React.FC<EmployeesHeaderProps> = ({ profiles }) => {
  const stats = useMemo(() => {
    const total = profiles.length;
    const active = profiles.filter(p => p.is_active !== false && p.status !== 'Inactive').length;
    const fieldTechs = profiles.filter(p => p.role === 'field_worker' || p.role === 'Field Technician').length;
    
    // Check expiring certs (within 30 days)
    let expiringCount = 0;
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    profiles.forEach(p => {
      let hasExpiring = false;
      // Check legacy field
      if (p.certification_expiry) {
        const expDate = new Date(p.certification_expiry);
        if (expDate > today && expDate <= thirtyDaysFromNow) hasExpiring = true;
      }
      // Check new multiple certifications
      if (p.staff_certifications) {
        p.staff_certifications.forEach(cert => {
          if (cert.expiry_date) {
            const expDate = new Date(cert.expiry_date);
            if (expDate > today && expDate <= thirtyDaysFromNow) hasExpiring = true;
          }
        });
      }
      if (hasExpiring) expiringCount++;
    });

    return [
      {
        title: 'TOTAL STAFF',
        value: total,
        subtitle: 'All employees',
        icon: Users,
        color: 'text-[#3B82F6]',
        bg: 'bg-[#EFF6FF]'
      },
      {
        title: 'ACTIVE STAFF',
        value: active,
        subtitle: 'Currently active',
        icon: UserCheck,
        color: 'text-[#10B981]',
        bg: 'bg-[#ECFDF5]'
      },
      {
        title: 'FIELD TECHNICIANS',
        value: fieldTechs,
        subtitle: 'Available for jobs',
        icon: Wrench,
        color: 'text-[#F59E0B]',
        bg: 'bg-[#FEF3C7]'
      },
      {
        title: 'CERTIFICATIONS EXPIRING',
        value: expiringCount,
        subtitle: 'Within 30 days',
        icon: AlertTriangle,
        color: 'text-[#EF4444]',
        bg: 'bg-[#FEF2F2]'
      }
    ];
  }, [profiles]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div key={idx} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="text-[10px] font-black text-[#64748B] uppercase tracking-wider mb-1">{stat.title}</h3>
              <div className="text-2xl font-black text-[#151A2D] leading-none mb-1">{stat.value}</div>
              <div className="text-xs font-semibold text-[#94A3B8]">{stat.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
