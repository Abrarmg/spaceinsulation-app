import type { Profile } from './types';

/** Counts a staff member's certificates that are valid (more than 30 days left) and expiring (within 30 days). */
export const certificationCounts = (profile: Profile) => {
  const today = new Date();
  const soon = new Date();
  soon.setDate(today.getDate() + 30);

  let active = 0;
  let expiring = 0;
  const count = (iso: string | null | undefined) => {
    if (!iso) return;
    const exp = new Date(iso);
    if (exp > soon) active++;
    else if (exp > today) expiring++;
  };

  if (profile.staff_certifications) profile.staff_certifications.forEach(c => count(c.expiry_date));
  else count(profile.certification_expiry);

  return { active, expiring };
};
